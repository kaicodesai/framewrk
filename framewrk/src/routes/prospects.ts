import type { Env, Prospect, Build, Activity, ServiceTier } from "../types";
import { json, badRequest, notFound } from "../lib/http";
import { parseGoogleMapsUrl, lookupPlaceDetails } from "../lib/googleMaps";
import { PRICING_CENTS } from "../lib/pricing";

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createProspect(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | {
        google_maps_url?: string;
        business_name?: string;
        category?: string;
        address?: string;
        phone?: string;
        notes?: string;
      }
    | null;

  if (!body?.google_maps_url && !body?.business_name) {
    return badRequest("Either google_maps_url or business_name is required");
  }

  // Manually-added clients (referrals, walk-ins) may not have a Google Maps
  // listing at all — the lookup below is skipped entirely in that case, and
  // any fields the founder typed in are used as-is.
  let businessName = body.business_name ?? null;
  let category = body.category ?? null;
  let address = body.address ?? null;
  let phone = body.phone ?? null;
  let photoReferences: string[] = [];

  if (body.google_maps_url) {
    const parsed = await parseGoogleMapsUrl(body.google_maps_url);
    const details = await lookupPlaceDetails(env, parsed);
    businessName = body.business_name ?? details.business_name;
    category = body.category ?? details.category;
    address = body.address ?? details.address;
    phone = body.phone ?? details.phone;
    photoReferences = details.photo_references;
  }

  const id = newId();
  const timestamp = nowIso();

  await env.DB.prepare(
    `INSERT INTO prospects
      (id, google_maps_url, business_name, category, address, phone,
       google_photos_json, instagram_url, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`
  )
    .bind(
      id,
      body.google_maps_url ?? "",
      businessName,
      category,
      address,
      phone,
      JSON.stringify(photoReferences),
      null,
      body.notes ?? null,
      timestamp,
      timestamp
    )
    .run();

  const prospect = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?")
    .bind(id)
    .first<Prospect>();

  return json(prospect, 201);
}

const MAX_BULK_ROWS = 500;

export async function bulkCreateProspects(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | {
        prospects?: {
          business_name?: string;
          category?: string;
          address?: string;
          phone?: string;
          notes?: string;
        }[];
      }
    | null;

  if (!Array.isArray(body?.prospects) || body.prospects.length === 0) {
    return badRequest("prospects must be a non-empty array");
  }
  if (body.prospects.length > MAX_BULK_ROWS) {
    return badRequest(`prospects cannot exceed ${MAX_BULK_ROWS} rows per import`);
  }

  const valid = body.prospects.filter((p) => typeof p.business_name === "string" && p.business_name.trim());
  const skippedInvalid = body.prospects.length - valid.length;

  const { results: existing } = await env.DB.prepare(
    "SELECT business_name FROM prospects WHERE business_name IS NOT NULL"
  ).all<{ business_name: string }>();
  const existingNames = new Set(existing.map((p) => p.business_name.trim().toLowerCase()));

  const seenInBatch = new Set<string>();
  const toInsert: NonNullable<typeof body.prospects> = [];
  let skippedDuplicates = 0;

  for (const p of valid) {
    const key = p.business_name!.trim().toLowerCase();
    if (existingNames.has(key) || seenInBatch.has(key)) {
      skippedDuplicates++;
      continue;
    }
    seenInBatch.add(key);
    toInsert.push(p);
  }

  const timestamp = nowIso();
  const statements = toInsert.map((p) =>
    env.DB.prepare(
      `INSERT INTO prospects
        (id, google_maps_url, business_name, category, address, phone,
         google_photos_json, instagram_url, notes, status, created_at, updated_at)
       VALUES (?, '', ?, ?, ?, ?, '[]', NULL, ?, 'submitted', ?, ?)`
    ).bind(
      newId(),
      p.business_name!.trim(),
      p.category ?? null,
      p.address ?? null,
      p.phone ?? null,
      p.notes ?? null,
      timestamp,
      timestamp
    )
  );

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  return json({
    created: toInsert.length,
    skipped_duplicates: skippedDuplicates,
    skipped_invalid: skippedInvalid,
  });
}

export async function listProspects(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM prospects ORDER BY created_at DESC"
  ).all<Prospect>();
  return json(results);
}

export async function getProspect(env: Env, id: string): Promise<Response> {
  const prospect = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?")
    .bind(id)
    .first<Prospect>();
  if (!prospect) return notFound("Prospect not found");

  const { results: builds } = await env.DB.prepare(
    "SELECT * FROM builds WHERE prospect_id = ? ORDER BY created_at DESC"
  )
    .bind(id)
    .all<Build>();

  const { results: activities } = await env.DB.prepare(
    "SELECT * FROM activities WHERE prospect_id = ? ORDER BY created_at DESC"
  )
    .bind(id)
    .all<Activity>();

  return json({ ...prospect, builds, activities });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateProspect(request: Request, env: Env, id: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | {
        business_name?: string;
        category?: string;
        address?: string;
        phone?: string;
        notes?: string;
        next_action?: string | null;
        next_action_date?: string | null;
      }
    | null;
  if (!body) return badRequest("Request body must be JSON");

  if (
    body.next_action_date !== undefined &&
    body.next_action_date !== null &&
    (!DATE_RE.test(body.next_action_date) || Number.isNaN(Date.parse(body.next_action_date)))
  ) {
    return badRequest("next_action_date must be an ISO date (YYYY-MM-DD) or null");
  }

  // deal_value_cents is deliberately not editable here — fixed pricing means
  // it's derived from the build's service_tier (see startBuild) and should
  // never be a manual guess.
  const fields: [string, string | null | undefined][] = [
    ["business_name", body.business_name],
    ["category", body.category],
    ["address", body.address],
    ["phone", body.phone],
    ["notes", body.notes],
    ["next_action", body.next_action],
    ["next_action_date", body.next_action_date],
  ];
  const toUpdate = fields.filter(([, value]) => value !== undefined);
  if (toUpdate.length === 0) {
    return badRequest(
      "At least one of business_name, category, address, phone, notes, next_action, next_action_date is required"
    );
  }

  const setClause = toUpdate.map(([column]) => `${column} = ?`).join(", ");
  const values = toUpdate.map(([, value]) => value);
  const timestamp = nowIso();

  const result = await env.DB.prepare(
    `UPDATE prospects SET ${setClause}, updated_at = ? WHERE id = ?`
  )
    .bind(...values, timestamp, id)
    .run();
  if (result.meta.changes === 0) return notFound("Prospect not found");

  const prospect = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?")
    .bind(id)
    .first<Prospect>();
  return json(prospect);
}

const LOST_REASONS = ["no_response", "not_interested", "price", "chose_competitor", "other"];

export async function markProspectLost(request: Request, env: Env, id: string): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  if (body.reason !== undefined && !LOST_REASONS.includes(body.reason)) {
    return badRequest(`reason must be one of: ${LOST_REASONS.join(", ")}`);
  }

  const result = await env.DB.prepare(
    `UPDATE prospects
     SET status = 'closed_lost', lost_reason = ?, next_action = NULL, next_action_date = NULL,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(body.reason ?? null, nowIso(), id)
    .run();
  if (result.meta.changes === 0) return notFound("Prospect not found");
  return json({ ok: true });
}

export async function startBuild(request: Request, env: Env, prospectId: string): Promise<Response> {
  const prospect = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?")
    .bind(prospectId)
    .first<Prospect>();
  if (!prospect) return notFound("Prospect not found");

  const body = (await request.json().catch(() => ({}))) as { service_tier?: ServiceTier };
  const serviceTier: ServiceTier = body.service_tier === "website_dashboard" ? "website_dashboard" : "website";

  const buildId = newId();
  const timestamp = nowIso();

  await env.DB.prepare(
    `INSERT INTO builds
      (id, prospect_id, service_tier, status, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', ?, ?)`
  )
    .bind(buildId, prospectId, serviceTier, timestamp, timestamp)
    .run();

  await env.DB.prepare(
    "UPDATE prospects SET status = 'building', deal_value_cents = ?, updated_at = ? WHERE id = ?"
  )
    .bind(PRICING_CENTS[serviceTier], timestamp, prospectId)
    .run();

  await env.BUILD_QUEUE.send({
    buildId,
    prospectId,
    stage: "brand-design",
  });

  const build = await env.DB.prepare("SELECT * FROM builds WHERE id = ?")
    .bind(buildId)
    .first<Build>();

  return json(build, 201);
}

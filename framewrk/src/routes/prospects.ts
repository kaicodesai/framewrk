import type { Env, Prospect, Build, Activity, ServiceTier } from "../types";
import { json, badRequest, notFound } from "../lib/http";
import { parseGoogleMapsUrl, lookupPlaceDetails } from "../lib/googleMaps";

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

export async function updateProspect(request: Request, env: Env, id: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | {
        business_name?: string;
        category?: string;
        address?: string;
        phone?: string;
        notes?: string;
        deal_value_cents?: number | null;
      }
    | null;
  if (!body) return badRequest("Request body must be JSON");

  if (
    body.deal_value_cents !== undefined &&
    body.deal_value_cents !== null &&
    !Number.isInteger(body.deal_value_cents)
  ) {
    return badRequest("deal_value_cents must be an integer or null");
  }

  const fields: [string, string | number | null | undefined][] = [
    ["business_name", body.business_name],
    ["category", body.category],
    ["address", body.address],
    ["phone", body.phone],
    ["notes", body.notes],
    ["deal_value_cents", body.deal_value_cents],
  ];
  const toUpdate = fields.filter(([, value]) => value !== undefined);
  if (toUpdate.length === 0) {
    return badRequest(
      "At least one of business_name, category, address, phone, notes, deal_value_cents is required"
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
    "UPDATE prospects SET status = 'closed_lost', lost_reason = ?, updated_at = ? WHERE id = ?"
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
    "UPDATE prospects SET status = 'building', updated_at = ? WHERE id = ?"
  )
    .bind(timestamp, prospectId)
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

import type { Env, Activity, ActivityType, Prospect } from "../types";
import { json, badRequest, notFound } from "../lib/http";

const VALID_TYPES: ActivityType[] = ["call", "email", "sms", "meeting", "note"];

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createActivity(
  request: Request,
  env: Env,
  prospectId: string
): Promise<Response> {
  const prospect = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?")
    .bind(prospectId)
    .first<Prospect>();
  if (!prospect) return notFound("Prospect not found");

  const body = (await request.json().catch(() => null)) as
    | { type?: string; body?: string }
    | null;
  if (!body?.type || !VALID_TYPES.includes(body.type as ActivityType)) {
    return badRequest(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }

  const id = newId();
  const timestamp = nowIso();

  await env.DB.prepare(
    "INSERT INTO activities (id, prospect_id, type, body, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, prospectId, body.type, body.body ?? null, timestamp)
    .run();

  // Logging outreach is itself a touch on the prospect — keeps staleness/
  // ordering signals (updated_at) accurate without a separate mechanism.
  await env.DB.prepare("UPDATE prospects SET updated_at = ? WHERE id = ?")
    .bind(timestamp, prospectId)
    .run();

  const activity = await env.DB.prepare("SELECT * FROM activities WHERE id = ?")
    .bind(id)
    .first<Activity>();

  return json(activity, 201);
}

export async function listActivities(env: Env, prospectId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM activities WHERE prospect_id = ? ORDER BY created_at DESC"
  )
    .bind(prospectId)
    .all<Activity>();
  return json(results);
}

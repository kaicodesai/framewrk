import type { Env, JobState } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

export async function startJob(env: Env, buildId: string, stage: string): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  await env.DB.prepare(
    `INSERT INTO jobs (id, build_id, stage, state, created_at, updated_at)
     VALUES (?, ?, ?, 'running', ?, ?)`
  )
    .bind(id, buildId, stage, timestamp, timestamp)
    .run();
  return id;
}

export async function finishJob(
  env: Env,
  jobId: string,
  state: JobState,
  detail?: string
): Promise<void> {
  await env.DB.prepare(
    "UPDATE jobs SET state = ?, detail = ?, updated_at = ? WHERE id = ?"
  )
    .bind(state, detail ?? null, nowIso(), jobId)
    .run();
}

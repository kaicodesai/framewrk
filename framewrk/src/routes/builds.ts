import type { Env, Build } from "../types";
import { json, notFound, badRequest } from "../lib/http";

export async function getBuild(env: Env, id: string): Promise<Response> {
  const build = await env.DB.prepare("SELECT * FROM builds WHERE id = ?")
    .bind(id)
    .first<Build>();
  if (!build) return notFound("Build not found");
  return json(build);
}

export async function getBuildJobs(env: Env, id: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM jobs WHERE build_id = ? ORDER BY created_at ASC"
  )
    .bind(id)
    .all();
  return json(results);
}

export async function submitPreview(request: Request, env: Env, id: string): Promise<Response> {
  const build = await env.DB.prepare("SELECT * FROM builds WHERE id = ?")
    .bind(id)
    .first<Build>();
  if (!build) return notFound("Build not found");
  if (build.status !== "awaiting_manual_build") {
    return badRequest(
      `Build is not awaiting a manual submission (current status: ${build.status})`
    );
  }

  const body = (await request.json().catch(() => null)) as { preview_url?: string } | null;
  if (!body?.preview_url) {
    return badRequest("preview_url is required");
  }

  const timestamp = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE builds SET preview_url = ?, status = 'qa_running', updated_at = ? WHERE id = ?"
  )
    .bind(body.preview_url, timestamp, id)
    .run();

  await env.BUILD_QUEUE.send({
    buildId: id,
    prospectId: build.prospect_id,
    stage: "qa-running",
  });

  const updated = await env.DB.prepare("SELECT * FROM builds WHERE id = ?").bind(id).first<Build>();
  return json(updated);
}

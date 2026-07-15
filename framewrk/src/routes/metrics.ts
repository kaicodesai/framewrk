import type { Env } from "../types";
import { json } from "../lib/http";

export async function getMetrics(env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT
       AVG(julianday(updated_at) - julianday(created_at)) AS avg_days,
       COUNT(*) AS n
     FROM builds
     WHERE status = 'ready'`
  ).first<{ avg_days: number | null; n: number }>();

  const avgBuildHours = row?.avg_days != null ? row.avg_days * 24 : null;

  return json({
    avg_build_hours: avgBuildHours,
    build_ready_count: row?.n ?? 0,
  });
}

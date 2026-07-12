// Trigger initial Git-connected deploy for the framewrk Worker.
import type { Env, BuildJobMessage } from "./types";
import { isAuthorized } from "./lib/auth";
import { json, notFound, unauthorized } from "./lib/http";
import { preflightResponse, withCors } from "./lib/cors";
import {
  createProspect,
  listProspects,
  getProspect,
  updateProspect,
  markProspectLost,
  startBuild,
} from "./routes/prospects";
import { getBuild, getBuildJobs, submitPreview } from "./routes/builds";
import { runStage } from "./pipeline/stages";

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  // Stripe webhooks authenticate via signature, not the dashboard bearer token.
  if (pathname === "/webhooks/stripe" && method === "POST") {
    // Implemented alongside the payment-handover stage (build spec §5, stage 7).
    return json({ error: "Not implemented yet" }, 501);
  }

  if (!isAuthorized(request, env)) {
    return unauthorized();
  }

  if (pathname === "/prospects" && method === "POST") {
    return createProspect(request, env);
  }
  if (pathname === "/prospects" && method === "GET") {
    return listProspects(env);
  }

  const prospectMatch = pathname.match(/^\/prospects\/([^/]+)$/);
  if (prospectMatch && method === "GET") {
    return getProspect(env, prospectMatch[1]);
  }
  if (prospectMatch && method === "PATCH") {
    return updateProspect(request, env, prospectMatch[1]);
  }

  const lostMatch = pathname.match(/^\/prospects\/([^/]+)\/mark-lost$/);
  if (lostMatch && method === "POST") {
    return markProspectLost(env, lostMatch[1]);
  }

  const buildMatch = pathname.match(/^\/prospects\/([^/]+)\/build$/);
  if (buildMatch && method === "POST") {
    return startBuild(request, env, buildMatch[1]);
  }

  const buildDetailMatch = pathname.match(/^\/builds\/([^/]+)$/);
  if (buildDetailMatch && method === "GET") {
    return getBuild(env, buildDetailMatch[1]);
  }

  const buildJobsMatch = pathname.match(/^\/builds\/([^/]+)\/jobs$/);
  if (buildJobsMatch && method === "GET") {
    return getBuildJobs(env, buildJobsMatch[1]);
  }

  const submitPreviewMatch = pathname.match(/^\/builds\/([^/]+)\/submit-preview$/);
  if (submitPreviewMatch && method === "POST") {
    return submitPreview(request, env, submitPreviewMatch[1]);
  }

  return notFound();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return preflightResponse();
    }
    try {
      return withCors(await route(request, env));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return withCors(json({ error: "Internal error", detail }, 500));
    }
  },

  async queue(batch: MessageBatch<BuildJobMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await runStage(env, message.body);
      // Failures are already recorded on the build row by runStage, so we
      // ack regardless rather than letting the queue retry a stage that
      // will just fail the same way again.
      message.ack();
    }
  },
};

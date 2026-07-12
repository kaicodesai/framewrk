import type { Build, BuildJobMessage, Env, Prospect } from "../types";
import { completeChat } from "../lib/openrouter";
import { startJob, finishJob } from "../lib/jobs";

function nowIso(): string {
  return new Date().toISOString();
}

async function getBuild(env: Env, id: string): Promise<Build> {
  const build = await env.DB.prepare("SELECT * FROM builds WHERE id = ?").bind(id).first<Build>();
  if (!build) throw new Error(`Build ${id} not found`);
  return build;
}

async function getProspect(env: Env, id: string): Promise<Prospect> {
  const prospect = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?")
    .bind(id)
    .first<Prospect>();
  if (!prospect) throw new Error(`Prospect ${id} not found`);
  return prospect;
}

async function setBuildStatus(env: Env, buildId: string, status: string): Promise<void> {
  await env.DB.prepare("UPDATE builds SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, nowIso(), buildId)
    .run();
}

async function setBuildFailed(env: Env, buildId: string, error: string): Promise<void> {
  await env.DB.prepare("UPDATE builds SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
    .bind(error, nowIso(), buildId)
    .run();
}

async function enqueue(env: Env, message: BuildJobMessage): Promise<void> {
  await env.BUILD_QUEUE.send(message);
}

// --- Stage: brand-design ---------------------------------------------------
async function runBrandDesign(env: Env, message: BuildJobMessage): Promise<void> {
  await setBuildStatus(env, message.buildId, "designing");
  const prospect = await getProspect(env, message.prospectId);

  const raw = await completeChat(env, {
    system:
      "You are a senior brand and graphic designer known for bold, avant-garde, agency-quality work — " +
      "Awwwards Site-of-the-Day caliber, never a generic template or reskinned SaaS dark-mode layout. " +
      "Given a local business, produce a design brief as strict JSON with keys: " +
      '"palette" (array of 3-5 hex colors), "typography" (object with "heading" and "body" font names), ' +
      '"tone" (array of 3-5 adjectives), "layout_direction" (3-4 sentences that MUST name one specific, ' +
      "concrete structural device unique to this build — e.g. a diagonal section divider, a scroll-linked " +
      "split-screen, an interrupted grid with irregular column spans, a marquee/ticker strip, an oversized " +
      "rotated element — chosen to fit this business's niche and mood, not a reused 'asymmetric grid + big " +
      "type' recipe. The layout_direction must also state that any decorative overlapping element is only " +
      "ever placed over genuinely empty space and must never cover or reduce legibility of body text). " +
      "Output ONLY the JSON object, no markdown fencing, no commentary.",
    user: `Business: ${prospect.business_name ?? "Unknown"}\nCategory: ${prospect.category ?? "Unknown"}\nNotes: ${prospect.notes ?? "None"}`,
  });

  let designBrief: unknown;
  try {
    designBrief = JSON.parse(raw);
  } catch {
    designBrief = { raw };
  }

  await env.DB.prepare("UPDATE builds SET design_brief_json = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(designBrief), nowIso(), message.buildId)
    .run();

  await enqueue(env, { ...message, stage: "sourcing-assets" });
}

// --- Stage: sourcing-assets (pass-through for now) -------------------------
async function runSourcingAssets(env: Env, message: BuildJobMessage): Promise<void> {
  await setBuildStatus(env, message.buildId, "sourcing_assets");

  // Automated Instagram/Google photo pulling isn't built yet — the manual
  // photo-upload option on the prospect form is a future gap (see build
  // spec §8). For now, flag that placeholder/AI-generated imagery should
  // be used; the prompt-generation stage instructs Claude Code accordingly.
  const assetManifest = {
    sourced: false,
    note: "No automated asset sourcing yet — build prompt instructs Claude Code to use AI-generated placeholder imagery.",
  };

  await env.DB.prepare("UPDATE builds SET asset_manifest_json = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(assetManifest), nowIso(), message.buildId)
    .run();

  await enqueue(env, { ...message, stage: "generating" });
}

// --- Stage: generating (composes the Claude Code build prompt) ------------
async function runGenerating(env: Env, message: BuildJobMessage): Promise<void> {
  await setBuildStatus(env, message.buildId, "generating");
  const build = await getBuild(env, message.buildId);
  const prospect = await getProspect(env, message.prospectId);

  const tierNote =
    build.service_tier === "website_dashboard"
      ? "This site also needs a booking/ordering portal — a simple page where customers can book an appointment or place an order, with a basic admin view for the owner."
      : "This is a website-only build — no booking/ordering portal needed.";

  const prompt = await completeChat(env, {
    system:
      "You are an expert prompt engineer writing instructions for Claude Code, an AI coding agent. " +
      "Write a single, extremely detailed, ready-to-paste prompt that will let Claude Code one-shot build " +
      "a complete, polished, avant-garde/agency-quality static website — plain HTML/CSS/vanilla JS, no build " +
      "step, no framework, no dependencies, mobile-responsive, ready to deploy directly to Cloudflare Pages. " +
      "Include: an appropriate page structure for the business's niche, specific brand direction (colors, " +
      "fonts, tone, and the one structural device named in the design brief) drawn from the provided design " +
      "brief, copywriting guidance, and an instruction to use AI-generated placeholder imagery if no real " +
      "photos are supplied. The prompt you write MUST state these two constraints explicitly and " +
      "non-negotiably: (1) any decorative or overlapping visual element (tags, rotated blocks, oversized " +
      "numerals, pull-quotes, etc.) is positioned only over genuinely empty space and must never overlap or " +
      "obscure body copy or headline text at any breakpoint — check this before considering the build done; " +
      "(2) at least one element per major section visually breaks out of the centered content container " +
      "(e.g. a full-bleed image or color block using a 100vw/negative-margin breakout technique), and " +
      "feature/offering sections use irregular, unequal column spans rather than a symmetric row of equal-" +
      "width cards — a generic evenly-spaced three- or four-card grid is explicitly not acceptable. Output " +
      "ONLY the prompt text — no preamble, no markdown fencing, no commentary about what you wrote.",
    user:
      `Business: ${prospect.business_name ?? "Unknown"}\n` +
      `Category: ${prospect.category ?? "Unknown"}\n` +
      `Address: ${prospect.address ?? "Unknown"}\n` +
      `Phone: ${prospect.phone ?? "Unknown"}\n` +
      `Notes: ${prospect.notes ?? "None"}\n` +
      `Design brief: ${build.design_brief_json ?? "None provided"}\n` +
      `${tierNote}`,
  });

  await env.DB.prepare("UPDATE builds SET build_prompt = ?, status = 'awaiting_manual_build', updated_at = ? WHERE id = ?")
    .bind(prompt, nowIso(), message.buildId)
    .run();
  // Pipeline pauses here — the founder builds the site with Claude Code and
  // calls POST /builds/:id/submit-preview when a live URL is ready.
}

// --- Stage: qa-running (plain technical checks, no LLM needed) -------------
async function runQaRunning(env: Env, message: BuildJobMessage): Promise<void> {
  const build = await getBuild(env, message.buildId);
  const url = build.preview_url;
  const checks: { name: string; pass: boolean; detail?: string }[] = [];

  if (!url) {
    checks.push({ name: "preview_url present", pass: false });
  } else {
    try {
      const res = await fetch(url);
      checks.push({ name: "page loads (2xx)", pass: res.ok, detail: `HTTP ${res.status}` });
      const body = res.ok ? await res.text() : "";
      checks.push({ name: "has <html>", pass: /<html[\s>]/i.test(body) });
      checks.push({
        name: "has mobile viewport meta tag",
        pass: /<meta[^>]+name=["']viewport["']/i.test(body),
      });
      checks.push({ name: "has <title>", pass: /<title>[^<]+<\/title>/i.test(body) });
    } catch (err) {
      checks.push({ name: "page loads (2xx)", pass: false, detail: String(err) });
    }
  }

  const verdict = checks.every((c) => c.pass) ? "pass" : "fail";

  await env.DB.prepare(
    "UPDATE builds SET qa_verdict = ?, qa_report_json = ?, updated_at = ? WHERE id = ?"
  )
    .bind(verdict, JSON.stringify(checks), nowIso(), message.buildId)
    .run();

  if (verdict === "pass") {
    await enqueue(env, { ...message, stage: "outreach-prep" });
  } else {
    // Back to the founder — fix the site and resubmit via submit-preview.
    await setBuildStatus(env, message.buildId, "awaiting_manual_build");
    await env.DB.prepare("UPDATE prospects SET status = 'qa_fail', updated_at = ? WHERE id = ?")
      .bind(nowIso(), message.prospectId)
      .run();
  }
}

// --- Stage: outreach-prep --------------------------------------------------
async function runOutreachPrep(env: Env, message: BuildJobMessage): Promise<void> {
  const build = await getBuild(env, message.buildId);
  const prospect = await getProspect(env, message.prospectId);

  const script = await completeChat(env, {
    system:
      "You are helping a solo founder who cold-calls local businesses to sell them a website you already " +
      "built for them, for free, before they ever pay. Write a short call script/talking points: an opening " +
      "line referencing something specific to the business, the pitch (site is already built, no obligation, " +
      "one-time fee if they like it), and a low-pressure close. Keep it under 120 words, conversational, no " +
      "corporate jargon. Output ONLY the script text.",
    user:
      `Business: ${prospect.business_name ?? "Unknown"}\n` +
      `Category: ${prospect.category ?? "Unknown"}\n` +
      `Notes: ${prospect.notes ?? "None"}\n` +
      `Preview link: ${build.preview_url ?? "N/A"}`,
  });

  await env.DB.prepare(
    "UPDATE builds SET call_script = ?, status = 'ready', updated_at = ? WHERE id = ?"
  )
    .bind(script, nowIso(), message.buildId)
    .run();

  await env.DB.prepare("UPDATE prospects SET status = 'outreach_ready', updated_at = ? WHERE id = ?")
    .bind(nowIso(), message.prospectId)
    .run();
}

const HANDLERS: Record<string, (env: Env, message: BuildJobMessage) => Promise<void>> = {
  "brand-design": runBrandDesign,
  "sourcing-assets": runSourcingAssets,
  generating: runGenerating,
  "qa-running": runQaRunning,
  "outreach-prep": runOutreachPrep,
};

export async function runStage(env: Env, message: BuildJobMessage): Promise<void> {
  const handler = HANDLERS[message.stage];
  const jobId = await startJob(env, message.buildId, message.stage);

  if (!handler) {
    await finishJob(env, jobId, "error", `No handler for stage "${message.stage}" yet`);
    return;
  }

  try {
    await handler(env, message);
    await finishJob(env, jobId, "done");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await finishJob(env, jobId, "error", detail);
    await setBuildFailed(env, message.buildId, detail);
  }
}

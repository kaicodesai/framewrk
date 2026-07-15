import type { Build, BuildJobMessage, Env, Prospect } from "../types";
import { completeChat } from "../lib/openrouter";
import { startJob, finishJob } from "../lib/jobs";
import { CORE_CHASSIS, NON_NEGOTIABLE_CONSTRAINTS } from "./chassis";

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
// Produces the "personalization layer" that sits on top of the frozen
// CORE_CHASSIS (see chassis.ts) -- this is the one place per-business
// customization actually happens, so every field here must be specific to
// this business's niche, never a generic reused value.
async function runBrandDesign(env: Env, message: BuildJobMessage): Promise<void> {
  await setBuildStatus(env, message.buildId, "designing");
  const prospect = await getProspect(env, message.prospectId);

  const raw = await completeChat(env, {
    system:
      "You are a senior brand strategist filling in a personalization layer for a website template " +
      "system. Given a local business, produce STRICT JSON with exactly these keys: " +
      '"industry_vibe" (short phrase naming the niche and desired feeling, e.g. "boutique med spa — ' +
      'clinical calm meets quiet luxury"), "color_direction" (object with "base_tone": one of "dark ' +
      'moody"/"light airy"/"warm"/"cool", "background_gradient": array of 2-3 hex colors for the ' +
      'continuous background wash, "accent_color": one hex used exclusively for the primary CTA and key ' +
      'highlights), "imagery_style" (one of "photography"/"3D renders"/"illustration"/"product ' +
      'screenshots", chosen for this niche), "hero_bleed" (boolean — should the hero visual bleed off ' +
      'the viewport edge), "typography_personality" (one of "modern sans"/"editorial serif"/"bold ' +
      'tech"/"soft humanist", chosen for this niche), "tone_of_copy" (one of "premium & minimal"/"warm & ' +
      'approachable"/"bold & confident", chosen for this niche), "cta_goal" (the single primary action, ' +
      'e.g. "book a consultation", "call now", "get a quote"), "layout_variant" (one of "A" or "B" — A = ' +
      "minimal/cinematic single focal point, best for editorial/luxury/hospitality/personal-brand " +
      'niches; B = collage/layered multi-card composition, best for niches with a real product/service ' +
      'to visually prove), "layout_variant_reason" (one sentence on why that variant fits this specific ' +
      "business). Every value must be a deliberate choice justified by this business's actual niche — " +
      "never default to the same values you'd give a different kind of business. Output ONLY the JSON " +
      "object, no markdown fencing, no commentary.",
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

interface Personalization {
  industry_vibe?: string;
  color_direction?: {
    base_tone?: string;
    background_gradient?: string[];
    accent_color?: string;
  };
  imagery_style?: string;
  hero_bleed?: boolean;
  typography_personality?: string;
  tone_of_copy?: string;
  cta_goal?: string;
  layout_variant?: string;
  layout_variant_reason?: string;
  raw?: string;
}

function formatPersonalization(designBriefJson: string | null): string {
  if (!designBriefJson) return "None provided.";
  let parsed: Personalization;
  try {
    parsed = JSON.parse(designBriefJson) as Personalization;
  } catch {
    return designBriefJson;
  }
  if (parsed.raw) return parsed.raw;

  const gradient = parsed.color_direction?.background_gradient?.join(" → ") ?? "Unknown";
  return (
    `Industry/vibe: ${parsed.industry_vibe ?? "Unknown"}\n` +
    `Base tone: ${parsed.color_direction?.base_tone ?? "Unknown"}\n` +
    `Background gradient: ${gradient}\n` +
    `Accent color (CTA + key highlights only): ${parsed.color_direction?.accent_color ?? "Unknown"}\n` +
    `Imagery style: ${parsed.imagery_style ?? "Unknown"}\n` +
    `Hero bleeds off viewport edge: ${parsed.hero_bleed ? "yes" : "no"}\n` +
    `Typography personality: ${parsed.typography_personality ?? "Unknown"}\n` +
    `Tone of copy: ${parsed.tone_of_copy ?? "Unknown"}\n` +
    `Primary CTA goal: ${parsed.cta_goal ?? "Unknown"}\n` +
    `Layout variant: ${parsed.layout_variant ?? "Unknown"} (${parsed.layout_variant_reason ?? "no reason given"})`
  );
}

// --- Stage: generating (composes the Claude Code build prompt) ------------
// The frozen CORE_CHASSIS + NON_NEGOTIABLE_CONSTRAINTS (chassis.ts) are
// injected verbatim, in code -- not written by the LLM -- so the structural
// techniques (3D depth, section bleed, no-overlap, minimum imagery) never
// get diluted in paraphrase. The LLM's only job is the genuinely creative,
// niche-specific part: page structure and copy that actually fits this one
// business, layered on top of the frozen system.
async function runGenerating(env: Env, message: BuildJobMessage): Promise<void> {
  await setBuildStatus(env, message.buildId, "generating");
  const build = await getBuild(env, message.buildId);
  const prospect = await getProspect(env, message.prospectId);

  const tierNote =
    build.service_tier === "website_dashboard"
      ? "This site also needs a booking/ordering portal — a simple page where customers can book an appointment or place an order, with a basic admin view for the owner."
      : "This is a website-only build — no booking/ordering portal needed.";

  const personalization = formatPersonalization(build.design_brief_json);

  const nicheContent = await completeChat(env, {
    system:
      "You are a web strategist and copywriter. Given a business and its personalization layer, write " +
      "two things: (1) an appropriate page structure for this specific niche — a list of sections with a " +
      "one-line description of what each holds; (2) copywriting guidance — the actual voice, 2-3 sample " +
      "headline ideas, and language specific to this business's real specialty (use real terminology from " +
      "its niche, not generic marketing language). Everything must sound like it was written for this " +
      "exact business, never reusable for a different one. Output ONLY this content, concise, no preamble, " +
      "no markdown fencing.",
    user:
      `Business: ${prospect.business_name ?? "Unknown"}\n` +
      `Category: ${prospect.category ?? "Unknown"}\n` +
      `Address: ${prospect.address ?? "Unknown"}\n` +
      `Phone: ${prospect.phone ?? "Unknown"}\n` +
      `Notes: ${prospect.notes ?? "None"}\n` +
      `Personalization layer:\n${personalization}\n` +
      `${tierNote}`,
  });

  const prompt =
    `You are Claude Code, an expert AI coding agent. Build a complete, production-ready static website ` +
    `for "${prospect.business_name ?? "this business"}". Plain HTML, CSS, and vanilla JavaScript only — ` +
    `no build step, no framework, no npm dependencies. Mobile-responsive. Ready to deploy directly to ` +
    `Cloudflare Pages (index.html, styles.css, script.js, relative links).\n\n` +
    `${CORE_CHASSIS}\n\n` +
    `## CLIENT PERSONALIZATION\n${personalization}\n\n` +
    `## NICHE-SPECIFIC STRUCTURE & COPY\n${nicheContent}\n\n` +
    `${NON_NEGOTIABLE_CONSTRAINTS}\n\n` +
    `## BUSINESS DETAILS\n` +
    `Address: ${prospect.address ?? "Unknown — wrap any invented placeholder in an HTML comment REPLACE_WITH_REAL"}\n` +
    `Phone: ${prospect.phone ?? "Unknown — wrap any invented placeholder in an HTML comment REPLACE_WITH_REAL"}\n` +
    `Notes: ${prospect.notes ?? "None"}\n` +
    `${tierNote}\n\n` +
    `## IMAGERY\nNo real photos supplied unless referenced in notes above. Use AI-generated placeholder ` +
    `imagery (e.g. via https://image.pollinations.ai/prompt/{url-encoded description}?width=1200&height=800) ` +
    `or inline SVG, matching the imagery_style above. Vary the prompt per section for distinct imagery, ` +
    `not the same image repeated.\n\n` +
    `Build now.`;

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

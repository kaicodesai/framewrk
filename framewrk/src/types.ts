export interface Env {
  DB: D1Database;
  // Not bound yet — R2 requires a Cloudflare billing subscription, deferred
  // until the site-generation/deploy stages actually need file storage.
  SITES_BUCKET?: R2Bucket;
  BUILD_QUEUE: Queue<BuildJobMessage>;
  FRAMEWRK_DASHBOARD_TOKEN: string;
  // OpenRouter, not a direct Anthropic key — lets brand-design-agent/
  // website-builder-agent use a free-tier model instead of paid API credits.
  OPENROUTER_API_KEY: string;
  // Optional override — OpenRouter's free-tier catalog changes over time;
  // set this if the hardcoded default in lib/openrouter.ts gets retired.
  OPENROUTER_MODEL?: string;
  GOOGLE_PLACES_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

export type ServiceTier = "website" | "website_dashboard";

export type ProspectStatus =
  | "submitted"
  | "building"
  | "qa_pass"
  | "qa_fail"
  | "outreach_ready"
  | "sent"
  | "interested"
  | "paid"
  | "handed_off"
  | "closed_lost";

export type BuildStatus =
  | "queued"
  | "designing"
  | "sourcing_assets"
  | "generating"
  // Manual-build workflow (see docs/specs/framewrk-build-spec.md): the
  // pipeline pauses here once build_prompt is ready — the founder builds
  // the site with Claude Code, deploys it themselves, and submits the
  // resulting URL via POST /builds/:id/submit-preview.
  | "awaiting_manual_build"
  | "qa_running"
  | "ready"
  | "failed";

export type BuildStage =
  | "brand-design"
  | "sourcing-assets"
  | "generating"
  | "qa-running"
  | "outreach-prep"
  | "handover";

export type JobState = "pending" | "running" | "done" | "error";

export interface BuildJobMessage {
  buildId: string;
  prospectId: string;
  stage: BuildStage;
}

export interface Prospect {
  id: string;
  google_maps_url: string;
  business_name: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  google_photos_json: string | null;
  instagram_url: string | null;
  notes: string | null;
  status: ProspectStatus;
  // Categorical reason captured on markProspectLost — freeform detail still
  // belongs in `notes`, this stays a short fixed set for reportable metrics.
  lost_reason: string | null;
  // Deal value in cents — stamped automatically from fixed per-tier pricing
  // when a build starts (see lib/pricing.ts), never manually entered.
  deal_value_cents: number | null;
  // What's next on this prospect and when it's due — surfaced on the
  // Pipeline "needs action" list so a deal never goes cold silently.
  // Cleared automatically when a prospect is marked lost.
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Build {
  id: string;
  prospect_id: string;
  service_tier: ServiceTier;
  design_brief_json: string | null;
  asset_manifest_json: string | null;
  site_files_r2_prefix: string | null;
  build_prompt: string | null;
  preview_url: string | null;
  qa_verdict: "pass" | "fail" | null;
  qa_report_json: string | null;
  call_script: string | null;
  status: BuildStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  build_id: string;
  stage: string;
  state: JobState;
  detail: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityType = "call" | "email" | "sms" | "meeting" | "note";

export interface Activity {
  id: string;
  prospect_id: string;
  type: ActivityType;
  body: string | null;
  created_at: string;
}

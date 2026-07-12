-- One row per business the founder has submitted
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  google_maps_url TEXT NOT NULL,
  business_name TEXT,
  category TEXT,
  address TEXT,
  phone TEXT,
  google_photos_json TEXT,
  instagram_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One row per pipeline run (a prospect can be rebuilt/regenerated)
CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  service_tier TEXT NOT NULL,
  design_brief_json TEXT,
  asset_manifest_json TEXT,
  site_files_r2_prefix TEXT,
  preview_url TEXT,
  qa_verdict TEXT,
  qa_report_json TEXT,
  call_script TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Background job tracking (what the dashboard polls)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES builds(id),
  stage TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Payment + handover tracking
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  build_id TEXT NOT NULL REFERENCES builds(id),
  stripe_payment_link TEXT,
  stripe_payment_link_id TEXT,
  stripe_checkout_session_id TEXT,
  amount_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  handover_sent_at TEXT,
  handover_package_r2_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_builds_prospect_id ON builds(prospect_id);
CREATE INDEX IF NOT EXISTS idx_jobs_build_id ON jobs(build_id);
CREATE INDEX IF NOT EXISTS idx_payments_prospect_id ON payments(prospect_id);

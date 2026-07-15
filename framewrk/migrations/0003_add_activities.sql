-- Outreach/activity log — a timestamped feed per prospect (call, email, sms,
-- meeting, note) so outreach history is documented over time instead of
-- living in a single overwritable notes field.
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  type TEXT NOT NULL,
  body TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_prospect_id ON activities(prospect_id);

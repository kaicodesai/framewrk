-- Closes the "nothing tells you a deal is going cold" gap: an explicit
-- next-action + date per prospect, instead of relying on staleness
-- inference or hoping someone remembers.
ALTER TABLE prospects ADD COLUMN next_action TEXT;
ALTER TABLE prospects ADD COLUMN next_action_date TEXT;

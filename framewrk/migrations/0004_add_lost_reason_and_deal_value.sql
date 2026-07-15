-- Won/loss tracking: a categorical reason captured when a prospect is
-- marked lost, plus a manually-tracked deal value so revenue/win-rate
-- metrics are answerable later without waiting on the Stripe integration.
ALTER TABLE prospects ADD COLUMN lost_reason TEXT;
ALTER TABLE prospects ADD COLUMN deal_value_cents INTEGER;

import type { ServiceTier } from "../types";

// Fixed flat pricing — no manual overrides, no discounts. Deal value is
// always exactly this, derived from whichever tier the build was started
// with, so the number is never a guess and never drifts from what's stamped
// on a build.
export const PRICING_CENTS: Record<ServiceTier, number> = {
  website: 49900,
  website_dashboard: 99900,
};

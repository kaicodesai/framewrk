import { PRICING_CENTS } from './pricing'

// Pure computation over an already-fetched prospects list — no extra API
// calls. The funnel is cumulative ("reached at least this stage"), computed
// from each non-lost prospect's *current* status rank. This is only valid
// because the pipeline is linear (a prospect's status only moves forward,
// aside from a qa_fail rebuild loop that still counts as "building"), so a
// current status reliably implies every earlier stage was passed. Lost
// prospects are excluded from the funnel — we don't record how far they got
// before falling out — and reported separately.
const STATUS_RANK = {
  submitted: 0,
  building: 1,
  qa_pass: 1,
  qa_fail: 1,
  outreach_ready: 2,
  sent: 3,
  interested: 4,
  paid: 5,
  handed_off: 5,
}

export const FUNNEL_STAGES = [
  { key: 'submitted', label: 'Submitted', minRank: 0 },
  { key: 'building', label: 'Building', minRank: 1 },
  { key: 'outreach_ready', label: 'Ready for outreach', minRank: 2 },
  { key: 'sent', label: 'Sent', minRank: 3 },
  { key: 'interested', label: 'Interested', minRank: 4 },
  { key: 'won', label: 'Won', minRank: 5 },
]

export function computeFunnel(prospects) {
  const active = prospects.filter((p) => p.status !== 'closed_lost')
  return FUNNEL_STAGES.map((stage) => ({
    ...stage,
    count: active.filter((p) => (STATUS_RANK[p.status] ?? 0) >= stage.minRank).length,
  }))
}

export function computeWinLoss(prospects) {
  const won = prospects.filter((p) => p.status === 'paid' || p.status === 'handed_off').length
  const lost = prospects.filter((p) => p.status === 'closed_lost').length
  const decided = won + lost
  return { won, lost, winRate: decided > 0 ? won / decided : null }
}

export function computeRevenue(prospects) {
  const wonWithValue = prospects.filter(
    (p) => (p.status === 'paid' || p.status === 'handed_off') && p.deal_value_cents != null
  )
  const totalCents = wonWithValue.reduce((sum, p) => sum + p.deal_value_cents, 0)
  return {
    totalCents,
    avgCents: wonWithValue.length > 0 ? Math.round(totalCents / wonWithValue.length) : null,
  }
}

// Heuristic close-probability by stage — a standard sales-ops default, not
// derived from your actual history (we can't reliably compute that yet: lost
// prospects don't record how far they got before falling out, so a true
// empirical stage-conditional win rate isn't available). Revisit these once
// there's enough won/lost volume at each stage to replace the guess.
const ACTIVE_STAGE_PROBABILITY = {
  building: 0.1,
  qa_pass: 0.15,
  qa_fail: 0.1,
  outreach_ready: 0.2,
  sent: 0.3,
  interested: 0.55,
}

// Only prospects with a build started carry a deal_value_cents (fixed
// pricing is stamped at build time) — so "priced but not yet won/lost" is
// exactly the open pipeline.
export function computePipelineValue(prospects) {
  const active = prospects.filter(
    (p) => p.status in ACTIVE_STAGE_PROBABILITY && p.deal_value_cents != null
  )
  const raw = active.reduce((sum, p) => sum + p.deal_value_cents, 0)
  const weighted = active.reduce(
    (sum, p) => sum + p.deal_value_cents * (ACTIVE_STAGE_PROBABILITY[p.status] ?? 0),
    0
  )
  return { raw, weighted: Math.round(weighted) }
}

export const ANNUAL_GOAL_CENTS = 100_000_000 // $1,000,000/year
const BLENDED_DEFAULT_DEAL_CENTS = Math.round(
  (PRICING_CENTS.website + PRICING_CENTS.website_dashboard) / 2
)
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Trailing-30-day run rate, annualized — avoids calendar-year-boundary
// edge cases (works from day one, regardless of when in the year it's run).
export function computePacing(prospects, revenueTotals) {
  const now = Date.now()
  const last30Cents = prospects
    .filter(
      (p) =>
        (p.status === 'paid' || p.status === 'handed_off') &&
        p.deal_value_cents != null &&
        now - new Date(p.updated_at).getTime() <= 30 * MS_PER_DAY
    )
    .reduce((sum, p) => sum + p.deal_value_cents, 0)

  const annualRunRateCents = Math.round((last30Cents / 30) * 365)
  const monthlyGoalCents = Math.round(ANNUAL_GOAL_CENTS / 12)
  const monthlyGapCents = Math.max(0, monthlyGoalCents - last30Cents)
  const avgDealCents = revenueTotals?.avgCents ?? BLENDED_DEFAULT_DEAL_CENTS
  const extraDealsPerMonth = avgDealCents > 0 ? Math.ceil(monthlyGapCents / avgDealCents) : null

  return {
    last30Cents,
    annualRunRateCents,
    monthlyGoalCents,
    monthlyGapCents,
    avgDealCents,
    extraDealsPerMonth,
    onPace: annualRunRateCents >= ANNUAL_GOAL_CENTS,
  }
}

export const LOST_REASON_LABELS = {
  no_response: 'No response',
  not_interested: 'Not interested',
  price: 'Price',
  chose_competitor: 'Chose a competitor',
  other: 'Other',
}

export function computeLossReasons(prospects) {
  const lost = prospects.filter((p) => p.status === 'closed_lost')
  const counts = {}
  for (const p of lost) {
    const key = p.lost_reason || 'unspecified'
    counts[key] = (counts[key] || 0) + 1
  }
  return Object.entries(counts)
    .map(([key, count]) => ({ key, label: LOST_REASON_LABELS[key] || 'Unspecified', count }))
    .sort((a, b) => b.count - a.count)
}

export function formatCents(cents) {
  if (cents === null || cents === undefined) return null
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

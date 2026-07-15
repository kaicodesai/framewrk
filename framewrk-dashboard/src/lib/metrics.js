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

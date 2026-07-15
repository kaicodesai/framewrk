import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Panel from '../components/Panel'
import StatTile from '../components/StatTile'
import { api } from '../lib/api'
import {
  computeFunnel,
  computeWinLoss,
  computeRevenue,
  computeLossReasons,
  computePipelineValue,
  computePacing,
  formatCents,
} from '../lib/metrics'

// Validated ordinal ramp (one hue, monotone lightness, light end clears the
// paper surface at 2.35:1) — see dataviz skill validate_palette.js --ordinal.
const FUNNEL_RAMP = ['#8FAE2E', '#7A9924', '#66841C', '#536F14', '#405A0D', '#2E4508']
const LOSS_BAR_COLOR = '#C81E44' // single hue, nominal categorical (one series) — reuses `danger`

function FunnelChart({ stages }) {
  const max = stages[0]?.count || 0

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, i) => {
        const widthPct = max > 0 ? (stage.count / max) * 100 : 0
        const pctOfTotal = max > 0 ? Math.round((stage.count / max) * 100) : null
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <div className="w-40 shrink-0 font-mono text-xs text-muted">{stage.label}</div>
            <div className="flex-1 h-6 bg-surface-hover">
              <div
                className="h-6 rounded-r-md transition-all"
                style={{ width: `${widthPct}%`, backgroundColor: FUNNEL_RAMP[i % FUNNEL_RAMP.length] }}
              />
            </div>
            <div className="w-24 shrink-0 text-right font-mono text-xs text-ink">
              {stage.count}
              {i > 0 && pctOfTotal !== null && <span className="text-faint"> · {pctOfTotal}%</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LossReasonChart({ reasons }) {
  if (reasons.length === 0) {
    return <div className="font-mono text-sm text-muted">No lost prospects yet.</div>
  }
  const max = reasons[0].count

  return (
    <div className="flex flex-col gap-3">
      {reasons.map((r) => {
        const widthPct = (r.count / max) * 100
        return (
          <div key={r.key} className="flex items-center gap-3">
            <div className="w-40 shrink-0 font-mono text-xs text-muted">{r.label}</div>
            <div className="flex-1 h-6 bg-surface-hover">
              <div
                className="h-6 rounded-r-md"
                style={{ width: `${widthPct}%`, backgroundColor: LOSS_BAR_COLOR }}
              />
            </div>
            <div className="w-10 shrink-0 text-right font-mono text-xs text-ink">{r.count}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function Metrics() {
  const [prospects, setProspects] = useState([])
  const [buildMetrics, setBuildMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [prospectList, metrics] = await Promise.all([api.listProspects(), api.getMetrics()])
        setProspects(prospectList)
        setBuildMetrics(metrics)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="font-mono text-sm text-muted">loading…</div>
  if (error) return <div className="font-mono text-sm text-danger">{error}</div>

  const funnel = computeFunnel(prospects)
  const { won, lost, winRate } = computeWinLoss(prospects)
  const revenue = computeRevenue(prospects)
  const { totalCents, avgCents } = revenue
  const lossReasons = computeLossReasons(prospects)
  const avgBuildHours = buildMetrics?.avg_build_hours
  const pipeline = computePipelineValue(prospects)
  const pacing = computePacing(prospects, revenue)

  return (
    <div>
      <PageHeader eyebrow="Performance" title="Metrics" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatTile label="Win rate" value={winRate !== null ? `${Math.round(winRate * 100)}%` : '—'} />
        <StatTile label="Revenue (won)" value={formatCents(totalCents) || '$0.00'} />
        <StatTile label="Avg deal value" value={formatCents(avgCents) || '—'} />
        <StatTile
          label="Avg time to build-ready"
          value={
            avgBuildHours != null
              ? avgBuildHours < 48
                ? `${Math.round(avgBuildHours)}h`
                : `${(avgBuildHours / 24).toFixed(1)}d`
              : '—'
          }
        />
      </div>

      <Panel className="p-6 mb-10">
        <div className="flex items-center justify-between mb-5">
          <div className="label-caps">Pacing to $1,000,000/year</div>
          <span
            className={`font-mono text-xs px-2 py-1 border ${
              pacing.onPace ? 'border-acid-text text-acid-text' : 'border-danger text-danger'
            }`}
          >
            {pacing.onPace ? 'ON PACE' : 'BEHIND PACE'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="label-caps mb-1">Weighted pipeline</div>
            <div className="font-display text-2xl text-ink">{formatCents(pipeline.weighted) || '$0.00'}</div>
            <div className="font-mono text-xs text-faint">{formatCents(pipeline.raw) || '$0.00'} raw</div>
          </div>
          <div>
            <div className="label-caps mb-1">Last 30 days</div>
            <div className="font-display text-2xl text-ink">{formatCents(pacing.last30Cents) || '$0.00'}</div>
          </div>
          <div>
            <div className="label-caps mb-1">Run-rate pace</div>
            <div className="font-display text-2xl text-ink">
              {formatCents(pacing.annualRunRateCents) || '$0.00'}
            </div>
            <div className="font-mono text-xs text-faint">annualized / yr</div>
          </div>
          <div>
            <div className="label-caps mb-1">Monthly gap</div>
            <div className="font-display text-2xl text-ink">
              {pacing.monthlyGapCents > 0 ? formatCents(pacing.monthlyGapCents) : '$0.00'}
            </div>
            {pacing.monthlyGapCents > 0 && pacing.extraDealsPerMonth !== null && (
              <div className="font-mono text-xs text-faint">
                ~{pacing.extraDealsPerMonth} more deal{pacing.extraDealsPerMonth === 1 ? '' : 's'}/mo
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="p-6 mb-10">
        <div className="label-caps mb-5">Conversion funnel</div>
        {prospects.length === 0 ? (
          <div className="font-mono text-sm text-muted">No prospects yet.</div>
        ) : (
          <FunnelChart stages={funnel} />
        )}
      </Panel>

      <Panel className="p-6">
        <div className="flex items-baseline justify-between mb-5">
          <div className="label-caps">Lost prospects</div>
          <div className="font-mono text-xs text-muted">
            {lost} lost · {won} won
          </div>
        </div>
        <LossReasonChart reasons={lossReasons} />
      </Panel>
    </div>
  )
}

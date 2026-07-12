import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Panel from '../components/Panel'
import Button from '../components/Button'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'

export default function Pipeline() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [mapsUrl, setMapsUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.listProspects()
      setProspects(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!mapsUrl.trim()) return
    setSubmitting(true)
    setFormError(null)
    try {
      await api.createProspect(mapsUrl.trim(), notes.trim() || undefined)
      setMapsUrl('')
      setNotes('')
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const counts = prospects.reduce(
    (acc, p) => {
      acc.total += 1
      if (p.status === 'building') acc.building += 1
      if (p.status === 'outreach_ready') acc.ready += 1
      if (p.status === 'paid' || p.status === 'handed_off') acc.paid += 1
      return acc
    },
    { total: 0, building: 0, ready: 0, paid: 0 }
  )

  return (
    <div>
      <PageHeader eyebrow="Home base" title="Pipeline" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatTile label="Total prospects" value={counts.total} />
        <StatTile label="Building" value={counts.building} />
        <StatTile label="Ready for outreach" value={counts.ready} />
        <StatTile label="Paid / handed off" value={counts.paid} />
      </div>

      <Panel className="p-6 mb-10">
        <div className="label-caps mb-4">New prospect</div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="url"
            required
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            placeholder="paste Google Maps / Business Profile link"
            className="bg-surface border border-line px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-acid"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="notes (optional) — no website, looked busy, etc."
            className="bg-surface border border-line px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-acid"
          />
          <div className="flex items-center justify-between">
            {formError && <span className="text-xs text-danger font-mono">{formError}</span>}
            <Button type="submit" disabled={submitting} className="ml-auto">
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </Panel>

      <div className="label-caps mb-4">All prospects</div>

      {loading && <div className="font-mono text-sm text-muted">loading…</div>}
      {error && <div className="font-mono text-sm text-danger">{error}</div>}

      {!loading && !error && prospects.length === 0 && (
        <div className="font-mono text-sm text-muted border border-line p-6">
          Nothing here yet — submit your first Google Maps link above.
        </div>
      )}

      {!loading && prospects.length > 0 && (
        <div className="border border-line">
          {prospects.map((p) => (
            <Link
              key={p.id}
              to={`/prospects/${p.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line last:border-b-0 hover:bg-surface-hover hover:border-l-2 hover:border-l-acid transition-colors"
            >
              <div className="min-w-0">
                <div className="text-ink font-medium truncate">
                  {p.business_name || 'Unnamed business'}
                </div>
                <div className="font-mono text-xs text-muted truncate">
                  {p.category || 'uncategorized'} · {p.address || 'no address on file'}
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <span className="font-mono text-xs text-faint">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

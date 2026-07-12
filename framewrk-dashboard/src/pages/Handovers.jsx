import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'

const RELEVANT_STATUSES = ['paid', 'handed_off']

export default function Handovers() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.listProspects()
        setProspects(data.filter((p) => RELEVANT_STATUSES.includes(p.status)))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      <PageHeader eyebrow="Paid clients" title="Handovers" />

      <div className="mb-6 font-mono text-xs text-muted border border-line p-4">
        Automated code + domain-instructions handover isn't built yet (Stripe
        webhook stage) — this list is just paid/handed-off status for now.
      </div>

      {loading && <div className="font-mono text-sm text-muted">loading…</div>}
      {error && <div className="font-mono text-sm text-danger">{error}</div>}

      {!loading && !error && prospects.length === 0 && (
        <div className="font-mono text-sm text-muted border border-line p-6">
          No paid clients yet.
        </div>
      )}

      {!loading && prospects.length > 0 && (
        <div className="border border-line">
          {prospects.map((p) => (
            <Link
              key={p.id}
              to={`/prospects/${p.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line last:border-b-0 hover:bg-surface-hover transition-colors"
            >
              <div className="text-ink font-medium">{p.business_name || 'Unnamed business'}</div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

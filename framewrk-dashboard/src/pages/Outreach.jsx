import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Panel from '../components/Panel'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'

const RELEVANT_STATUSES = ['outreach_ready', 'sent', 'interested']

export default function Outreach() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [rowMessage, setRowMessage] = useState({})

  async function load() {
    setLoading(true)
    try {
      const data = await api.listProspects()
      setProspects(data.filter((p) => RELEVANT_STATUSES.includes(p.status)))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSendPaymentLink(id) {
    setSendingId(id)
    try {
      await api.sendPaymentLink(id)
      setRowMessage((m) => ({ ...m, [id]: { ok: true, text: 'Payment link sent' } }))
      await load()
    } catch (err) {
      setRowMessage((m) => ({ ...m, [id]: { ok: false, text: err.message } }))
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Close the loop" title="Outreach" />

      {loading && <div className="font-mono text-sm text-muted">loading…</div>}
      {error && <div className="font-mono text-sm text-danger">{error}</div>}

      {!loading && !error && prospects.length === 0 && (
        <div className="font-mono text-sm text-muted border border-line p-6">
          Nothing ready for outreach yet — builds show up here once they pass QA.
        </div>
      )}

      {!loading && prospects.length > 0 && (
        <div className="border border-line">
          {prospects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line last:border-b-0"
            >
              <Link to={`/prospects/${p.id}`} className="min-w-0 hover:text-acid-text transition-colors">
                <div className="text-ink font-medium truncate">
                  {p.business_name || 'Unnamed business'}
                </div>
                <div className="font-mono text-xs text-muted truncate">
                  {p.phone || 'no phone on file'}
                </div>
              </Link>
              <div className="flex items-center gap-4 shrink-0">
                {rowMessage[p.id] && (
                  <span
                    className={`font-mono text-xs ${
                      rowMessage[p.id].ok ? 'text-acid-text' : 'text-danger'
                    }`}
                  >
                    {rowMessage[p.id].text}
                  </span>
                )}
                <StatusBadge status={p.status} />
                <Button
                  variant="ghost"
                  disabled={sendingId === p.id}
                  onClick={() => handleSendPaymentLink(p.id)}
                >
                  {sendingId === p.id ? 'Sending…' : 'Send payment link'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

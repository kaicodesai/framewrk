import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Panel from '../components/Panel'
import Button from '../components/Button'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'
import { statusInfo } from '../lib/status'
import { parseProspectsCsv } from '../lib/csv'
import { actionUrgency, actionDateLabel } from '../lib/nextAction'

const PROSPECT_STATUSES = [
  'submitted',
  'building',
  'qa_pass',
  'qa_fail',
  'outreach_ready',
  'sent',
  'interested',
  'paid',
  'handed_off',
  'closed_lost',
]

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'recently_updated', label: 'Recently updated' },
  { key: 'name', label: 'Name A–Z' },
]

function sortProspects(prospects, sortBy) {
  const sorted = [...prospects]
  if (sortBy === 'oldest') {
    sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  } else if (sortBy === 'recently_updated') {
    sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  } else if (sortBy === 'name') {
    sorted.sort((a, b) => (a.business_name || '').localeCompare(b.business_name || ''))
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }
  return sorted
}

function BulkImportPanel({ onImported }) {
  const [csvText, setCsvText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const { rows, headerRecognized, unrecognizedHeaders } = parseProspectsCsv(csvText)
  const validRows = rows.filter((r) => r.business_name)
  const missingNameCount = rows.length - validRows.length

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function handleImport() {
    if (validRows.length === 0) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const summary = await api.bulkCreateProspects(validRows)
      setResult(summary)
      setCsvText('')
      await onImported()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-muted font-mono">
        Paste CSV or upload a file — works with a Google Sheets / Maps-scrape export or an
        Apollo.io export as-is (Company/Industry/Corporate Phone/Company Address etc. are all
        recognized), or your own business_name/category/address/phone/notes columns. Needs a
        header row.
      </div>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        className="font-mono text-xs text-muted"
      />
      <textarea
        rows={6}
        value={csvText}
        onChange={(e) => {
          setCsvText(e.target.value)
          setResult(null)
        }}
        placeholder={'business_name,category,address,phone,notes\nAce Plumbing,plumber,123 Main St,555-0100,referral'}
        className="w-full bg-surface border border-line px-3 py-2 font-mono text-xs text-ink placeholder:text-faint focus:outline-none focus:border-acid"
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted">
          {csvText.trim() === ''
            ? 'no rows yet'
            : !headerRecognized
              ? "couldn't recognize any columns in the header — see below"
              : `${validRows.length} row${validRows.length === 1 ? '' : 's'} ready` +
                (missingNameCount > 0 ? ` · ${missingNameCount} skipped (missing business_name)` : '')}
        </span>
        <Button type="button" disabled={submitting || validRows.length === 0} onClick={handleImport}>
          {submitting ? 'Importing…' : `Import ${validRows.length || ''}`.trim()}
        </Button>
      </div>
      {csvText.trim() !== '' && !headerRecognized && (
        <div className="text-xs text-danger font-mono">
          Didn't recognize any of these header columns: {unrecognizedHeaders.join(', ')}. Rename at
          least one to something like business_name/company, category/industry, address, or
          phone — nothing was imported.
        </div>
      )}
      {error && <div className="text-xs text-danger font-mono">{error}</div>}
      {result && (
        <div className="text-xs text-acid-text font-mono">
          Created {result.created} · skipped {result.skipped_duplicates} duplicate
          {result.skipped_duplicates === 1 ? '' : 's'}
          {result.skipped_invalid > 0 ? ` · skipped ${result.skipped_invalid} invalid` : ''}
        </div>
      )}
    </div>
  )
}

export default function Pipeline() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [mode, setMode] = useState('maps') // 'maps' | 'manual' | 'bulk'
  const [mapsUrl, setMapsUrl] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

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
    if (mode === 'maps' && !mapsUrl.trim()) return
    if (mode === 'manual' && !businessName.trim()) return
    setSubmitting(true)
    setFormError(null)
    try {
      await api.createProspect({
        google_maps_url: mode === 'maps' ? mapsUrl.trim() : undefined,
        business_name: mode === 'manual' ? businessName.trim() : undefined,
        notes: notes.trim() || undefined,
      })
      setMapsUrl('')
      setBusinessName('')
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

  const needsAction = prospects
    .filter((p) => p.status !== 'closed_lost' && ['overdue', 'today'].includes(actionUrgency(p.next_action_date)))
    .sort((a, b) => new Date(a.next_action_date) - new Date(b.next_action_date))

  const searchLower = search.trim().toLowerCase()
  const visibleProspects = sortProspects(
    prospects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!searchLower) return true
      return [p.business_name, p.category, p.address]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(searchLower))
    }),
    sortBy
  )

  return (
    <div>
      <PageHeader eyebrow="Home base" title="Pipeline" />

      {needsAction.length > 0 && (
        <Panel className="p-6 mb-10 border-2 border-danger">
          <div className="label-caps mb-4 text-danger">
            Needs action — {needsAction.length} overdue or due today
          </div>
          <div className="flex flex-col gap-3">
            {needsAction.map((p) => {
              const urgency = actionUrgency(p.next_action_date)
              return (
                <Link
                  key={p.id}
                  to={`/prospects/${p.id}`}
                  className="flex items-center justify-between gap-4 hover:bg-surface-hover px-2 py-1 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-ink font-medium">{p.business_name || 'Unnamed business'}</span>
                    <span className="font-mono text-xs text-muted"> — {p.next_action || 'follow up'}</span>
                  </div>
                  <span
                    className={`font-mono text-xs shrink-0 ${urgency === 'overdue' ? 'text-danger' : 'text-info'}`}
                  >
                    {actionDateLabel(p.next_action_date)}
                  </span>
                </Link>
              )
            })}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatTile label="Total prospects" value={counts.total} />
        <StatTile label="Building" value={counts.building} />
        <StatTile label="Ready for outreach" value={counts.ready} />
        <StatTile label="Paid / handed off" value={counts.paid} />
      </div>

      <Panel className="p-6 mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="label-caps">New prospect</div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'maps' ? 'primary' : 'ghost'}
              onClick={() => setMode('maps')}
            >
              Google Maps link
            </Button>
            <Button
              type="button"
              variant={mode === 'manual' ? 'primary' : 'ghost'}
              onClick={() => setMode('manual')}
            >
              Manual entry
            </Button>
            <Button
              type="button"
              variant={mode === 'bulk' ? 'primary' : 'ghost'}
              onClick={() => setMode('bulk')}
            >
              Bulk import
            </Button>
          </div>
        </div>
        {mode === 'bulk' ? (
          <BulkImportPanel onImported={load} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'maps' ? (
              <input
                type="url"
                required
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="paste Google Maps / Business Profile link"
                className="bg-surface border border-line px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-acid"
              />
            ) : (
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="business name — e.g. a referral not found on Google Maps"
                className="bg-surface border border-line px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-acid"
              />
            )}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="notes (optional) — category, address, phone, no website, etc."
              className="bg-surface border border-line px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-acid"
            />
            <div className="flex items-center justify-between">
              {formError && <span className="text-xs text-danger font-mono">{formError}</span>}
              <Button type="submit" disabled={submitting} className="ml-auto">
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </form>
        )}
      </Panel>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="label-caps">All prospects</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search name, category, address…"
            className="bg-surface border border-line px-3 py-2 font-mono text-xs text-ink placeholder:text-faint focus:outline-none focus:border-acid w-56"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface border border-line px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:border-acid"
          >
            <option value="all">All statuses</option>
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusInfo(s).label}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface border border-line px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:border-acid"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="font-mono text-sm text-muted">loading…</div>}
      {error && <div className="font-mono text-sm text-danger">{error}</div>}

      {!loading && !error && prospects.length === 0 && (
        <div className="font-mono text-sm text-muted border border-line p-6">
          Nothing here yet — submit your first prospect above, via Google Maps link or manual entry.
        </div>
      )}

      {!loading && prospects.length > 0 && visibleProspects.length === 0 && (
        <div className="font-mono text-sm text-muted border border-line p-6">
          No prospects match your search/filter.
        </div>
      )}

      {!loading && visibleProspects.length > 0 && (
        <div className="border border-line">
          {visibleProspects.map((p) => (
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

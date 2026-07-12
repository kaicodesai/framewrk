import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Panel from '../components/Panel'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'

const BUILD_STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'designing', label: 'Brand design' },
  { key: 'sourcing_assets', label: 'Sourcing assets' },
  { key: 'generating', label: 'Composing build prompt' },
  { key: 'awaiting_manual_build', label: 'Awaiting manual build' },
  { key: 'qa_running', label: 'QA' },
  { key: 'ready', label: 'Ready' },
]

function CopyPromptBlock({ prompt }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="label-caps">Build prompt — paste into Claude Code</div>
        <Button variant="ghost" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="text-xs text-ink whitespace-pre-wrap border border-line p-4 bg-surface max-h-96 overflow-y-auto">
        {prompt}
      </pre>
    </div>
  )
}

function SubmitPreviewForm({ buildId, onSubmitted }) {
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.submitPreview(buildId, url.trim())
      setUrl('')
      await onSubmitted()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="label-caps mb-2">
        Once it's live — paste the Cloudflare Pages URL
      </div>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-build.pages.dev"
          className="flex-1 bg-surface border border-line px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-acid"
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </form>
      {error && <div className="mt-2 text-xs text-danger font-mono">{error}</div>}
    </div>
  )
}

function BusinessInfoPanel({ prospect, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    business_name: prospect.business_name ?? '',
    category: prospect.category ?? '',
    address: prospect.address ?? '',
    phone: prospect.phone ?? '',
    notes: prospect.notes ?? '',
  })

  function startEditing() {
    setForm({
      business_name: prospect.business_name ?? '',
      category: prospect.category ?? '',
      address: prospect.address ?? '',
      phone: prospect.phone ?? '',
      notes: prospect.notes ?? '',
    })
    setError(null)
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.updateProspect(prospect.id, form)
      await onSaved()
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <Panel className="p-6">
        <div className="label-caps mb-4">Business info</div>
        <form onSubmit={handleSave} className="space-y-3">
          {[
            ['business_name', 'business name'],
            ['category', 'category'],
            ['address', 'address'],
            ['phone', 'phone'],
          ].map(([field, label]) => (
            <div key={field}>
              <label className="text-faint font-mono text-xs block mb-1">{label}</label>
              <input
                type="text"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full bg-surface border border-line px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:border-acid"
              />
            </div>
          ))}
          <div>
            <label className="text-faint font-mono text-xs block mb-1">notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-surface border border-line px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:border-acid"
            />
          </div>
          {error && <div className="text-xs text-danger font-mono">{error}</div>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </Panel>
    )
  }

  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="label-caps">Business info</div>
        <Button variant="ghost" onClick={startEditing}>
          Edit
        </Button>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-faint font-mono text-xs">category</dt>
          <dd className="text-ink">{prospect.category || '—'}</dd>
        </div>
        <div>
          <dt className="text-faint font-mono text-xs">address</dt>
          <dd className="text-ink">{prospect.address || '—'}</dd>
        </div>
        <div>
          <dt className="text-faint font-mono text-xs">phone</dt>
          <dd className="text-ink">{prospect.phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-faint font-mono text-xs">google maps</dt>
          <dd>
            <a
              href={prospect.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="text-acid-text underline break-all text-xs font-mono"
            >
              view listing
            </a>
          </dd>
        </div>
        {prospect.notes && (
          <div>
            <dt className="text-faint font-mono text-xs">notes</dt>
            <dd className="text-ink whitespace-pre-wrap">{prospect.notes}</dd>
          </div>
        )}
      </dl>
    </Panel>
  )
}

function BuildProgress({ build, onReload }) {
  if (!build) return null
  const failed = build.status === 'failed'
  const currentIndex = BUILD_STAGES.findIndex((s) => s.key === build.status)
  const qaFailed = build.qa_verdict === 'fail' && build.status === 'awaiting_manual_build'

  return (
    <Panel className="p-6">
      <div className="label-caps mb-5">
        Build · {build.service_tier === 'website_dashboard' ? 'Website + Dashboard' : 'Website'}
      </div>
      <div className="flex flex-col gap-0">
        {BUILD_STAGES.map((stage, i) => {
          const done = !failed && currentIndex >= 0 && i < currentIndex
          const current = !failed && i === currentIndex
          return (
            <div key={stage.key} className="flex items-center gap-3 py-1.5">
              <span
                className={`w-2 h-2 shrink-0 ${
                  done || current ? 'bg-acid' : 'bg-faint'
                } ${current ? 'animate-pulse' : ''}`}
              />
              <span className={`font-mono text-xs ${current ? 'text-acid-text' : done ? 'text-ink' : 'text-faint'}`}>
                {stage.label}
              </span>
            </div>
          )
        })}
        {failed && (
          <div className="mt-3 pt-3 border-t border-line">
            <div className="font-mono text-xs text-danger mb-1">FAILED</div>
            {build.error && <div className="text-sm text-muted">{build.error}</div>}
          </div>
        )}
      </div>

      {qaFailed && (
        <div className="mt-6 pt-6 border-t border-line">
          <div className="font-mono text-xs text-danger mb-2">
            QA failed on the last submission — fix and resubmit
          </div>
          {build.qa_report_json && (
            <pre className="text-xs text-muted whitespace-pre-wrap border border-line p-3 bg-surface">
              {JSON.stringify(JSON.parse(build.qa_report_json), null, 2)}
            </pre>
          )}
        </div>
      )}

      {build.build_prompt && (
        <div className="mt-6 pt-6 border-t border-line">
          <CopyPromptBlock prompt={build.build_prompt} />
        </div>
      )}

      {build.status === 'awaiting_manual_build' && (
        <div className="mt-6 pt-6 border-t border-line">
          <SubmitPreviewForm buildId={build.id} onSubmitted={onReload} />
        </div>
      )}

      {build.status === 'qa_running' && (
        <div className="mt-6 pt-6 border-t border-line font-mono text-xs text-muted">
          Running automated checks against the submitted preview link…
        </div>
      )}

      {build.status === 'ready' && (
        <div className="mt-6 pt-6 border-t border-line space-y-4">
          {build.preview_url && (
            <div>
              <div className="label-caps mb-2">Preview link</div>
              <a
                href={build.preview_url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-acid-text underline break-all"
              >
                {build.preview_url}
              </a>
            </div>
          )}
          {build.call_script && (
            <div>
              <div className="label-caps mb-2">Call script</div>
              <div className="text-sm text-ink whitespace-pre-wrap border border-line p-4 bg-surface">
                {build.call_script}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

export default function ProspectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prospect, setProspect] = useState(null)
  const [error, setError] = useState(null)
  const [buildingTier, setBuildingTier] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.getProspect(id)
      setProspect(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load()
  }, [load])

  // Poll while the latest build is still in flight.
  useEffect(() => {
    const latestBuild = prospect?.builds?.[0]
    if (!latestBuild || ['awaiting_manual_build', 'ready', 'failed'].includes(latestBuild.status)) {
      return
    }
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [prospect, load])

  async function handleBuild(tier) {
    setBuildingTier(tier)
    try {
      await api.startBuild(id, tier)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBuildingTier(null)
    }
  }

  async function handleMarkLost() {
    try {
      await api.markProspectLost(id)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !prospect) {
    return <div className="font-mono text-sm text-danger">{error}</div>
  }
  if (!prospect) {
    return <div className="font-mono text-sm text-muted">loading…</div>
  }

  const latestBuild = prospect.builds?.[0]
  const hasActiveBuild = latestBuild && !['failed'].includes(latestBuild.status)

  return (
    <div>
      <PageHeader
        eyebrow="Prospect"
        title={prospect.business_name || 'Unnamed business'}
        action={<StatusBadge status={prospect.status} />}
      />

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <BusinessInfoPanel prospect={prospect} onSaved={load} />

          <Panel className="p-6 space-y-3">
            <div className="label-caps mb-1">
              {hasActiveBuild ? 'Start a new build' : 'Start a build'}
            </div>
            {hasActiveBuild && (
              <div className="text-xs text-muted font-mono mb-1">
                Regenerates the design brief and build prompt from scratch — useful for testing
                prompt changes without creating a new prospect. The previous build stays in history.
              </div>
            )}
            <Button
              className="w-full"
              disabled={buildingTier !== null}
              onClick={() => handleBuild('website')}
            >
              {buildingTier === 'website' ? 'Starting…' : 'Build website'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={buildingTier !== null}
              onClick={() => handleBuild('website_dashboard')}
            >
              {buildingTier === 'website_dashboard' ? 'Starting…' : 'Build website + dashboard'}
            </Button>
          </Panel>

          <Button variant="danger" className="w-full" onClick={handleMarkLost}>
            Mark as lost
          </Button>
        </div>

        <div className="md:col-span-2">
          {latestBuild ? (
            <BuildProgress build={latestBuild} onReload={load} />
          ) : (
            <Panel className="p-6">
              <div className="font-mono text-sm text-muted">
                No build started yet.
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

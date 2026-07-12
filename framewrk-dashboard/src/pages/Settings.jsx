import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Panel from '../components/Panel'
import Button from '../components/Button'
import { getToken, setToken, checkConnection } from '../lib/api'

export default function Settings() {
  const [tokenInput, setTokenInput] = useState(getToken())
  const [status, setStatus] = useState(null) // null | 'checking' | { ok, message }

  useEffect(() => {
    runCheck()
  }, [])

  async function runCheck() {
    setStatus('checking')
    const result = await checkConnection()
    setStatus(result)
  }

  function handleSave(e) {
    e.preventDefault()
    setToken(tokenInput.trim())
    runCheck()
  }

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Settings" />

      <Panel className="p-6 max-w-xl">
        <div className="label-caps mb-3">Dashboard token</div>
        <p className="text-sm text-muted mb-4">
          Must match the <span className="font-mono text-ink">FRAMEWRK_DASHBOARD_TOKEN</span>{' '}
          secret set on the Worker. Stored only in this browser's local storage.
        </p>
        <form onSubmit={handleSave} className="flex gap-3">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="paste token"
            className="flex-1 bg-surface border border-line px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-acid"
          />
          <Button type="submit">Save</Button>
        </form>

        <div className="mt-6 pt-6 border-t border-line">
          <div className="label-caps mb-2">Connection</div>
          {status === 'checking' && (
            <div className="font-mono text-sm text-muted">checking...</div>
          )}
          {status && status !== 'checking' && status.ok && (
            <div className="font-mono text-sm text-acid-text">● connected</div>
          )}
          {status && status !== 'checking' && !status.ok && (
            <div className="font-mono text-sm text-danger">
              ● {status.message}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

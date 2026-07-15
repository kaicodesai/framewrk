import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../lib/api'
import { actionUrgency } from '../lib/nextAction'

const NAV = [
  { to: '/', label: 'Pipeline', end: true, badgeKey: 'needsAction' },
  { to: '/outreach', label: 'Outreach', badgeKey: 'needsOutreach' },
  { to: '/handovers', label: 'Handovers' },
  { to: '/metrics', label: 'Metrics' },
  { to: '/settings', label: 'Settings' },
]

const POLL_MS = 30000

function NavItem({ to, label, end, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 font-mono text-xs uppercase tracking-widest2 pb-1 border-b-2 transition-colors ${
          isActive
            ? 'border-acid-text text-acid-text'
            : 'border-transparent text-muted hover:text-ink'
        }`
      }
    >
      {label}
      {badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-acid text-ink text-[10px] font-bold rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const [needsOutreach, setNeedsOutreach] = useState(0)
  const [needsAction, setNeedsAction] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const prospects = await api.listProspects()
        if (!cancelled) {
          const outreachCount = prospects.filter((p) => p.status === 'outreach_ready').length
          const actionCount = prospects.filter(
            (p) => p.status !== 'closed_lost' && ['overdue', 'today'].includes(actionUrgency(p.next_action_date))
          ).length
          setNeedsOutreach(outreachCount)
          setNeedsAction(actionCount)
          const total = outreachCount + actionCount
          document.title = total > 0 ? `(${total}) Framewrk` : 'Framewrk'
        }
      } catch {
        // Silent — this is a passive signal, not worth surfacing a fetch error for.
      }
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const badges = { needsOutreach, needsAction }

  return (
    <div className="min-h-screen bg-paper grid-noise">
      <header className="border-b border-line px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-acid" />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            FRAMEWRK
          </span>
        </div>
        <nav className="flex items-center gap-8">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} badge={item.badgeKey ? badges[item.badgeKey] : 0} />
          ))}
        </nav>
      </header>
      <main className="px-6 md:px-10 py-10 max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}

import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Pipeline', end: true },
  { to: '/outreach', label: 'Outreach' },
  { to: '/handovers', label: 'Handovers' },
  { to: '/settings', label: 'Settings' },
]

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `font-mono text-xs uppercase tracking-widest2 pb-1 border-b-2 transition-colors ${
          isActive
            ? 'border-acid-text text-acid-text'
            : 'border-transparent text-muted hover:text-ink'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function Layout() {
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
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </header>
      <main className="px-6 md:px-10 py-10 max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}

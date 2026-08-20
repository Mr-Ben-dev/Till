import { NavLink, Outlet, useOutletContext } from 'react-router-dom'
import type { TillState } from '../../hooks/useTill'
import { McpIssuer } from '../../components/docs/McpIssuer'

const NAV = [
  {
    label: 'Get started',
    items: [
      { to: '/developers', end: true, label: 'Overview' },
      { to: '/developers/quickstart', label: 'Quick start' },
    ],
  },
  {
    label: 'Core',
    items: [
      { to: '/developers/core', label: 'Till, policy, session' },
      { to: '/developers/architecture', label: 'Architecture' },
      { to: '/developers/proof', label: 'Proof' },
    ],
  },
  {
    label: 'Build',
    items: [
      { to: '/developers/mcp', label: 'Connect your agent' },
      { to: '/developers/cursor', label: 'Cursor' },
      { to: '/developers/claude', label: 'Claude Code' },
      { to: '/developers/sdk', label: 'SDK' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { to: '/developers/reference', label: 'API · tools' },
      { to: '/developers/contracts', label: 'Contracts' },
      { to: '/developers/security', label: 'Proof & security' },
    ],
  },
]

export function DocsShell({ till }: { till: TillState }) {
  return (
    <div className="docs-shell">
      <aside className="docs-side">
        <p className="docs-side__kicker">Docs</p>
        {NAV.map((g) => (
          <div key={g.label}>
            <p className="docs-side__group">{g.label}</p>
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `docs-side__link ${isActive ? 'is-on' : ''}`}>
                {i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <div className="docs-main">
        <Outlet context={till} />
      </div>
    </div>
  )
}

export function DocsOauth() {
  const till = useOutletContext<TillState>()
  return (
    <article className="docs-article">
      <p className="docs-kicker">OAuth</p>
      <h1>Authorize Till MCP</h1>
      <McpIssuer till={till} />
    </article>
  )
}

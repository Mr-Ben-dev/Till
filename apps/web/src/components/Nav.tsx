import { NavLink, useLocation } from 'react-router-dom'
import { CyanButton } from './CyanButton'
import { TillMark } from './TillMark'

const links = [
  { to: '/', label: 'Home' },
  { to: '/till', label: 'Till' },
  { to: '/agents', label: 'Agents' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/activity', label: 'Activity' },
  { to: '/verify', label: 'Verify' },
]

export function Nav({
  address,
  onConnect,
  onLogout,
  authenticated,
  ready,
}: {
  address?: string
  onConnect: () => void
  onLogout: () => void
  authenticated: boolean
  ready: boolean
}) {
  const landing = useLocation().pathname === '/'
  return (
    <header className={landing ? 'nav-landing' : 'nav-app'}>
      <NavLink to="/" className="flex items-center gap-2.5 text-white">
        <TillMark className="h-9 w-9" />
        <span className="text-[15px] font-bold tracking-[0.2em]">TILL</span>
      </NavLink>
      <nav className="nav-center" aria-label="Primary">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <nav className="nav-mobile" aria-label="Mobile">
        {links.map((l) => (
          <NavLink
            key={`m-${l.to}`}
            to={l.to}
            className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-5">
        {authenticated && address ? (
          <>
            <span className="hidden font-mono text-[11px] text-white/70 md:inline">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            <button type="button" onClick={onLogout} className="nav-login">
              Sign out
            </button>
          </>
        ) : (
          <button type="button" disabled={!ready} onClick={onConnect} className="nav-login">
            Login
          </button>
        )}
        {landing ? (
          <CyanButton to="/till">Open a Till</CyanButton>
        ) : authenticated ? null : (
          <CyanButton onClick={onConnect}>Connect</CyanButton>
        )}
      </div>
    </header>
  )
}
// ok

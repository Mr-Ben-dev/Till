import { Link, useLocation } from 'react-router-dom'
import { fmt0g } from '../../lib/errors'
import { loadTillName } from '../../lib/tillMeta'
import type { TillState } from '../../hooks/useTill'
import { sessionLabel } from './PolicyPanel'

export function TillContextBar({ till }: { till: TillState }) {
  const path = useLocation().pathname
  if (!till.authenticated) return null
  const name = till.tokenId != null ? loadTillName(till.tokenId) : 'No Till'
  const switching = !till.loadError && (till.switching || (till.tokenId != null && !till.tillReady))
  const links = [
    { to: '/till', label: 'Overview' },
    { to: '/till#policy', label: 'Policy' },
    { to: '/agents', label: 'Agent' },
    { to: '/till#mission', label: 'Mission' },
    { to: '/activity', label: 'Activity' },
    { to: '/verify', label: 'Proof' },
  ]
  return (
    <div className="till-bar">
      <div className="till-bar__main">
        {switching ? (
          <p className="till-bar__switch">
            Switching to {till.tokenId != null ? loadTillName(till.tokenId) : 'Till'}…
          </p>
        ) : (
          <>
            <p className="till-bar__name">{name}</p>
            <dl className="till-bar__meta">
              <div>
                <dt>Balance</dt>
                <dd>{fmt0g(till.available)}</dd>
              </div>
              <div>
                <dt>Policy</dt>
                <dd>{till.hasPolicy ? (till.paused ? 'Paused' : 'Live') : 'Not set'}</dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd>{sessionLabel(till)}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
      {till.tokenIds.length > 1 ? (
        <label className="till-bar__select">
          <span>Till</span>
          <select
            value={till.tokenId?.toString() ?? ''}
            onChange={(e) => {
              const id = till.tokenIds.find((x) => x.toString() === e.target.value)
              if (id != null) till.selectTill(id)
            }}
          >
            {till.tokenIds.map((id) => (
              <option key={id.toString()} value={id.toString()}>
                {loadTillName(id)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <nav className="till-bar__nav" aria-label="Till">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={path === l.to.split('#')[0] && !l.to.includes('#') ? 'is-on' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function TillSkeleton() {
  return (
    <div className="till-skel" aria-busy="true" aria-live="polite">
      <div className="till-skel__hero" />
      <div className="till-skel__grid">
        <div />
        <div />
        <div />
      </div>
      <p>Loading this Till from Aristotle…</p>
    </div>
  )
}

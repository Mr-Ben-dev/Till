import { Link, useLocation } from 'react-router-dom'
import { fmt0g } from '../../lib/errors'
import { loadTillName } from '../../lib/tillMeta'
import { policyPresetName, setupReady } from '../../lib/setup'
import type { TillState } from '../../hooks/useTill'

export function TillContextBar({ till }: { till: TillState }) {
  const loc = useLocation()
  const path = loc.pathname
  const sub = path !== '/till'
  if (!till.authenticated) return null
  const name = till.tokenId != null ? loadTillName(till.tokenId) : 'No Till'
  const switching = !till.loadError && (till.switching || (till.tokenId != null && !till.tillReady))
  const links = [
    { to: '/till', label: 'Overview', on: path === '/till' },
    { to: '/till/policy', label: 'Policy', on: path === '/till/policy' },
    { to: '/till/agent', label: 'Agent', on: path === '/till/agent' || path === '/agents' },
    { to: '/till/mission', label: 'Work', on: path === '/till/mission' },
    { to: '/activity', label: 'Activity', on: path === '/activity' },
    { to: '/verify', label: 'Proof', on: path === '/verify' },
  ]
  const here = links.find((l) => l.on)?.label ?? 'Overview'
  return (
    <div className="till-bar">
      <div className="till-bar__main">
        {switching ? (
          <p className="till-bar__switch">
            Loading {till.tokenId != null ? loadTillName(till.tokenId) : 'Till'}…
          </p>
        ) : (
          <>
            <p className="till-bar__name">{name}</p>
            <p className="till-bar__here">{here}</p>
            <dl className="till-bar__meta">
              <div>
                <dt>Balance</dt>
                <dd>{fmt0g(till.available)}</dd>
              </div>
              <div>
                <dt>Policy</dt>
                <dd>{till.hasPolicy ? policyPresetName(till.maxTxWei, till.windowBudgetWei) : 'Not set'}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{till.executionMode === 'autonomous' ? 'Autonomous' : 'Owner'}</dd>
              </div>
              {setupReady(till) ? (
                <div>
                  <dt>Status</dt>
                  <dd>LIVE</dd>
                </div>
              ) : null}
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
      {sub ? (
        <Link className="till-bar__back" to="/till">
          ← Till Overview
        </Link>
      ) : null}
      <nav className="till-tabs" aria-label="Till sections">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={l.on ? 'is-on' : ''} aria-current={l.on ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function TillSkeleton({ label }: { label?: string }) {
  return (
    <div className="till-skel" aria-busy="true" aria-live="polite">
      <div className="till-skel__hero" />
      <div className="till-skel__grid">
        <div />
        <div />
        <div />
      </div>
      <p>{label ?? 'Loading this Till from Aristotle…'}</p>
    </div>
  )
}

export function JourneyFooter({
  nextTo,
  nextLabel,
  backTo = '/till',
  backLabel = 'Till Overview',
}: {
  nextTo?: string
  nextLabel?: string
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="journey">
      <Link className="journey__back" to={backTo}>
        ← {backLabel}
      </Link>
      {nextTo && nextLabel ? (
        <Link className="journey__next" to={nextTo}>
          {nextLabel} →
        </Link>
      ) : null}
    </div>
  )
}

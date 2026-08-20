import { Link } from 'react-router-dom'
import type { TillState } from '../../hooks/useTill'
import { sessionLabel } from './PolicyPanel'
import { setupItems, setupReady } from '../../lib/setup'

export function SetupChecklist({ till }: { till: TillState }) {
  if (!till.tokenId) return null
  if (setupReady(till)) {
    const mission = Boolean(till.lastBrief)
    return (
      <p className="live-strip" id="setup">
        <strong>LIVE</strong>
        <span>Policy ✓</span>
        <span>Agent {sessionLabel(till) === 'READY' ? '✓' : 'owner'}</span>
        <span>{mission ? 'Mission done' : 'Mission ready'}</span>
      </p>
    )
  }
  const items = setupItems(till)
  const core = items.filter((i) => i.id !== 'mission')
  const done = core.filter((i) => i.done).length
  return (
    <section className="surf surf-accent" id="setup">
      <h2>Finish setting up your Till</h2>
      <p className="mod-lede">
        {done} / {core.length} · Create → Protect → Fund → Enable agent → Run first mission
      </p>
      <ol className="setup-list">
        {items.map((item, i) => (
          <li key={item.id} className={item.done ? 'is-done' : i === items.findIndex((x) => !x.done) ? 'is-next' : ''}>
            <Link to={item.to}>
              <span className="setup-list__mark">{item.done ? 'Done' : i + 1}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

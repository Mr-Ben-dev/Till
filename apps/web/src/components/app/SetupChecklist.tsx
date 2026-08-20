import { Link } from 'react-router-dom'
import type { TillState } from '../../hooks/useTill'
import { setupItems, setupReady } from '../../lib/setup'

export function SetupChecklist({ till }: { till: TillState }) {
  if (!till.tokenId) return null
  if (setupReady(till)) return null
  const items = setupItems(till)
  const core = items.filter((i) => i.id !== 'mission')
  const done = core.filter((i) => i.done).length
  if (done === core.length) return null
  return (
    <section className="surf surf-accent" id="setup">
      <h2>Finish setting up your Till</h2>
      <p className="mod-lede">
        {done} / {core.length} complete. Protect, fund, then enable an agent before the first mission.
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

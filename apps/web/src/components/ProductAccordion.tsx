import { useState } from 'react'
import { CaretRight } from '@phosphor-icons/react'

const ITEMS = [
  {
    title: 'Hard policy, not a prompt',
    body: 'Caps, allowlists, and expiry live on TillPolicy. The model proposes. The vault decides. Preview() is the same math the chain will run.',
  },
  {
    title: 'TEE-bound release',
    body: '0G Compute processResponse must bind the digest. Replay, over-cap, and another user\'s Till are rejected on-chain, not in a dashboard.',
  },
  {
    title: 'x402 buys the work',
    body: 'The agent picks three different providers — token safety, oracle freshness, and bytecode privileges — pays USDC.e on 16661 through Herald, and never holds the owner key.',
  },
  {
    title: 'Storage + ERC-8004 receipt',
    body: 'Encrypted packet on 0G Storage, vault-anchored. Identity and reputation on Aristotle. Validation Registry is BLOCKED, not faked.',
  },
]

export function ProductAccordion() {
  const [open, setOpen] = useState(0)
  return (
    <ul className="acc-list">
      {ITEMS.map((item, i) => {
        const on = open === i
        return (
          <li key={item.title}>
            <button
              type="button"
              className={`acc-row ${on ? 'is-open' : ''}`}
              aria-expanded={on}
              onClick={() => setOpen(i)}
            >
              <span className="acc-rule" />
              <span className="acc-head">
                <CaretRight className="acc-play" size={14} weight="bold" aria-hidden />
                <span className="acc-title">{item.title}</span>
              </span>
              <span className={`acc-body ${on ? 'is-open' : ''}`}>
                <span className="acc-body-inner">{item.body}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
// note

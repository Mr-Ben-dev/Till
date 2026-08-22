import { useState } from 'react'
import { CaretRight } from '@phosphor-icons/react'

const ITEMS = [
  {
    title: 'Hard policy, not a prompt',
    body: 'Caps, allowlists, and expiry live on TillPolicy for native 0G. USDC.e missions are limited by the session drawer, not by TillPolicy.',
  },
  {
    title: 'TEE-bound release',
    body: '0G Compute processResponse must bind the digest. Replay, over-cap, and another user\'s Till are rejected on-chain, not in a dashboard.',
  },
  {
    title: 'x402 buys the work',
    body: 'It discovers live x402 quotes on Aristotle USDC.e. Herald facilitator Exact settlement works; the Herald cross-chain router currently forwards the 0G signature to Base sellers, so SKU 200 is blocked. Till fail-closes and sweeps. Quoted is not settled.',
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

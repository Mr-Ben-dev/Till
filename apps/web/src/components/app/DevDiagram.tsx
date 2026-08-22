const NODES = [
  'Agent',
  'Till',
  'Policy',
  '0G Compute / TEE',
  'Result',
  '0G Storage',
  'Proof',
]

const OWNER = ['Owner wallet', 'Creates Till', 'Sets policy', 'Authorizes session']
const SESSION = ['Session', 'Executes approved work', 'No owner signature per autonomous spend']

export function DevDiagram() {
  return (
    <div className="grid gap-8">
      <ol className="og-rail" aria-label="Mission path">
        {NODES.map((n, i) => (
          <li key={n} className="og-rail__node is-ok">
            <span className="og-rail__dot" />
            <span className="og-rail__label">{n}</span>
            {i < NODES.length - 1 ? <span className="og-rail__line" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <div className="grid gap-6 md:grid-cols-2">
        <ol className="og-rail" aria-label="Owner setup">
          {OWNER.map((n, i) => (
            <li key={n} className="og-rail__node is-ok">
              <span className="og-rail__dot" />
              <span className="og-rail__label">{n}</span>
              {i < OWNER.length - 1 ? <span className="og-rail__line" aria-hidden /> : null}
            </li>
          ))}
        </ol>
        <ol className="og-rail" aria-label="Session execution">
          {SESSION.map((n, i) => (
            <li key={n} className="og-rail__node is-wait">
              <span className="og-rail__dot" />
              <span className="og-rail__label">{n}</span>
              {i < SESSION.length - 1 ? <span className="og-rail__line" aria-hidden /> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export const OG_BADGES = [
  { label: '0G Aristotle 16661', href: 'https://chainscan.0g.ai' },
  { label: '0G Compute', href: 'https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview' },
  { label: 'TEE', href: 'https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference' },
  { label: '0G Storage', href: 'https://docs.0g.ai/developer-hub/building-on-0g/storage/overview' },
  { label: 'ERC-7857', href: 'https://github.com/0gfoundation/0g-agentic-id' },
  { label: 'ERC-8004 Identity + Reputation', href: 'https://github.com/0gfoundation/erc-8004-contracts' },
]

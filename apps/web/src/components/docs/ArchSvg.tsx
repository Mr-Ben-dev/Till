const ARCH = [
  'OWNER',
  'TILL',
  'POLICY',
  'SESSION',
  'AGENT',
  '0G COMPUTE / TEE',
  'x402',
  'EXTERNAL SERVICES',
  'RESULT',
  '0G STORAGE',
  'PROOF',
]

const AUTON = [
  'Owner wallet',
  'Create Till',
  'Set policy',
  'Authorize session',
  'Session executes',
  'No owner signature',
  'Revoke',
]

const MISSION = [
  'Mission',
  'Planning',
  'Service discovery',
  'Budget quote',
  'TEE approval',
  'x402 purchases',
  'Private synthesis',
  'Verdict',
  'Proof',
]

function Column({ title, nodes, pulse }: { title: string; nodes: string[]; pulse?: boolean }) {
  return (
    <figure className="arch-col">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 220 ${nodes.length * 56 + 8}`} className="arch-svg" role="img" aria-label={title}>
        {nodes.map((n, i) => {
          const y = 8 + i * 56
          return (
            <g key={n}>
              {i < nodes.length - 1 ? (
                <line className="arch-line" x1="110" y1={y + 36} x2="110" y2={y + 56} />
              ) : null}
              <rect className="arch-node" x="18" y={y} width="184" height="36" rx="4.27" />
              {pulse && i === 4 ? <circle className="arch-pulse" cx="110" cy={y + 18} r="5" /> : null}
              <text x="110" y={y + 23} textAnchor="middle">
                {n}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export function ArchDiagram() {
  return (
    <div className="arch-grid">
      <Column title="Architecture" nodes={ARCH} pulse />
      <Column title="Autonomous execution" nodes={AUTON} />
      <Column title="Before You Pay" nodes={MISSION} />
    </div>
  )
}

export function MoneyFlow() {
  return (
    <svg className="arch-svg arch-svg--wide" viewBox="0 0 640 160" role="img" aria-label="Money flow">
      <rect className="arch-node" x="8" y="52" width="140" height="44" rx="4.27" />
      <text x="78" y="79" textAnchor="middle">
        Owner
      </text>
      <line className="arch-line" x1="148" y1="74" x2="196" y2="74" />
      <rect className="arch-node" x="196" y="52" width="140" height="44" rx="4.27" />
      <text x="266" y="79" textAnchor="middle">
        Till
      </text>
      <line className="arch-line" x1="336" y1="74" x2="384" y2="74" />
      <rect className="arch-node" x="384" y="52" width="160" height="44" rx="4.27" />
      <text x="464" y="79" textAnchor="middle">
        x402 service
      </text>
      <rect className="arch-forbid" x="196" y="116" width="248" height="32" rx="4.27" />
      <text x="320" y="137" textAnchor="middle">
        Owner wallet NEVER → Agent
      </text>
    </svg>
  )
}

export function Boundaries() {
  const zones = [
    { t: 'Owner', d: 'Mint, fund, policy, authorize, revoke, withdraw' },
    { t: 'Session', d: 'Anchor proof. Cannot withdraw or change policy' },
    { t: 'MCP', d: 'Scoped JWT. No keys. Execute only if READY' },
    { t: 'Backend', d: 'Herald USDC.e rail. Compute billing. Never owner key' },
  ]
  return (
    <ul className="bound-grid">
      {zones.map((z) => (
        <li key={z.t}>
          <p className="font-mono text-[11px] tracking-[0.16em] text-cyan">{z.t}</p>
          <p className="mt-2 text-[14px] text-white/70">{z.d}</p>
        </li>
      ))}
    </ul>
  )
}

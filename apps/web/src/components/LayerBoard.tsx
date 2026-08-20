import { useId, useState } from 'react'
import { OgLogo } from './OgLogo'

export const LAYERS = [
  {
    name: 'Owner vault',
    title: 'You keep the money. The agent gets a drawer.',
    body: 'Mint a Till per user, fund it, and withdraw as owner. Pause and revoke stay in your hands. The agent never receives your wallet.',
    scene: 'vault',
  },
  {
    name: 'Hard policy',
    title: 'Caps live on-chain, not in a prompt.',
    body: 'TillPolicy stores max-per-tx, rolling budget, allowlist, and expiry. preview() is the same math the vault will run before a wei moves.',
    scene: 'policy',
  },
  {
    name: 'Agent grant',
    title: 'Authorize usage. Never ship a key.',
    body: 'Executors are ERC-7857 authorizeUsage addresses. MCP rejects private keys. A session key stays in this browser only.',
    scene: 'agent',
  },
  {
    name: 'TEE bind',
    title: '0G Compute must bind the digest.',
    body: 'glm-5.2 TeeML signs the work on 0G Compute. Replay, over-cap, and another user\'s Till are rejected on Aristotle, not in a dashboard.',
    scene: 'tee',
  },
  {
    name: 'Investigation',
    title: 'The agent buys the intel it can pay for.',
    body: 'It discovers live x402 quotes, buys three independent checks in USDC.e on Aristotle, then returns BUY / HOLD / AVOID. Storage proves the packet. The agent never holds your wallet.',
    scene: 'receipt',
  },
] as const

function Plate({ x, y, w = 148, d = 16, fill = false }: { x: number; y: number; w?: number; d?: number; fill?: boolean }) {
  const hx = w / 2
  return (
    <path
      d={`M${x} ${y} l${hx} ${-d} l${hx} ${d} l${-hx} ${d} z`}
      fill={fill ? '#002032' : 'none'}
      stroke="#002032"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
  )
}

function Stack({ x, y, n, w, pull = 0 }: { x: number; y: number; n: number; w?: number; pull?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <Plate
          key={i}
          x={x + (i === n - 3 ? pull : 0)}
          y={y + i * 14}
          w={w}
          fill={i === n - 3 && pull > 0}
        />
      ))}
    </g>
  )
}

export function LayerScene({ kind }: { kind: (typeof LAYERS)[number]['scene'] }) {
  const uid = useId().replace(/:/g, '')

  if (kind === 'tee') {
    return (
      <div className="layer-scene">
        <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full" aria-hidden>
          <Stack x={86} y={54} n={5} w={188} />
          <Stack x={86} y={232} n={4} w={188} />
        </svg>
        <div className="layer-scene__inner relative">
          <OgLogo className="h-12 w-20 md:h-[52px] md:w-[86px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="layer-scene">
      <svg viewBox="0 0 360 360" className="h-full w-full" aria-hidden>
        {kind === 'vault' && (
          <g>
            <path
              d="M64 268 L180 318 L296 268 V122 L180 72 L64 122 Z"
              fill="none"
              stroke="#002032"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M64 122 L180 172 L296 122" fill="none" stroke="#002032" strokeWidth="2.6" />
            <path d="M180 172 V318" fill="none" stroke="#002032" strokeWidth="2.6" />
            <g transform="translate(0 8)">
              <Stack x={106} y={118} n={7} w={148} />
            </g>
          </g>
        )}
        {kind === 'policy' && (
          <g>
            <path
              d="M180 28 L332 180 L180 332 L28 180 Z"
              fill="none"
              stroke="#002032"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <g clipPath={`url(#pol${uid})`}>
              <Stack x={88} y={96} n={9} w={184} />
            </g>
            <clipPath id={`pol${uid}`}>
              <path d="M180 52 L300 180 L180 308 L60 180 Z" />
            </clipPath>
            <path
              d="M180 52 L300 180 L180 308 L60 180 Z"
              fill="none"
              stroke="#002032"
              strokeWidth="2.6"
            />
          </g>
        )}
        {kind === 'agent' && (
          <g>
            <Stack x={48} y={78} n={10} w={168} />
            <g data-drawer>
              <Plate x={96} y={176} w={196} fill />
              <rect x="268" y="168" width="16" height="10" rx="2" fill="#00BDE9" stroke="#002032" strokeWidth="2" />
            </g>
          </g>
        )}
        {kind === 'receipt' && (
          <g>
            <path
              d="M92 56 h148 l44 44 v204 h-192 z"
              fill="none"
              stroke="#002032"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M240 56 v44 h44" fill="none" stroke="#002032" strokeWidth="2.6" />
            <Stack x={108} y={128} n={6} w={128} />
          </g>
        )}
      </svg>
    </div>
  )
}

export function LayerBoard() {
  const [open, setOpen] = useState(0)
  return (
    <div>
      <div className="layer-acc hidden md:flex" role="tablist" aria-label="Till layers">
        {LAYERS.map((layer, i) => {
          const on = open === i
          return (
            <button
              key={layer.name}
              type="button"
              role="tab"
              aria-selected={on}
              className={`layer-panel ${on ? 'is-open' : ''}`}
              onClick={() => setOpen(i)}
            >
              {on ? (
                <>
                  <p className="text-[14px] font-medium text-cyan">{layer.name}</p>
                  <div className="mt-5 w-full">
                    <LayerScene kind={layer.scene} />
                  </div>
                  <h3 className="mt-5 max-w-md text-[1.35rem] font-bold leading-tight text-white">{layer.title}</h3>
                  <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/70">{layer.body}</p>
                </>
              ) : (
                <p className="layer-closed-name">{layer.name}</p>
              )}
            </button>
          )
        })}
      </div>
      <ul className="flex flex-col gap-10 md:hidden">
        {LAYERS.map((layer) => (
          <li key={layer.name}>
            <LayerScene kind={layer.scene} />
            <p className="mt-4 text-[15px] font-medium text-ink/55">{layer.name}</p>
            <h3 className="mt-2 text-[1.35rem] font-bold leading-tight">{layer.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{layer.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
// todo

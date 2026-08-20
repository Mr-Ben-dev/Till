import type { PipelineStep } from '../../hooks/useTill'

const NODES = [
  { key: 'plan', label: 'User mission' },
  { key: 'budget', label: 'Till policy' },
  { key: 'tee', label: '0G Compute' },
  { key: 'tee2', label: 'TEE verification', from: 'tee' },
  { key: 'buy1', label: 'x402 purchase' },
  { key: 'result', label: 'Private analysis' },
  { key: 'storage', label: '0G Storage' },
  { key: 'proof', label: 'On-chain proof' },
] as const

function stateOf(steps: PipelineStep[], key: string): PipelineStep['state'] {
  const mapped = key === 'tee2' ? 'tee' : key
  return steps.find((s) => s.key === mapped)?.state ?? 'idle'
}

export function OgRail({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="og-rail" aria-label="Powered by 0G">
      {NODES.map((n, i) => {
        const st = stateOf(steps, n.key)
        return (
          <li key={n.key} className={`og-rail__node is-${st}`}>
            <span className="og-rail__dot" />
            <span className="og-rail__label">{n.label}</span>
            {i < NODES.length - 1 ? <span className="og-rail__line" aria-hidden /> : null}
          </li>
        )
      })}
    </ol>
  )
}

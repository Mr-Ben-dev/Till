import { humanCheck } from '../../lib/serviceLabels'
import { ProofRow } from './ProofRow'
import type { MissionDiscover, PurchaseRecord } from '../../lib/api'

export function MissionCard({
  mission,
  purchases,
}: {
  mission: MissionDiscover
  purchases?: PurchaseRecord[]
}) {
  const rows = purchases?.length ? purchases : mission.quotes
  return (
    <article className="mt-6 grid gap-5">
      <p className="text-[15px] text-white">
        {mission.quotes.length} independent checks selected · quote ${mission.totalUsd.toFixed(3)} · cap $
        {mission.capUsd.toFixed(2)}
      </p>
      <ul className="grid gap-3">
        {rows.map((row) => {
          const sku = 'sku' in row ? row.sku : ''
          const usd = 'quote' in row ? row.quote.amountUsd : 0
          const paid = 'status' in row ? row.status === 200 : false
          const ogTx = 'ogTx' in row ? row.ogTx : undefined
          const h = humanCheck(row.seller, sku)
          return (
            <li key={row.url} className="rounded-[4.27px] border border-white/10 p-4">
              <p className="font-semibold text-white">{h.title}</p>
              <p className="mt-1 text-[13px] text-white/60">{h.body}</p>
              <ProofRow
                ok={paid}
                label={`${h.title} purchase`}
                amount={`$${usd.toFixed(3)}`}
                asset="USDC.e"
                provider={h.provider}
                status={paid ? 'settled' : 'quoted'}
                hash={ogTx}
              />
            </li>
          )
        })}
      </ul>
      {mission.skipped.map((s) => (
        <p key={s.seller} className="text-[13px] text-white/50">
          {s.seller} UNAVAILABLE: {s.detail}
        </p>
      ))}
      {mission.bazaar ? <p className="text-[12px] text-white/40">{mission.bazaar.note}</p> : null}
    </article>
  )
}

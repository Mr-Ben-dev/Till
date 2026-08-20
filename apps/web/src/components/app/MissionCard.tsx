import { txUrl } from '../../lib/chain'
import type { MissionDiscover, PurchaseRecord } from '../../lib/api'

export function MissionCard({
  mission,
  purchases,
}: {
  mission: MissionDiscover
  purchases?: PurchaseRecord[]
}) {
  return (
    <article className="mt-6 grid gap-6">
      {mission.facts && mission.facts.length > 0 && (
        <section>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">FACTS NEEDED</p>
          <ol className="mt-3 grid gap-2">
            {mission.facts.map((f) => (
              <li key={f.fact} className="text-[14px] leading-relaxed text-white/75">
                {f.fact.replace('-', ' ')} — {f.why}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted">PLAN</p>
        <ol className="mt-3 grid gap-2">
          {mission.plan.map((p, i) => (
            <li key={p} className="text-[14px] leading-relaxed text-white/75">
              {i + 1}. {p}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted">BUDGET</p>
        <p className="mt-3 text-[15px] text-white">
          Quote ${mission.totalUsd.toFixed(3)} USDC.e · cap ${mission.capUsd.toFixed(2)} · {mission.network}
        </p>
        <p className="mt-2 text-[13px] text-white/55">
          Token {mission.token}. The agent never receives this wallet. USDC.e settles on 0G via Herald.
        </p>
        {mission.bazaar ? (
          <p className="mt-2 text-[12px] text-white/45">{mission.bazaar.note}</p>
        ) : null}
      </section>

      <section>
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted">PURCHASES</p>
        <ul className="mt-3 grid gap-4">
          {(purchases?.length ? purchases : mission.quotes).map((row) => {
            const sku = 'sku' in row ? row.sku : ''
            const usd = 'quote' in row ? row.quote.amountUsd : 0
            const url = row.url
            const paid = 'status' in row ? row.status === 200 : false
            const ogTx = 'ogTx' in row ? row.ogTx : undefined
            return (
              <li key={url} className="rounded-[4.27px] border border-white/10 p-4">
                <p className="font-semibold text-white">
                  {row.seller} · {sku}
                  {'fact' in row && row.fact ? ` · ${row.fact}` : ''}
                </p>
                <p className="mt-1 text-[13px] text-white/60">{'why' in row ? row.why : url}</p>
                <p className="mt-2 font-mono text-[12px] text-cyan">
                  ${usd.toFixed(3)} USDC.e {paid ? '· paid' : '· quoted'}
                </p>
                {ogTx ? (
                  <a className="mt-2 block font-mono text-[11px] text-cyan underline" href={txUrl(ogTx)} target="_blank" rel="noreferrer">
                    {ogTx.slice(0, 10)}…{ogTx.slice(-6)}
                  </a>
                ) : null}
              </li>
            )
          })}
        </ul>
        {mission.skipped.map((s) => (
          <p key={s.seller} className="mt-3 text-[13px] text-white/50">
            {s.seller} UNAVAILABLE: {s.detail}
          </p>
        ))}
      </section>
    </article>
  )
}

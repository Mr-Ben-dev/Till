import { useEffect, useState } from 'react'
import { Contract, JsonRpcProvider } from 'ethers'
import { ADDR, EXPLORER, MINT_FROM_BLOCK, RPC_URL } from '../lib/chain'
import { NFT_ABI, VAULT_ABI } from '../lib/abi'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { JourneyFooter, TillSkeleton } from '../components/app/TillContextBar'
import { loadTillName } from '../lib/tillMeta'

type Row = { title: string; hash: string; extra: string; at: number }

export function ActivityPage({ till }: { till: TillState }) {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const switching =
    till.authenticated &&
    !till.loadError &&
    (!till.hydrated || till.switching || (till.tokenId != null && !till.tillReady))

  useEffect(() => {
    setRows([])
    setErr('')
    if (!till.tokenId || !till.address || !till.tillReady) return
    const id = till.tokenId
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const provider = new JsonRpcProvider(RPC_URL)
        const vault = new Contract(ADDR.vault, VAULT_ABI, provider)
        const nft = new Contract(ADDR.nft, NFT_ABI, provider)
        const [rel, dep, mint] = await Promise.all([
          vault.queryFilter(vault.filters.Released(id), MINT_FROM_BLOCK).catch(() => []),
          vault.queryFilter(vault.filters.Deposited(id), MINT_FROM_BLOCK).catch(() => []),
          nft.queryFilter(nft.filters.TillMinted(till.address), MINT_FROM_BLOCK).catch(() => []),
        ])
        if (cancelled) return
        const out: Row[] = []
        for (const l of mint) {
          const parsed = nft.interface.parseLog({ topics: l.topics as string[], data: l.data })
          if (parsed?.args.tokenId === id) {
            out.push({
              title: 'Till created',
              hash: l.transactionHash,
              extra: loadTillName(id),
              at: Number(l.blockNumber),
            })
          }
        }
        for (const l of dep) out.push({ title: 'Funded', hash: l.transactionHash, extra: '', at: Number(l.blockNumber) })
        for (const l of rel) out.push({ title: 'Paid from Till', hash: l.transactionHash, extra: '', at: Number(l.blockNumber) })
        if (till.purchases.length) {
          till.purchases.forEach((p) => {
            if (p.ogTx) out.push({ title: `${p.seller} purchased`, hash: p.ogTx, extra: `$${p.quote.amountUsd.toFixed(3)} USDC.e`, at: Date.now() })
          })
        }
        if (till.tech.anchorTx) out.push({ title: 'Storage anchored', hash: till.tech.anchorTx, extra: '', at: Date.now() })
        if (till.lastBrief?.verdict) {
          out.push({
            title: `Verdict: ${till.lastBrief.verdict}`,
            hash: till.purchases[0]?.ogTx || till.lastTx,
            extra: '',
            at: Date.now(),
          })
        }
        if (!cancelled) setRows(out.reverse())
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load activity')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [till.tokenId, till.address, till.tillReady, till.purchases, till.tech.anchorTx, till.lastBrief, till.lastTx])

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Activity</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Timeline for {till.tokenId != null ? loadTillName(till.tokenId) : 'your Till'}. Technical hashes stay collapsed.
      </p>
      {!till.authenticated && (
        <div className="mt-8">
          <Notice title="Connect to see your Till" action={<CyanButton onClick={till.login}>Connect</CyanButton>} />
        </div>
      )}
      {till.authenticated && !till.tokenId && (
        <div className="mt-8">
          <Notice title="No Till yet" body="Create one, then activity will appear here." action={<CyanButton to="/tills">Open Tills</CyanButton>} />
        </div>
      )}
      {(loading || switching) && <TillSkeleton />}
      {err && (
        <div className="mt-8">
          <Notice tone="danger" title="Could not read logs" body={err} />
        </div>
      )}
      <ol className="timeline mt-10">
        {rows.map((r) => (
          <li key={r.hash + r.title} className="timeline__item">
            <p className="timeline__title">{r.title}</p>
            {r.extra ? <p className="timeline__amt">{r.extra}</p> : null}
            <details>
              <summary>Proof</summary>
              <a className="font-mono text-[12px] text-cyan" href={`${EXPLORER}/tx/${r.hash}`}>
                {r.hash.slice(0, 10)}…{r.hash.slice(-6)}
              </a>
            </details>
          </li>
        ))}
        {!loading && !switching && till.tokenId && rows.length === 0 && (
          <li className="py-10 text-white/50">No events yet. Fund or run a payment and they will show here.</li>
        )}
      </ol>
      <JourneyFooter />
    </main>
  )
}

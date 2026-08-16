import { useEffect, useState } from 'react'
import { Contract, JsonRpcProvider } from 'ethers'
import { ADDR, EXPLORER, MINT_FROM_BLOCK, RPC_URL } from '../lib/chain'
import { NFT_ABI, VAULT_ABI } from '../lib/abi'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'

type Row = { title: string; hash: string; extra: string }

export function ActivityPage({ till }: { till: TillState }) {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!till.tokenId || !till.address) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr('')
      try {
        const provider = new JsonRpcProvider(RPC_URL)
        const vault = new Contract(ADDR.vault, VAULT_ABI, provider)
        const nft = new Contract(ADDR.nft, NFT_ABI, provider)
        const id = till.tokenId
        const [rel, dep, mint] = await Promise.all([
          vault.queryFilter(vault.filters.Released(id), MINT_FROM_BLOCK).catch(() => []),
          vault.queryFilter(vault.filters.Deposited(id), MINT_FROM_BLOCK).catch(() => []),
          nft.queryFilter(nft.filters.TillMinted(till.address), MINT_FROM_BLOCK).catch(() => []),
        ])
        const out: Row[] = []
        for (const l of mint) out.push({ title: 'Till created', hash: l.transactionHash, extra: `Till #${id}` })
        for (const l of dep) out.push({ title: 'Funded', hash: l.transactionHash, extra: '' })
        for (const l of rel) out.push({ title: 'Paid', hash: l.transactionHash, extra: '' })
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
  }, [till.tokenId, till.address])

  return (
    <main className="app-page">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Activity</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Real events for this Till. Nothing is simulated.
      </p>
      {!till.authenticated && (
        <div className="mt-8">
          <Notice title="Connect to see your Till" action={<CyanButton onClick={till.login}>Connect</CyanButton>} />
        </div>
      )}
      {till.authenticated && !till.tokenId && (
        <div className="mt-8">
          <Notice title="No Till yet" body="Create one, then activity will appear here." action={<CyanButton to="/till">Open Till</CyanButton>} />
        </div>
      )}
      {loading && (
        <div className="mt-8 h-24 animate-pulse rounded-[4.27px] bg-white/[0.04]" aria-hidden />
      )}
      {err && <div className="mt-8"><Notice tone="danger" title="Could not read logs" body={err} /></div>}
      <ul className="mt-10 divide-y divide-white/10 border-t border-white/10">
        {rows.map((r) => (
          <li key={r.hash + r.title} className="flex flex-col gap-1 py-4 md:flex-row md:justify-between">
            <span>
              {r.title}
              {r.extra ? <span className="text-white/45"> {r.extra}</span> : null}
            </span>
            <a className="font-mono text-[12px] text-cyan" href={`${EXPLORER}/tx/${r.hash}`}>
              {r.hash.slice(0, 10)}…{r.hash.slice(-6)}
            </a>
          </li>
        ))}
        {!loading && till.tokenId && rows.length === 0 && (
          <li className="py-10 text-white/50">No events yet. Fund or run a payment and they will show here.</li>
        )}
      </ul>
    </main>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { verifyTx } from '../lib/api'
import { txUrl } from '../lib/chain'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { fmt0g } from '../lib/errors'

type VaultEv = { event: string; args: Record<string, unknown> }
type VerifyBody = {
  tx?: string
  explorer?: string
  status?: number
  blockNumber?: number
  from?: string
  to?: string
  nativeValue0G?: string
  chain?: string
  till?: string | null
  tillSource?: string | null
  vaultEvents?: VaultEv[]
  usdceTransfers?: { from: string; to: string; amountUsd?: number }[]
  storageRoot?: string | null
  released?: { event?: string; args?: Record<string, unknown> } | null
  sessionCache?: {
    packet?: { model?: string; till?: string; brief?: { verdict?: string } }
    tokenId?: string | null
    family?: string | null
    verdict?: string | null
    label?: string
  } | null
  family?: string | null
  signer?: string | null
  model?: string | null
  processResponse?: boolean | null
  verdict?: string | null
  rail?: string | null
  durable?: boolean
  note?: string
}

export function VerifyPage() {
  const [params, setParams] = useSearchParams()
  const [tx, setTx] = useState(params.get('tx') ?? '')
  const [data, setData] = useState<VerifyBody | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const run = async (hash: string) => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      setData((await verifyTx(hash)) as VerifyBody)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = params.get('tx')
    if (!q) return
    setTx(q)
    void run(q)
  }, [params])

  const args = data?.released?.args ?? {}
  const anchored = (data?.vaultEvents ?? []).find((e) => e.event === 'PacketAnchored')
  const ok = data?.status === 1
  const amountRaw = args.amount != null ? String(args.amount) : ''
  const amount = /^\d+$/.test(amountRaw) ? fmt0g(amountRaw) : amountRaw
  const agent = args.executor != null ? String(args.executor) : data?.from ?? ''
  const onchainTill = anchored?.args?.tokenId != null ? String(anchored.args.tokenId) : data?.till
  const cacheVerdict = data?.sessionCache?.verdict ?? data?.sessionCache?.packet?.brief?.verdict
  const verdict = cacheVerdict ?? data?.verdict
  const cached = Boolean(data?.durable || data?.sessionCache)

  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Verify a Till result</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Paste a transaction hash. Aristotle is the source of truth. Cached fields are labeled. No wallet needed.
      </p>
      <form
        className="mt-10 flex flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          setParams({ tx })
          void run(tx)
        }}
      >
        <input
          className="flex-1 rounded-[4.27px] border border-white/15 bg-navy px-3 py-3 font-mono text-sm"
          placeholder="Transaction hash"
          value={tx}
          onChange={(e) => setTx(e.target.value)}
        />
        <CyanButton type="submit">Verify</CyanButton>
      </form>
      {loading && (
        <div className="till-skel mt-8" aria-busy="true">
          <div className="till-skel__hero" />
        </div>
      )}
      {error && (
        <div className="mt-8">
          <Notice tone="danger" title="Not verified" body={error} />
        </div>
      )}
      {data && !loading && (
        <section className={`surf mt-10 ${ok ? 'surf-proof' : 'surf-warn'}`}>
          <p className={`font-mono text-[11px] tracking-[0.18em] ${ok ? 'text-cyan' : 'text-danger'}`}>
            {ok ? 'Verified on Aristotle' : 'Failed on-chain'}
          </p>
          {verdict ? <p className="mt-4 font-mono text-[22px] font-bold tracking-[0.12em] text-cyan">{verdict}</p> : null}
          {cached ? (
            <p className="mt-2 text-[12px] text-white/50">
              Family, verdict, and model below may be API cache. On-chain Till id and storage root win if they disagree.
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-white/50">No API cache for this hash. Showing the Aristotle receipt only.</p>
          )}
          <ol className="proof-chain mt-6">
            <li>
              <span>Till</span>
              <strong>
                {onchainTill ? `Till ${onchainTill}` : 'not in this receipt'}
                {data?.tillSource ? ` · ${data.tillSource}` : ''}
              </strong>
            </li>
            <li>
              <span>PacketAnchored</span>
              <strong>{anchored ? 'yes' : 'not in this receipt'}</strong>
            </li>
            <li>
              <span>Storage root</span>
              <strong className="font-mono text-[12px]">
                {data.storageRoot ? `${data.storageRoot.slice(0, 18)}…` : 'not in this tx'}
              </strong>
            </li>
            <li>
              <span>Signer</span>
              <strong className="font-mono text-[12px]">{agent ? `${agent.slice(0, 8)}…${agent.slice(-4)}` : 'n/a'}</strong>
            </li>
            <li>
              <span>Native value</span>
              <strong>{amount || (data.nativeValue0G && data.nativeValue0G !== '0' ? `${data.nativeValue0G} 0G` : '0 0G gas')}</strong>
            </li>
            <li>
              <span>Family</span>
              <strong>
                {data.family || 'not in cache'}
                {data.family ? ' · cache' : ''}
              </strong>
            </li>
            <li>
              <span>Verdict</span>
              <strong>{verdict ? `${verdict} · cache` : 'not in this receipt'}</strong>
            </li>
            <li>
              <span>processResponse</span>
              <strong>{data.processResponse == null ? 'see packet / cache' : String(data.processResponse)}</strong>
            </li>
          </ol>
          <details className="mt-8">
            <summary className="cursor-pointer text-[13px] text-muted">Technical details</summary>
            <p className="mt-3 text-[13px] text-white/55">{data.note}</p>
            <dl className="mt-4 grid gap-2 font-mono text-[11px] text-white/70">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-muted">tx</dt>
                <dd className="break-all">{data.tx}</dd>
              </div>
              {(data.vaultEvents ?? []).map((e) => (
                <div key={e.event} className="grid grid-cols-[120px_1fr] gap-3">
                  <dt className="text-muted">{e.event}</dt>
                  <dd className="break-all">{JSON.stringify(e.args)}</dd>
                </div>
              ))}
              {(data.usdceTransfers ?? []).length > 0 ? (
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <dt className="text-muted">USDC.e logs</dt>
                  <dd className="break-all">{JSON.stringify(data.usdceTransfers)}</dd>
                </div>
              ) : null}
            </dl>
          </details>
          {tx.startsWith('0x') && tx.length === 66 && (
            <a className="mt-6 inline-block text-sm text-cyan" href={data.explorer || txUrl(tx)}>
              Open on ChainScan
            </a>
          )}
        </section>
      )}
    </main>
  )
}

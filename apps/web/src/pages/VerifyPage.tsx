import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { verifyTx } from '../lib/api'
import { txUrl } from '../lib/chain'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { fmt0g } from '../lib/errors'

type Transfer = { from: string; to: string; amountUsd?: number; amount?: string }
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
  vaultEvents?: VaultEv[]
  usdceTransfers?: Transfer[]
  storageRoot?: string | null
  released?: { event?: string; args?: Record<string, unknown> } | null
  sessionCache?: { packet?: { model?: string; till?: string; brief?: { verdict?: string } } } | null
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
  const ok = data?.status === 1
  const amountRaw = args.amount != null ? String(args.amount) : ''
  const amount = /^\d+$/.test(amountRaw) ? fmt0g(amountRaw) : amountRaw
  const usdSpent = data?.usdceTransfers?.reduce((n, t) => n + (t.amountUsd ?? 0), 0) ?? 0
  const agent = args.executor != null ? String(args.executor) : data?.from ?? ''
  const action = data?.released?.event ?? (usdSpent ? 'x402 USDC.e payment' : 'Transaction')
  const verdict = data?.sessionCache?.packet?.brief?.verdict

  return (
    <main className="app-page">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Verify</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        Paste a transaction hash. No wallet needed. Aristotle is the source of truth.
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
      {loading && <div className="mt-8 h-28 animate-pulse rounded-[4.27px] bg-white/[0.04]" />}
      {error && (
        <div className="mt-8">
          <Notice tone="danger" title="Not verified" body={error} />
        </div>
      )}
      {data && !loading && (
        <section className="mt-10 rounded-[4.27px] border border-white/10 p-6 md:p-8">
          <p className={`font-mono text-[11px] tracking-[0.18em] ${ok ? 'text-cyan' : 'text-danger'}`}>
            {ok ? 'On Aristotle' : 'Failed on-chain'}
          </p>
          {verdict ? (
            <p className="mt-4 font-mono text-[22px] font-bold tracking-[0.12em] text-cyan">{verdict}</p>
          ) : null}
          <dl className="mt-6 grid gap-4 text-[15px] md:grid-cols-2">
            <div>
              <dt className="text-muted">From</dt>
              <dd className="mt-1 break-all font-mono text-[12px]">{agent || 'not in this receipt'}</dd>
            </div>
            <div>
              <dt className="text-muted">Action</dt>
              <dd className="mt-1">{action}</dd>
            </div>
            <div>
              <dt className="text-muted">Amount</dt>
              <dd className="mt-1">
                {usdSpent > 0 ? `$${usdSpent.toFixed(3)} USDC.e` : amount || data?.nativeValue0G || 'see explorer'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Result</dt>
              <dd className="mt-1">{ok ? 'Included' : 'Reverted'}</dd>
            </div>
            <div>
              <dt className="text-muted">Block</dt>
              <dd className="mt-1 font-mono text-[12px]">{data.blockNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Storage root</dt>
              <dd className="mt-1 break-all font-mono text-[11px]">{data.storageRoot || 'not in this tx'}</dd>
            </div>
          </dl>
          <details className="mt-8">
            <summary className="cursor-pointer text-[13px] text-muted">Technical details</summary>
            <p className="mt-3 text-[13px] text-white/55">{data.note}</p>
            <dl className="mt-4 grid gap-2 font-mono text-[11px] text-white/70">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-muted">tx</dt>
                <dd className="break-all">{data.tx}</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-muted">to</dt>
                <dd className="break-all">{data.to}</dd>
              </div>
              {(data.usdceTransfers ?? []).map((t) => (
                <div key={`${t.from}-${t.to}-${t.amount}`} className="grid grid-cols-[120px_1fr] gap-3">
                  <dt className="text-muted">USDC.e</dt>
                  <dd className="break-all">
                    ${t.amountUsd?.toFixed(3)} → {t.to}
                  </dd>
                </div>
              ))}
              {(data.vaultEvents ?? []).map((e) => (
                <div key={e.event} className="grid grid-cols-[120px_1fr] gap-3">
                  <dt className="text-muted">{e.event}</dt>
                  <dd className="break-all">{JSON.stringify(e.args)}</dd>
                </div>
              ))}
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

import { quoteHerald, HERALD_ROUTER, OG_CAIP, USDCE_16661, type HeraldQuote } from './x402Herald.js'

export type FactId = 'token-safety' | 'market' | 'contract' | 'holders' | 'activity' | 'reputation'

export type RegistryRow = {
  provider: string
  service: string
  endpoint: string
  description: string
  fact: FactId
  priceUsd?: number
  amount?: string
  network?: string
  asset?: string
  assetName?: string
  paymentScheme: 'exact'
  facilitator: string
  payTo?: string
  settlementStatus: 'settled' | 'quoted' | 'unavailable'
  lastVerified: string
  riskStatus: 'ok' | 'unavailable'
  detail?: string
}

export type Candidate = {
  provider: string
  service: string
  fact: FactId
  description: string
  url: (token: string) => string
  /** Last live pay succeeded. Quote-only is not enough. */
  settledOnce?: boolean
  knownPayFail?: string
  knownUnpayable?: string
}

/** Discovery seeds from live x402-list + Herald probes on 2026-08-20. Not a marketplace. */
export const CANDIDATES: Candidate[] = [
  {
    provider: 'AgentToll',
    service: 'base-safety',
    fact: 'token-safety',
    description: 'Honeypot simulation, taxes, owner powers, holder concentration',
    url: (token) => `https://agenttoll.app/api/base/safety/${token}`,
    knownPayFail:
      'Base-only 402 (eip155:8453). Herald router dest-proxy forwards the 16661 PAYMENT-SIGNATURE; seller TWA reverts. No seller 200.',
  },
  {
    provider: 'api402x',
    service: 'oracle-staleness',
    fact: 'market',
    description: 'Chainlink/Pyth freshness and peg for ETH/BTC/USDC on Base',
    url: () => 'https://api402x.com/oracle-staleness',
    knownPayFail:
      'Base-only 402. Router paid retry returns dest-native 8453 insufficient_balance. No seller 200.',
  },
  {
    provider: 'token-risk',
    service: 'bytecode-scan',
    fact: 'contract',
    description: 'Static bytecode heuristics: proxy, mint, pause, blacklist, owner',
    url: (token) => `https://5-9-107-124.nip.io/token-risk?address=${token}`,
    knownPayFail:
      'Base-only 402. Herald router dest-proxy reverts on the forwarded 16661 signature. No seller 200.',
  },
  {
    provider: 'OnchainPulse',
    service: 'evmtoken',
    fact: 'token-safety',
    description: 'Token-safety verdict (CLEAR/CAUTION/AVOID)',
    url: (token) =>
      `https://onchainpulse.theaslangroupllc.com/api/evmtoken?address=${token}&chain=base`,
    knownPayFail:
      'Direct 402 has no eip155:16661 accept. Router quote is not a seller 200. Not payable from Aristotle.',
  },
  {
    provider: 'PulseFeed',
    service: 'trust',
    fact: 'reputation',
    description: 'x402 seller trust score',
    url: () => 'https://pulsefeed.dev/trust',
    knownUnpayable: 'x402 v1 network=base; Herald did not map eip155:16661.',
  },
  {
    provider: 'TNT House',
    service: 'token-risk',
    fact: 'token-safety',
    description: 'Single token risk score',
    url: () => 'https://tnt-audit.com/api/v1/token-risk/x402',
    knownUnpayable: 'Herald mapped Solana USDC only. Till cannot settle Solana.',
  },
  {
    provider: 'klymax',
    service: 'token-holders',
    fact: 'holders',
    description: 'Token holder concentration (quoted 16661 Exact — not settled)',
    url: (token) => `https://token-holders.api.klymax402.com/?address=${token}&chain=base`,
  },
]

export type PlannedBuy = {
  provider: string
  service: string
  fact: FactId
  url: string
  why: string
  quote: HeraldQuote
}

export async function verifyRegistry(token: string): Promise<RegistryRow[]> {
  const now = new Date().toISOString()
  const rows: RegistryRow[] = []
  for (const c of CANDIDATES) {
    const endpoint = c.url(token)
    if (c.knownUnpayable) {
      rows.push({
        provider: c.provider,
        service: c.service,
        endpoint,
        description: c.description,
        fact: c.fact,
        paymentScheme: 'exact',
        facilitator: HERALD_ROUTER,
        settlementStatus: 'unavailable',
        lastVerified: now,
        riskStatus: 'unavailable',
        detail: c.knownUnpayable,
      })
      continue
    }
    if (c.knownPayFail) {
      try {
        const q = await quoteHerald(endpoint, c.provider)
        rows.push({
          provider: c.provider,
          service: c.service,
          endpoint,
          description: c.description,
          fact: c.fact,
          priceUsd: q.amountUsd,
          amount: q.amount,
          network: q.network,
          asset: q.asset,
          assetName: q.assetName,
          paymentScheme: 'exact',
          facilitator: HERALD_ROUTER,
          payTo: q.payTo,
          settlementStatus: 'unavailable',
          lastVerified: now,
          riskStatus: 'unavailable',
          detail: c.knownPayFail,
        })
      } catch (e) {
        rows.push({
          provider: c.provider,
          service: c.service,
          endpoint,
          description: c.description,
          fact: c.fact,
          paymentScheme: 'exact',
          facilitator: HERALD_ROUTER,
          settlementStatus: 'unavailable',
          lastVerified: now,
          riskStatus: 'unavailable',
          detail: (e as Error).message.slice(0, 200),
        })
      }
      continue
    }
    try {
      const q = await quoteHerald(endpoint, c.provider)
      const og = q.network === OG_CAIP && q.asset.toLowerCase() === USDCE_16661.toLowerCase()
      rows.push({
        provider: c.provider,
        service: c.service,
        endpoint,
        description: c.description,
        fact: c.fact,
        priceUsd: q.amountUsd,
        amount: q.amount,
        network: q.network,
        asset: q.asset,
        assetName: q.assetName,
        paymentScheme: 'exact',
        facilitator: HERALD_ROUTER,
        payTo: q.payTo,
        settlementStatus: c.settledOnce && og ? 'settled' : og ? 'quoted' : 'unavailable',
        lastVerified: now,
        riskStatus: og ? 'ok' : 'unavailable',
        detail: og ? undefined : `Wrong rail: ${q.network} ${q.assetName}`,
      })
    } catch (e) {
      rows.push({
        provider: c.provider,
        service: c.service,
        endpoint,
        description: c.description,
        fact: c.fact,
        paymentScheme: 'exact',
        facilitator: HERALD_ROUTER,
        settlementStatus: 'unavailable',
        lastVerified: now,
        riskStatus: 'unavailable',
        detail: (e as Error).message.slice(0, 200),
      })
    }
  }
  return rows
}

export async function probeBazaar(): Promise<{
  endpoint: string
  network: string
  hits: number
  note: string
}> {
  const endpoint =
    'https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=token+safety&network=eip155:16661&limit=10'
  try {
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } })
    const body = (await res.json().catch(() => null)) as { items?: unknown[]; resources?: unknown[]; data?: unknown[] } | null
    const hits = Array.isArray(body?.items)
      ? body.items.length
      : Array.isArray(body?.resources)
        ? body.resources.length
        : Array.isArray(body?.data)
          ? body.data.length
          : 0
    return {
      endpoint,
      network: 'eip155:16661',
      hits,
      note:
        hits === 0
          ? 'CDP x402 V2 Bazaar does not currently index eip155:16661. Till discovers specialized sellers, then Herald-quotes 16661 USDC.e before any buy.'
          : `CDP Bazaar returned ${hits} hit(s) for 16661. Still require Herald quote + settlement before buy.`,
    }
  } catch (e) {
    return {
      endpoint,
      network: 'eip155:16661',
      hits: 0,
      note: `Bazaar probe failed: ${(e as Error).message}. Herald live-quote remains the source of truth.`,
    }
  }
}

const NEEDED: { fact: FactId; why: string }[] = [
  { fact: 'token-safety', why: 'Is it a honeypot, taxed, or owner-controlled?' },
  { fact: 'market', why: 'Is the oracle/peg fresh enough to trust the price?' },
  { fact: 'contract', why: 'What privileges does the bytecode actually expose?' },
]

export async function planProcurement(token: string): Promise<{
  registry: RegistryRow[]
  buys: PlannedBuy[]
  skipped: { seller: string; status: string; detail: string }[]
  facts: { fact: FactId; why: string }[]
  bazaar: Awaited<ReturnType<typeof probeBazaar>>
}> {
  const [registry, bazaar] = await Promise.all([verifyRegistry(token), probeBazaar()])
  const buys: PlannedBuy[] = []
  const used = new Set<string>()
  for (const need of NEEDED) {
    const row = registry
      .filter(
        (r) =>
          r.fact === need.fact &&
          r.settlementStatus === 'settled' &&
          r.riskStatus === 'ok' &&
          r.priceUsd != null &&
          r.amount &&
          r.payTo &&
          r.asset
      )
      .filter((r) => !used.has(r.provider))
      .sort((a, b) => (a.priceUsd ?? 99) - (b.priceUsd ?? 99))[0]
    if (!row) continue
    used.add(row.provider)
    buys.push({
      provider: row.provider,
      service: row.service,
      fact: need.fact,
      url: row.endpoint,
      why: `${need.why} ${row.description}`,
      quote: {
        destination: row.endpoint,
        seller: row.provider,
        description: row.description,
        network: row.network!,
        asset: row.asset!,
        assetName: row.assetName ?? 'USDC.e',
        amount: row.amount!,
        amountUsd: row.priceUsd!,
        payTo: row.payTo!,
        router: `${HERALD_ROUTER}?url=${encodeURIComponent(row.endpoint)}`,
      },
    })
  }
  const skipped = registry
    .filter((r) => r.settlementStatus !== 'settled')
    .map((r) => ({
      seller: `${r.provider}/${r.service}`,
      status: r.settlementStatus,
      detail: r.detail ?? (r.settlementStatus === 'quoted' ? 'Quoted on 16661 — not production until a settlement tx is recorded.' : 'unavailable'),
    }))
  return { registry, buys, skipped, facts: NEEDED, bazaar }
}

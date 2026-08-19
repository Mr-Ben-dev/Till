import { ethers } from 'ethers'
import { evaluateIntent, writeBrief } from '@till/sdk'
import { OG_RPC_URL } from '@till/config'
import { HERALD_ROUTER, OG_CAIP, USDCE_16661, payHerald, type HeraldQuote } from './x402Herald.js'
import { planProcurement, type RegistryRow } from './registry.js'

export const DEFAULT_BASE_TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const HERALD_PAYTO = '0x686Ca1f3BAf7F7Df3334f2f1A65AE314ee9CDb29'
export const DEFAULT_USDCE_CAP_ATOMIC = process.env.TILL_USDCE_MAX_ATOMIC ?? '500000'

export type PurchaseRecord = {
  seller: string
  sku: string
  fact: string
  url: string
  why: string
  quote: HeraldQuote
  status: number
  body: unknown
  settlement: unknown
  ogTx?: string
  destTx?: string
}

function checksum(addr: string) {
  return ethers.getAddress(addr)
}

export function parseMission(subject: string) {
  const m = subject.match(/0x[a-fA-F0-9]{40}/)
  return { subject, token: checksum(m?.[0] ?? DEFAULT_BASE_TOKEN) }
}

async function usdceBalance(owner: string) {
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const c = new ethers.Contract(USDCE_16661, ['function balanceOf(address) view returns (uint256)'], provider)
  const raw = (await c.balanceOf(owner)) as bigint
  return { atomic: raw.toString(), usd: Number(raw) / 1e6 }
}

function settlementTx(settlement: unknown): { ogTx?: string; destTx?: string } {
  const s = settlement as {
    transaction?: string
    extensions?: { 'heraldprotocol-router'?: { settlement?: { transaction?: string } } }
  } | null
  return {
    ogTx: s?.transaction,
    destTx: s?.extensions?.['heraldprotocol-router']?.settlement?.transaction,
  }
}

export async function discoverMission(subject: string) {
  const parsed = parseMission(subject)
  const planned = await planProcurement(parsed.token)
  const totalAtomic = planned.buys.reduce((n, b) => n + BigInt(b.quote.amount), 0n)
  return {
    subject: parsed.subject,
    token: parsed.token,
    network: OG_CAIP,
    asset: USDCE_16661,
    assetName: 'USDC.e',
    router: HERALD_ROUTER,
    payTo: HERALD_PAYTO,
    capAtomic: DEFAULT_USDCE_CAP_ATOMIC,
    capUsd: Number(DEFAULT_USDCE_CAP_ATOMIC) / 1e6,
    facts: planned.facts,
    registry: planned.registry,
    quotes: planned.buys.map((b) => ({
      seller: b.provider,
      sku: b.service,
      fact: b.fact,
      url: b.url,
      why: b.why,
      quote: b.quote,
    })),
    totalAtomic: totalAtomic.toString(),
    totalUsd: Number(totalAtomic) / 1e6,
    skipped: planned.skipped,
    bazaar: planned.bazaar,
    plan: [
      'I need three independent external checks before you pay.',
      ...planned.buys.map(
        (b) => `${b.provider} ${b.service} · $${b.quote.amountUsd.toFixed(3)} · ${b.fact}`
      ),
      `Total $${(Number(totalAtomic) / 1e6).toFixed(3)} of $${(Number(DEFAULT_USDCE_CAP_ATOMIC) / 1e6).toFixed(2)} cap.`,
      '0G TEE must approve. Then buy, correlate, return BUY / HOLD / AVOID.',
    ],
  }
}

export async function blockOverBudget(requestedUsd: number, capAtomic = DEFAULT_USDCE_CAP_ATOMIC) {
  const requestedAtomic = BigInt(Math.round(requestedUsd * 1e6))
  const cap = BigInt(capAtomic)
  const blocked = requestedAtomic > cap
  return {
    blocked,
    requestedUsd,
    requestedAtomic: requestedAtomic.toString(),
    capAtomic: cap.toString(),
    capUsd: Number(cap) / 1e6,
    spentUsd: 0,
    reason: blocked
      ? `BLOCKED. Requested $${requestedUsd.toFixed(2)} exceeds the Till cap of $${(Number(cap) / 1e6).toFixed(2)}. $0 spent.`
      : 'Within cap.',
  }
}

export async function runMission(opts: {
  subject: string
  tokenId: string
  maxAtomic?: string
  owner?: string
  grantId?: string
}) {
  const capAtomic = opts.maxAtomic ?? DEFAULT_USDCE_CAP_ATOMIC
  const discovery = await discoverMission(opts.subject)
  const total = BigInt(discovery.totalAtomic)
  const cap = BigInt(capAtomic)
  if (total > cap) {
    const over = await blockOverBudget(discovery.totalUsd, capAtomic)
    return { ok: false as const, blocked: true, discovery, over, purchases: [] as PurchaseRecord[] }
  }
  const owner = opts.owner ?? process.env.DEPLOYER_ADDRESS ?? ''
  if (owner) {
    const bal = await usdceBalance(owner)
    if (BigInt(bal.atomic) < total) {
      return {
        ok: false as const,
        blocked: true,
        discovery,
        over: {
          blocked: true,
          requestedUsd: discovery.totalUsd,
          capAtomic,
          spentUsd: 0,
          reason: `BLOCKED. Need ${discovery.totalUsd} USDC.e, wallet holds ${bal.usd}. $0 spent.`,
        },
        purchases: [] as PurchaseRecord[],
      }
    }
  }

  const intended = discovery.quotes.map((q) => ({
    destination: q.url,
    asset: q.quote.asset,
    amount: q.quote.amount,
    resource: q.url,
    reason: q.why,
    grant: opts.grantId ?? `till-${opts.tokenId}`,
    deadline: Math.floor(Date.now() / 1000) + 600,
  }))
  const digest = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ tokenId: opts.tokenId, intended })))
  const ev = await evaluateIntent({
    role: 'fastPolicy',
    digest,
    tokenId: opts.tokenId,
    target: HERALD_PAYTO,
    amountWei: discovery.totalAtomic,
    resource: JSON.stringify(intended),
  })
  if (!ev.decision.allow) {
    return {
      ok: false as const,
      blocked: true,
      discovery,
      digest,
      eval: ev,
      over: {
        blocked: true,
        spentUsd: 0,
        reason: ev.decision.reason || 'TEE denied this procurement.',
      },
      purchases: [] as PurchaseRecord[],
    }
  }

  const purchases: PurchaseRecord[] = []
  for (const q of discovery.quotes) {
    const paid = await payHerald(q.url, capAtomic)
    const txs = settlementTx(paid.settlement)
    purchases.push({
      seller: q.seller,
      sku: q.sku,
      fact: q.fact,
      url: q.url,
      why: q.why,
      quote: q.quote,
      status: paid.status,
      body: paid.body,
      settlement: paid.settlement,
      ...txs,
    })
  }

  const spentUsd = purchases.reduce((n, p) => n + p.quote.amountUsd, 0)
  const brief = await writeBrief({
    subject: opts.subject,
    facts: {
      mission: 'before-you-pay',
      token: discovery.token,
      verdictRequired: 'BUY | HOLD | AVOID',
      chainNote: 'Paid scanners cover Base. Settlement rail is 0G Aristotle USDC.e via Herald.',
      purchases: purchases.map((p) => ({
        provider: p.seller,
        service: p.sku,
        fact: p.fact,
        paidUsd: p.quote.amountUsd,
        ogTx: p.ogTx,
        destTx: p.destTx,
        body: p.body,
      })),
      skipped: discovery.skipped,
      spentUsd,
      capUsd: discovery.capUsd,
      remainingUsd: discovery.capUsd - spentUsd,
      instruction:
        'Cite ONLY paid JSON. Do not invent unpaid data. verdict must be BUY, HOLD, or AVOID from paid checks only. Not financial advice.',
    },
  })

  return {
    ok: true as const,
    blocked: false,
    discovery,
    digest,
    eval: {
      model: ev.model,
      provider: ev.provider,
      chatId: ev.chatId,
      processResponse: ev.processResponse,
      teeVerifiedRouter: ev.teeVerifiedRouter,
      teeSigner: ev.teeSigner,
      packed: ev.packed,
      teeSignature: ev.teeSignature,
      decision: ev.decision,
    },
    purchases,
    spentAtomic: discovery.totalAtomic,
    spentUsd,
    remainingUsd: discovery.capUsd - spentUsd,
    brief: brief.brief,
    briefModel: brief.model.id,
    briefProvider: brief.provider,
    briefChatId: brief.chatId,
    briefProcessResponse: brief.processResponse,
    briefTeeVerifiedRouter: brief.teeVerifiedRouter,
    trust: 'private',
  }
}

export type { RegistryRow }
// note

import { ethers } from 'ethers'
import { evaluateIntent, writeBrief } from '@till/sdk'
import { OG_RPC_URL } from '@till/config'
import {
  HERALD_ROUTER,
  OG_CAIP,
  USDCE_16661,
  payHerald,
  quoteAccept,
  settleWithPaymentPayload,
  type HeraldQuote,
  type PaymentPayload,
} from './x402Herald.js'
import { planProcurement, type RegistryRow } from './registry.js'
import { compileMission, type MissionFamily } from './compiler.js'
import { GateError, assertMissionGate } from './gate.js'
import { putReceipt } from './store.js'

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
  payer?: string
}

function checksum(addr: string) {
  return ethers.getAddress(addr)
}

export function parseMission(subject: string) {
  const m = subject.match(/0x[a-fA-F0-9]{40}/)
  return { subject, token: checksum(m?.[0] ?? DEFAULT_BASE_TOKEN) }
}

function settlementTx(settlement: unknown): { ogTx?: string; destTx?: string } {
  const s = settlement as {
    transaction?: string
    success?: boolean
    payer?: string
    extensions?: { 'heraldprotocol-router'?: { settlement?: { transaction?: string } } }
  } | null
  return {
    ogTx: s?.transaction,
    destTx: s?.extensions?.['heraldprotocol-router']?.settlement?.transaction,
  }
}

export async function discoverMission(subject: string, family?: MissionFamily) {
  const compiled = compileMission({ text: subject, family })
  if (!compiled.ok) {
    return {
      compiled,
      subject,
      token: compiled.target,
      quotes: [] as unknown[],
      totalAtomic: '0',
      totalUsd: 0,
      capAtomic: DEFAULT_USDCE_CAP_ATOMIC,
      capUsd: Number(DEFAULT_USDCE_CAP_ATOMIC) / 1e6,
      plan: compiled.ask ? [compiled.ask] : compiled.refuse ? [compiled.refuse] : [],
      skipped: [] as unknown[],
      needsProcurement: compiled.needsProcurement,
      family: compiled.family,
      familyLabel: compiled.familyLabel,
      drawerNote:
        'USDC.e is limited by this mission\'s session drawer, not by TillPolicy. Native 0G policy is a separate vault rail.',
    }
  }
  if (!compiled.needsProcurement) {
    return {
      compiled,
      subject,
      token: compiled.target,
      network: OG_CAIP,
      asset: USDCE_16661,
      assetName: 'USDC.e',
      router: HERALD_ROUTER,
      payTo: HERALD_PAYTO,
      capAtomic: DEFAULT_USDCE_CAP_ATOMIC,
      capUsd: Number(DEFAULT_USDCE_CAP_ATOMIC) / 1e6,
      facts: [],
      registry: [],
      quotes: [],
      totalAtomic: '0',
      totalUsd: 0,
      skipped: [],
      bazaar: null,
      needsProcurement: false,
      family: compiled.family,
      familyLabel: compiled.familyLabel,
      expectedOutput: compiled.expectedOutput,
      drawerNote:
        'USDC.e is limited by this mission\'s session drawer, not by TillPolicy. Native 0G policy is a separate vault rail.',
      plan: [
        compiled.goal,
        '0G Compute writes the private result. No x402 purchase on this family until a SKU is SETTLED.',
        compiled.proof,
      ],
    }
  }
  const parsed = parseMission(subject)
  const planned = await planProcurement(parsed.token)
  const totalAtomic = planned.buys.reduce((n, b) => n + BigInt(b.quote.amount), 0n)
  const accepts = await Promise.all(
    planned.buys.map(async (b) => {
      try {
        const a = await quoteAccept(b.url)
        return { url: b.url, ...a }
      } catch (e) {
        return { url: b.url, error: (e as Error).message }
      }
    })
  )
  return {
    compiled,
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
    accepts,
    totalAtomic: totalAtomic.toString(),
    totalUsd: Number(totalAtomic) / 1e6,
    skipped: planned.skipped,
    bazaar: planned.bazaar,
    needsProcurement: true,
    family: compiled.family,
    familyLabel: compiled.familyLabel,
    expectedOutput: compiled.expectedOutput,
    fundAtomic: totalAtomic.toString(),
    fundUsd: Number(totalAtomic) / 1e6,
    drawerMaxUsd: 0.5,
    drawerNote:
      'USDC.e is limited by this mission\'s session drawer, not by TillPolicy. Native 0G policy is a separate vault rail.',
    plan: [
      compiled.goal,
      ...planned.buys.map((b) => `${b.provider} ${b.service} · $${b.quote.amountUsd.toFixed(3)} · ${b.fact}`),
      `Fund the session drawer $${(Number(totalAtomic) / 1e6).toFixed(3)} (hard max $0.50). Sweep remainder after the result. Revoke does not claw back USDC.e.`,
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
    label: 'Test over-budget spend',
    headline: blocked ? '$5 requested · $0 spent · $0.50 mission limit' : 'Within cap.',
    reason: blocked
      ? `BLOCKED. Test over-budget spend: requested $${requestedUsd.toFixed(2)} exceeds the $${(Number(cap) / 1e6).toFixed(2)} session-drawer application cap. $0 spent. This is not a real purchase.`
      : 'Within cap.',
  }
}

async function finishBrief(opts: {
  subject: string
  family: MissionFamily
  token: string
  purchases: PurchaseRecord[]
  discovery: Awaited<ReturnType<typeof discoverMission>>
  spentUsd: number
  artifact?: string
}) {
  const family = opts.family
  return writeBrief({
    subject: opts.subject,
    facts: {
      missionFamily: family,
      mission:
        family === 'pay'
          ? 'before-you-pay'
          : family === 'trust'
            ? 'before-you-trust'
            : family === 'review'
              ? 'review-this'
              : 'research',
      token: opts.token,
      artifact: opts.artifact ? opts.artifact.slice(0, 12_000) : undefined,
      chainNote:
        'Paid scanners, if any, may describe Base. Settlement rail is 0G Aristotle USDC.e via Herald. USDC.e is session-drawer limited, not TillPolicy.',
      purchases: opts.purchases.map((p) => ({
        provider: p.seller,
        service: p.sku,
        fact: p.fact,
        paidUsd: p.quote.amountUsd,
        ogTx: p.ogTx,
        destTx: p.destTx,
        payer: p.payer,
        body: p.body,
      })),
      skipped: opts.discovery.skipped,
      spentUsd: opts.spentUsd,
      capUsd: opts.discovery.capUsd,
      remainingUsd: (opts.discovery.capUsd ?? 0.5) - opts.spentUsd,
      instruction:
        family === 'review'
          ? 'AI-assisted review — not a certified audit. Cite only the artifact and paid JSON.'
          : 'Cite ONLY paid JSON. Do not invent unpaid data. Not financial advice.',
    },
  })
}

export async function runMission(opts: {
  subject: string
  tokenId: string
  maxAtomic?: string
  owner?: string
  grantId?: string
  family?: MissionFamily
  artifact?: string
  session?: string
  payments?: PaymentPayload[]
  rail?: 'session' | 'operator'
}) {
  const capAtomic = opts.maxAtomic ?? DEFAULT_USDCE_CAP_ATOMIC
  const compiled = compileMission({ text: opts.subject, family: opts.family, artifact: opts.artifact })
  if (!compiled.ok) {
    return {
      ok: false as const,
      blocked: true,
      compiled,
      over: { blocked: true, spentUsd: 0, reason: compiled.refuse || compiled.ask || 'Incomplete mission' },
      purchases: [] as PurchaseRecord[],
    }
  }
  const family = compiled.family as MissionFamily
  const discovery = await discoverMission(opts.subject, family)
  const total = BigInt(String(discovery.totalAtomic ?? '0'))
  const cap = BigInt(capAtomic)
  if (total > cap) {
    const over = await blockOverBudget(Number(discovery.totalUsd), capAtomic)
    return { ok: false as const, blocked: true, discovery, over, purchases: [] as PurchaseRecord[] }
  }

  const rail = opts.rail ?? (opts.payments?.length ? 'session' : opts.session ? 'session' : 'operator')
  const owner = opts.owner ?? process.env.DEPLOYER_ADDRESS ?? ''
  if (!owner) {
    return {
      ok: false as const,
      blocked: true,
      discovery,
      over: { blocked: true, spentUsd: 0, reason: 'Owner address required.' },
      purchases: [] as PurchaseRecord[],
    }
  }

  try {
    await assertMissionGate({
      owner,
      tokenId: opts.tokenId,
      session: opts.session,
      quoteAtomic: total > 0n && rail === 'session' ? total : undefined,
    })
  } catch (e) {
    const g = e as GateError
    return {
      ok: false as const,
      blocked: true,
      discovery,
      over: { blocked: true, spentUsd: 0, reason: g.message, code: g.code },
      purchases: [] as PurchaseRecord[],
    }
  }

  const intended =
    discovery.quotes.length > 0
      ? discovery.quotes.map((q: { url: string; quote: HeraldQuote; why: string }) => ({
          destination: q.url,
          asset: q.quote.asset,
          amount: q.quote.amount,
          resource: q.url,
          reason: q.why,
          grant: opts.grantId ?? `till-${opts.tokenId}`,
          deadline: Math.floor(Date.now() / 1000) + 600,
        }))
      : [
          {
            destination: 'compute-only',
            asset: '0G-compute',
            amount: '0',
            resource: `till://${family}`,
            reason: compiled.goal ?? family,
            grant: opts.grantId ?? `till-${opts.tokenId}`,
            deadline: Math.floor(Date.now() / 1000) + 600,
          },
        ]
  const digest = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ tokenId: opts.tokenId, intended })))
  const ev = await evaluateIntent({
    role: family === 'review' ? 'highRisk' : 'fastPolicy',
    digest,
    tokenId: opts.tokenId,
    target: HERALD_PAYTO,
    amountWei: discovery.totalAtomic ?? '0',
    resource: JSON.stringify(intended),
  })
  if (!ev.decision.allow) {
    return {
      ok: false as const,
      blocked: true,
      discovery,
      digest,
      eval: ev,
      over: { blocked: true, spentUsd: 0, reason: ev.decision.reason || 'TEE denied this mission.' },
      purchases: [] as PurchaseRecord[],
    }
  }

  const purchases: PurchaseRecord[] = []
  if (discovery.quotes.length) {
    if (rail === 'session') {
      if (!opts.session) {
        return {
          ok: false as const,
          blocked: true,
          discovery,
          over: { blocked: true, spentUsd: 0, reason: 'APP path requires the authorized session address.' },
          purchases: [],
        }
      }
      if (!opts.payments?.length) {
        return {
          ok: false as const,
          blocked: true,
          discovery,
          over: {
            blocked: true,
            spentUsd: 0,
            reason: 'APP path requires session-signed EIP-3009 PAYMENT-SIGNATURE payloads. Operator key is never used here.',
          },
          purchases: [],
        }
      }
      if (opts.payments.length !== discovery.quotes.length) {
        return {
          ok: false as const,
          blocked: true,
          discovery,
          over: { blocked: true, spentUsd: 0, reason: 'Signed payment count does not match quoted SKUs.' },
          purchases: [],
        }
      }
      for (let i = 0; i < discovery.quotes.length; i++) {
        const q = discovery.quotes[i] as { seller: string; sku: string; fact: string; url: string; why: string; quote: HeraldQuote }
        const pay = opts.payments[i]!
        const from = pay.payload?.authorization?.from
        if (!from || from.toLowerCase() !== opts.session.toLowerCase()) {
          return {
            ok: false as const,
            blocked: true,
            discovery,
            over: {
              blocked: true,
              spentUsd: 0,
              reason: `EIP-3009 from ${from ?? 'missing'} is not the authorized session ${opts.session}.`,
            },
            purchases,
          }
        }
        const paid = await settleWithPaymentPayload(q.url, pay)
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
          payer: from,
          ...txs,
        })
      }
    } else {
      for (const q of discovery.quotes as { seller: string; sku: string; fact: string; url: string; why: string; quote: HeraldQuote }[]) {
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
          payer: process.env.DEPLOYER_ADDRESS,
          ...txs,
        })
      }
    }
  }

  const spentUsd = purchases.reduce((n, p) => n + p.quote.amountUsd, 0)
  const brief = await finishBrief({
    subject: opts.subject,
    family,
    token: String(discovery.token ?? ''),
    purchases,
    discovery,
    spentUsd,
    artifact: opts.artifact,
  })

  const result = {
    ok: true as const,
    blocked: false,
    family,
    familyLabel: compiled.familyLabel,
    rail,
    signerLabel:
      rail === 'session'
        ? 'Session EOA signed EIP-3009. ChainScan Transfer.from must equal the session address.'
        : 'OPERATOR rail: MCP used the configured operator signer, not the browser session. Not the APP path.',
    drawerNote:
      'USDC.e is limited by this mission\'s session drawer, not by TillPolicy.',
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
    remainingUsd: (discovery.capUsd ?? 0.5) - spentUsd,
    brief: brief.brief,
    briefModel: brief.model.id,
    briefProvider: brief.provider,
    briefChatId: brief.chatId,
    briefProcessResponse: brief.processResponse,
    briefTeeVerifiedRouter: brief.teeVerifiedRouter,
    trust: 'private',
    sweepRequired: rail === 'session',
    revokeNote: 'Revoke does not move leftover USDC.e. Sweep the session drawer to the owner first.',
  }
  const proofTx = purchases[0]?.ogTx
  if (proofTx) {
    putReceipt({
      id: `mission:${opts.tokenId}:${proofTx}`,
      tx: proofTx,
      tokenId: opts.tokenId,
      family,
      session: opts.session,
      owner,
      rail,
      spentUsd,
      verdict: brief.brief.verdict,
      model: brief.model.id,
      processResponse: brief.processResponse === true,
      purchases,
      createdAt: new Date().toISOString(),
    })
  }
  return result
}

export type { RegistryRow }

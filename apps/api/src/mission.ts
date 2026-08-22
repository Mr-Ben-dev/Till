import { ethers } from 'ethers'
import { evaluateIntent, writeBrief, type AutoPreset } from '@till/sdk'
import { OG_RPC_URL } from '@till/config'
import {
  HERALD_ROUTER,
  OG_CAIP,
  USDCE_16661,
  payHerald,
  settleWithPaymentPayload,
  type HeraldQuote,
  type PaymentPayload,
} from './x402Herald.js'
import { type RegistryRow } from './registry.js'
import { compileMission, type MissionFamily } from './compiler.js'
import { GateError, assertMissionGate } from './gate.js'
import { putReceipt } from './store.js'
import { publicFactsFor } from './onchainFacts.js'

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

export async function discoverMission(subject: string, family?: MissionFamily, artifact?: string) {
  const compiled = compileMission({ text: subject, family, artifact })
  const publicFacts = compiled.ok
    ? await publicFactsFor(subject, [compiled.target, compiled.targetB].filter(Boolean) as string[])
    : null
  const moneyNote =
    'Work Desk uses native 0G Compute (Payment Layer bills the operator key). TillPolicy caps vault 0G. x402 is optional external work, not this path.'
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
      needsProcurement: false,
      payable: true,
      family: compiled.family,
      familyLabel: compiled.familyLabel,
      publicFacts,
      moneyNote,
      copilot: compiled.copilot,
    }
  }
  return {
    compiled,
    subject,
    token: compiled.target,
    targetB: compiled.targetB,
    network: OG_CAIP,
    asset: 'native-0G',
    assetName: '0G',
    router: HERALD_ROUTER,
    payTo: HERALD_PAYTO,
    capAtomic: '0',
    capUsd: 0,
    facts: [],
    registry: [],
    quotes: [],
    totalAtomic: '0',
    totalUsd: 0,
    skipped: [],
    bazaar: null,
    needsProcurement: false,
    payable: true,
    family: compiled.family,
    familyLabel: compiled.familyLabel,
    expectedOutput: compiled.expectedOutput,
    publicFacts,
    moneyNote,
    privacy: {
      private: true,
      teeRequired: true,
      sharedWithSellers: false,
      stored: 'encrypted-aes256-backend-holds-key',
      onChain: 'digest-and-storage-root-only',
    },
    plan: [
      compiled.goal,
      'AUTO selects a live TeeML model. 0G Compute writes the private result.',
      'Public Aristotle RPC facts are included. No x402 seller is called.',
      compiled.proof,
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
  preset?: AutoPreset
}) {
  const family = opts.family
  return writeBrief({
    subject: opts.subject,
    preset: opts.preset,
    facts: {
      missionFamily: family,
      mission: family,
      token: opts.token,
      artifact: opts.artifact ? opts.artifact.slice(0, 12_000) : undefined,
      publicFacts: opts.discovery.publicFacts ?? null,
      chainNote:
        'Work Desk uses public Aristotle RPC facts plus 0G Compute. No x402 seller is called on this path. Payment Layer bills the operator Compute key, not TillVault.',
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
          ? 'AI-assisted review — not a certified audit. Cite only the artifact and publicFacts.'
          : 'Cite only publicFacts and the user request. Do not invent paid scanner data. Not financial advice.',
    },
  })
}

export async function runMission(opts: {
  subject: string
  tokenId: string
  maxAtomic?: string
  owner?: string
  grantId?: string
  family?: string
  artifact?: string
  session?: string
  payments?: PaymentPayload[]
  rail?: 'session' | 'operator'
  preset?: AutoPreset
  customModel?: string
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
  const discovery = await discoverMission(opts.subject, family, opts.artifact)
  const total = BigInt(String(discovery.totalAtomic ?? '0'))
  const cap = BigInt(capAtomic)
  if (total > cap) {
    const over = await blockOverBudget(Number(discovery.totalUsd), capAtomic)
    return { ok: false as const, blocked: true, discovery, over, purchases: [] as PurchaseRecord[] }
  }
  const rail = opts.rail ?? (opts.session ? 'session' : 'operator')
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
            destination: '0g-compute',
            asset: '0G-compute',
            amount: '0',
            resource: `till://${family}`,
            reason: compiled.goal ?? family,
            grant: opts.grantId ?? `till-${opts.tokenId}`,
            deadline: Math.floor(Date.now() / 1000) + 600,
          },
        ]
  const digest = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ tokenId: opts.tokenId, intended })))
  const workTarget = process.env.TILL_VAULT || '0x0000000000000000000000000000000000000000'
  const preset = opts.preset ?? 'auto'
  const ev = await evaluateIntent({
    role: family === 'review' ? 'highRisk' : 'fastPolicy',
    digest,
    tokenId: opts.tokenId,
    target: workTarget,
    amountWei: '0',
    resource: JSON.stringify(intended),
    preset,
    customModel: opts.customModel,
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
    preset,
  })

  const result = {
    ok: true as const,
    blocked: false,
    family,
    familyLabel: compiled.familyLabel,
    rail,
    signerLabel:
      rail === 'session'
        ? 'READY session. No MetaMask. 0G Compute via Router; Payment Layer is the operator Compute account, not TillVault. Session pays Storage gas and PacketAnchored.'
        : 'OPERATOR rail: MCP used the configured operator for Compute. Not the browser session. Cannot Storage-anchor without a session key.',
    moneyNote:
      '0G Compute tokens are billed to the operator Payment Layer. TillVault is not debited for model tokens. Session native 0G is spent as Storage gas when the packet is anchored.',
    drawerNote: 'Work Desk does not use the USDC.e session drawer.',
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
    proofId: brief.chatId,
    trust: 'private',
    selection: {
      mode: preset,
      model: ev.model.id,
      provider: ev.provider,
      trustMode: 'private',
      tee: ev.model.verifiability ?? '',
      reason:
        preset === 'auto'
          ? `AUTO selected ${ev.model.id} (${ev.model.verifiability || 'TeeML'}) for ${family}.`
          : `User chose ${preset}; live catalog resolved ${ev.model.id}.`,
    },
    sweepRequired: rail === 'session',
    revokeNote: 'Revoke does not move leftover USDC.e. Sweep the session drawer to the owner first.',
  }
  const proofTx = purchases[0]?.ogTx || brief.chatId
  putReceipt({
    id: `mission:${opts.tokenId}:${proofTx}`,
    tx: proofTx,
    tokenId: opts.tokenId,
    family,
    session: opts.session,
    owner,
    rail,
    spentUsd: 0,
    verdict: brief.brief.verdict,
    model: brief.model.id,
    processResponse: brief.processResponse === true,
    purchases,
    createdAt: new Date().toISOString(),
  })
  return result
}

export type { RegistryRow }

import { API, X402 } from './chain'

async function parse(res: Response) {
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* raw */
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body && 'error' in body
        ? String((body as { error: string }).error)
        : text || `${res.status}`
    throw new Error(msg)
  }
  return body
}

export async function apiHealth() {
  const res = await fetch(`${API}/health`)
  return parse(res) as Promise<{ ok: boolean; chainId: string; simulate: boolean }>
}

export async function liveModels() {
  const res = await fetch(`${API}/v1/models/live`)
  return parse(res) as Promise<{
    count: number
    roles: Record<string, string>
    presets?: Record<string, string>
    spendAllow?: { id: string; provider: string; verifiability: string; tee: boolean }[]
    fetchedAt: string
    note?: string
  }>
}

export type RegistryRow = {
  provider: string
  service: string
  endpoint: string
  description: string
  fact: string
  priceUsd?: number
  network?: string
  assetName?: string
  paymentScheme: string
  facilitator: string
  settlementStatus: 'settled' | 'quoted' | 'unavailable'
  lastVerified: string
  riskStatus: 'ok' | 'unavailable'
  detail?: string
}

export type MissionQuote = {
  seller: string
  sku: string
  fact?: string
  url: string
  why: string
  quote: {
    amount: string
    amountUsd: number
    assetName: string
    network: string
    payTo: string
    description: string
  }
}

export type MissionDiscover = {
  compiled?: {
    ok?: boolean
    family?: string
    familyLabel?: string
    refuse?: string
    ask?: string
    goal?: string
    expectedOutput?: string
  }
  subject: string
  token?: string | null
  network?: string
  assetName?: string
  capAtomic?: string
  capUsd: number
  facts?: { fact: string; why: string }[]
  registry?: RegistryRow[]
  quotes: MissionQuote[]
  accepts?: {
    url: string
    resourceUrl?: string
    resource?: { url?: string; description?: string; mimeType?: string }
    accept?: {
      scheme: string
      network: string
      amount: string
      asset: string
      payTo: string
      extra?: { name?: string; version?: string }
      maxTimeoutSeconds?: number
    }
    error?: string
  }[]
  totalAtomic: string
  totalUsd: number
  plan: string[]
  skipped: { seller: string; status: string; detail: string }[]
  bazaar?: { network: string; hits: number; note: string }
  family?: string
  familyLabel?: string
  needsProcurement?: boolean
  payable?: boolean
  blockReason?: string
  drawerNote?: string
  moneyNote?: string
  privacy?: { private?: boolean; sharedWithSellers?: boolean }
}

export type PurchaseRecord = {
  seller: string
  sku: string
  fact?: string
  url: string
  why?: string
  quote: { amountUsd: number; amount: string; assetName: string; network: string }
  status: number
  body: unknown
  ogTx?: string
  destTx?: string
  payer?: string
}

export type MissionRun = {
  ok: boolean
  blocked?: boolean
  family?: string
  familyLabel?: string
  rail?: 'session' | 'operator'
  signerLabel?: string
  drawerNote?: string
  discovery?: MissionDiscover
  digest?: string
  eval?: {
    model?: { id: string }
    provider?: string
    chatId?: string
    processResponse?: boolean
    teeVerifiedRouter?: boolean
    teeSigner?: string
    packed?: string
    teeSignature?: string
  }
  purchases?: PurchaseRecord[]
  spentUsd?: number
  remainingUsd?: number
  brief?: BriefDoc
  briefModel?: string
  briefProvider?: string
  briefChatId?: string
  briefProcessResponse?: boolean
  briefTeeVerifiedRouter?: boolean
  proofId?: string
  moneyNote?: string
  trust?: string
  selection?: {
    mode?: string
    model?: string
    provider?: string
    trustMode?: string
    tee?: string
    reason?: string
  }
  over?: { blocked?: boolean; spentUsd?: number; reason?: string; capUsd?: number; requestedUsd?: number }
  error?: string
}

export async function compileMission(input: { text: string; family?: string; artifact?: string }) {
  const res = await fetch(`${API}/v1/mission/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parse(res) as Promise<{
    ok: boolean
    family?: string
    familyLabel?: string
    refuse?: string
    ask?: string
    goal?: string
    target?: string | null
    expectedOutput?: string
    needsProcurement: boolean
    copilot?: string
  }>
}

export async function discoverMission(subject: string, family?: string, artifact?: string) {
  const q = new URLSearchParams({ subject })
  if (family) q.set('family', family)
  if (artifact) q.set('artifact', artifact.slice(0, 12_000))
  const res = await fetch(`${API}/v1/mission/discover?${q}`)
  return parse(res) as Promise<MissionDiscover>
}

export async function runMission(input: {
  subject: string
  tokenId: string
  maxAtomic?: string
  owner?: string
  family?: string
  artifact?: string
  session?: string
  payments?: unknown[]
  rail?: 'session' | 'operator'
  preset?: 'auto' | 'cheap' | 'fast' | 'deep' | 'private'
}) {
  const res = await fetch(`${API}/v1/mission/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await res.json()) as MissionRun
  if (!res.ok) return { ...body, ok: false, error: body.error || body.over?.reason || `HTTP ${res.status}` }
  return body
}

export async function drawerBalance(session: string) {
  const res = await fetch(`${API}/v1/drawer?session=${encodeURIComponent(session)}`)
  return parse(res) as Promise<{ session: string; atomic: string; usd: number; hardMaxUsd: number; note: string }>
}

export async function activityReceipts(till: string) {
  const res = await fetch(`${API}/v1/activity?till=${encodeURIComponent(till)}`)
  return parse(res) as Promise<{
    till: string
    receipts: { tx?: string; family?: string; spentUsd?: number; verdict?: string; createdAt?: string }[]
  }>
}

export async function overBudget(requestedUsd = 5, capAtomic?: string) {
  const res = await fetch(`${API}/v1/mission/overbudget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestedUsd, capAtomic }),
  })
  return parse(res) as Promise<{
    blocked: boolean
    requestedUsd: number
    capUsd: number
    spentUsd: number
    reason: string
  }>
}

export async function publicConfig() {
  const res = await fetch(`${API}/v1/public-config`)
  return parse(res)
}

export type EvalResult = {
  decision: 'ALLOW' | 'DENY' | { allow?: boolean }
  error?: string
  packed?: string
  teeSignature?: string
  teeSigner?: string
  processResponse?: boolean
  teeVerifiedRouter?: boolean
  provider?: string
  chatId?: string
  signedText?: string
  content?: string
  model?: { id: string; verifiability?: string }
}

export function isAllow(ev: EvalResult) {
  return ev.decision === 'ALLOW' || (typeof ev.decision === 'object' && ev.decision?.allow === true)
}

export function decisionReason(ev: EvalResult, fallback: string) {
  if (ev.error && !/^HTTP \d+/.test(ev.error)) return ev.error
  const raw = ev.content
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as { reason?: string }
      if (parsed.reason) return parsed.reason
    } catch {
      /* content may be prose */
    }
  }
  if (typeof ev.decision === 'object' && ev.decision && 'reason' in ev.decision) {
    const why = (ev.decision as { reason?: string }).reason
    if (why) return why
  }
  return ev.error || fallback
}

export async function evaluateIntent(input: {
  digest: string
  tokenId: string
  target: string
  amountWei: string
  resource: string
  role?: string
  grantId?: string
  executor?: string
  resourceHash?: string
}): Promise<EvalResult> {
  const res = await fetch(`${API}/v1/intent/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await res.json()) as EvalResult
  if (!res.ok) {
    const why = decisionReason({ ...body, decision: 'DENY' }, `HTTP ${res.status}`)
    return { ...body, decision: 'DENY', error: why }
  }
  return body
}

export async function issueGrant(input: Record<string, unknown>) {
  const res = await fetch(`${API}/v1/grants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  return parse(res)
}

export async function revokeGrant(grantId: string) {
  const res = await fetch(`${API}/v1/grants/${grantId}/revoke`, { method: 'POST' })
  return parse(res)
}

export async function verifyTx(tx: string) {
  const res = await fetch(`${API}/v1/verify?tx=${encodeURIComponent(tx)}`)
  return parse(res)
}

export async function storeReceipt(tx: string, packet: unknown) {
  const extra = packet && typeof packet === 'object' ? (packet as Record<string, unknown>) : {}
  const res = await fetch(`${API}/v1/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx, packet, tokenId: extra.tokenId, family: extra.family }),
  })
  return parse(res)
}

export type BriefDoc = {
  title: string
  summary: string
  findings: string[]
  risks: string[]
  next_action: string
  subject: string
  verdict?: 'BUY' | 'HOLD' | 'AVOID' | 'TRUST' | 'CAUTION' | 'DONT' | 'CLEAR' | 'ISSUES'
  confidence?: 'low' | 'medium' | 'high'
}

export async function uploadPacket(input: {
  till: string
  tx: string
  model?: string
  tee?: boolean
  brief?: BriefDoc
}) {
  const res = await fetch(`${API}/v1/storage/packet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parse(res) as Promise<{ rootHash: string; txHash: string; keyHex: string }>
}

export type PaidBrief = {
  ok?: boolean
  sku?: string
  brief?: BriefDoc
  model?: string
  provider?: string
  chatId?: string
  processResponse?: boolean
  teeVerifiedRouter?: boolean
  trust?: string
  error?: string
}

export async function x402Unpaid(subject?: string) {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  const res = await fetch(`${X402}/paid/result${q}`)
  return { status: res.status, body: await res.json().catch(() => null) }
}

export async function x402Paid(txHash: string, subject?: string) {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  const res = await fetch(`${X402}/paid/result${q}`, { headers: { 'x-payment': txHash } })
  const body = (await res.json().catch(() => null)) as PaidBrief | null
  return { status: res.status, body }
}

import { createHash } from 'node:crypto'
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk'
import { OG_ROUTER_URL, OG_RPC_URL } from '@till/config'
import { selectForRole, type CatalogModel } from './catalog.js'
import type { Role } from '@till/config'
import { requireEnv } from './env.js'

export type PolicyDecision = {
  allow: boolean
  reason: string
  intent_digest?: string
}

export type ComputeResult = {
  model: CatalogModel
  content: string
  signedText: string
  responseBody: string
  packed: string
  decision: PolicyDecision
  teeVerifiedRouter: boolean
  processResponse: boolean | null
  provider: string
  chatId: string
  teeSignature: string
  teeSigner: string
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function trustHeader(role: Role, model: CatalogModel): Record<string, string> {
  const v = (model.verifiability ?? '').toLowerCase()
  if (role === 'highRisk' || v === 'teeml' || process.env.OG_TRUST_MODE === 'private') {
    return { 'X-0G-Provider-Trust-Mode': 'private' }
  }
  return { 'X-0G-Provider-Trust-Mode': 'verified' }
}

export async function evaluateIntent(opts: {
  role: Role
  digest: string
  tokenId: string
  target: string
  amountWei: string
  resource: string
}): Promise<ComputeResult> {
  const apiKey = requireEnv('OG_ROUTER_API_KEY')
  const model = await selectForRole(opts.role)

  const tryOnce = async (m: CatalogModel): Promise<ComputeResult> => {
    const body = {
      model: m.id,
      verify_tee: true,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are Till hard-policy semantic checker. Reply JSON only: {"allow":boolean,"reason":string,"intent_digest":string}. Copy intent_digest exactly. resource is a JSON list of intended x402 buys. allow=true only if every item has destination, asset, amount, resource, reason, grant, and deadline; the spend is not a withdrawal, policy change, or drain; and the amount is a procurement under the Till cap.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            intent_digest: opts.digest,
            tokenId: opts.tokenId,
            target: opts.target,
            amountWei: opts.amountWei,
            resource: opts.resource,
          }),
        },
      ],
    }
    const res = await fetch(`${OG_ROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...trustHeader(opts.role, m),
      },
      body: JSON.stringify(body),
    })
    const rawText = await res.text()
    if (!res.ok) throw new Error(`router ${res.status}: ${rawText.slice(0, 400)}`)
    const data = JSON.parse(rawText) as {
      id?: string
      choices?: { message?: { content?: string } }[]
      x_0g_trace?: { provider?: string; tee_verified?: boolean }
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    const provider = data.x_0g_trace?.provider ?? ''
    const chatId = res.headers.get('ZG-Res-Key') ?? data.id ?? ''
    const teeVerifiedRouter = data.x_0g_trace?.tee_verified === true
    if (!teeVerifiedRouter) {
      throw new Error('DENY: Router tee_verified is not true')
    }

    const rpc = new ethers.JsonRpcProvider(OG_RPC_URL)
    const wallet = ethers.Wallet.createRandom().connect(rpc)
    const broker = await createZGComputeNetworkBroker(wallet)
    const independent = await broker.inference.processResponse(provider, chatId, content)
    if (independent !== true) {
      throw new Error(`DENY: processResponse=${String(independent)}`)
    }

    let teeSignature = '0x'
    let teeSigner = ''
    let signedText = content
    try {
      const svc = await broker.inference.getServiceMetadata(provider, m.id)
      const sigUrl = `${svc.endpoint.replace(/\/$/, '')}/signature/${chatId}?model=${encodeURIComponent(m.id)}`
      let sigRes = await fetch(sigUrl)
      if (!sigRes.ok) {
        const services = await broker.inference.listService(0, 100)
        const match = services.find(
          (s: { provider?: string; url?: string }) =>
            String(s.provider).toLowerCase() === provider.toLowerCase()
        )
        if (match?.url) {
          sigRes = await fetch(
            `${String(match.url).replace(/\/$/, '')}/v1/proxy/signature/${chatId}?model=${encodeURIComponent(m.id)}`
          )
        }
      }
      if (sigRes.ok) {
        const sigJson = (await sigRes.json()) as { text?: string; signature?: string }
        teeSignature = sigJson.signature ?? '0x'
        signedText = sigJson.text ?? content
        if (teeSignature && teeSignature !== '0x') {
          teeSigner = ethers.verifyMessage(signedText, teeSignature)
        }
      }
    } catch {
      // Signature fetch is extra; processResponse already passed.
    }
    const stripped = { ...data } as Record<string, unknown>
    delete stripped.x_0g_trace
    const responseBody = JSON.stringify(stripped)
    const right = (signedText.split(':')[1] ?? '').toLowerCase()
    const respHash = sha256Hex(responseBody)
    if (!right || respHash !== right) {
      throw new Error(`DENY: sha256(responseBody) !== TEE response hash (${respHash} vs ${right})`)
    }

    let decision: PolicyDecision
    try {
      const start = content.indexOf('{')
      const end = content.lastIndexOf('}')
      if (start < 0 || end <= start) throw new Error('no json')
      decision = JSON.parse(content.slice(start, end + 1)) as PolicyDecision
    } catch {
      throw new Error('DENY: model did not return JSON')
    }
    if (!decision.intent_digest || decision.intent_digest.toLowerCase() !== opts.digest.toLowerCase()) {
      throw new Error('DENY: intent_digest mismatch')
    }
    const packed = packTeeAttestation(content, responseBody, signedText)
    return {
      model: m,
      content,
      signedText,
      responseBody,
      packed,
      decision,
      teeVerifiedRouter,
      processResponse: independent,
      provider,
      chatId,
      teeSignature,
      teeSigner,
    }
  }

  return await tryOnce(model)
}

export type BriefDoc = {
  title: string
  summary: string
  findings: string[]
  risks: string[]
  next_action: string
  subject: string
  verdict?: 'BUY' | 'HOLD' | 'AVOID'
  confidence?: 'low' | 'medium' | 'high'
}

export type BriefResult = {
  brief: BriefDoc
  model: CatalogModel
  content: string
  processResponse: boolean | null
  teeVerifiedRouter: boolean
  provider: string
  chatId: string
}

export async function writeBrief(opts: {
  subject: string
  facts: Record<string, unknown>
}): Promise<BriefResult> {
  const apiKey = requireEnv('OG_ROUTER_API_KEY')
  const model = await selectForRole('highRisk')

  const tryOnce = async (m: CatalogModel): Promise<BriefResult> => {
    const body = {
      model: m.id,
      verify_tee: true,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write a BEFORE YOU PAY verdict. Reply JSON only: {"verdict":"BUY"|"HOLD"|"AVOID","confidence":"low"|"medium"|"high","title":string,"summary":string,"findings":string[],"risks":string[],"next_action":string,"subject":string}. Cite ONLY paid JSON in facts.purchases. Name provider, service, and 0G tx. If facts.skipped exists, one finding MUST say that seller was not paid and why. Do not invent unpaid data. verdict BUY only if paid checks show no material admin/honeypot/stale-oracle failure. HOLD if mixed or missing liquidity/oracle. AVOID if paid checks show honeypot, malicious owner, or high bytecode risk that is not explained. Not financial advice. English. Max 70 words in summary. Max 5 findings. Max 4 risks.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            chain: '0G Aristotle 16661',
            subject: opts.subject,
            facts: opts.facts,
          }),
        },
      ],
    }
    const res = await fetch(`${OG_ROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...trustHeader('highRisk', m),
      },
      body: JSON.stringify(body),
    })
    const rawText = await res.text()
    if (!res.ok) throw new Error(`router ${res.status}: ${rawText.slice(0, 400)}`)
    const data = JSON.parse(rawText) as {
      id?: string
      choices?: { message?: { content?: string } }[]
      x_0g_trace?: { provider?: string; tee_verified?: boolean }
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    const provider = data.x_0g_trace?.provider ?? ''
    const chatId = res.headers.get('ZG-Res-Key') ?? data.id ?? ''
    const teeVerifiedRouter = data.x_0g_trace?.tee_verified === true
    if (!teeVerifiedRouter) throw new Error('DENY: Router tee_verified is not true')
    const rpc = new ethers.JsonRpcProvider(OG_RPC_URL)
    const wallet = ethers.Wallet.createRandom().connect(rpc)
    const broker = await createZGComputeNetworkBroker(wallet)
    const independent = await broker.inference.processResponse(provider, chatId, content)
    if (independent !== true) throw new Error(`DENY: processResponse=${String(independent)}`)
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('Brief model did not return JSON')
    const parsed = JSON.parse(content.slice(start, end + 1)) as Partial<BriefDoc>
    const verdictRaw = String(parsed.verdict ?? '').toUpperCase()
    const verdict: BriefDoc['verdict'] =
      verdictRaw === 'BUY' || verdictRaw === 'HOLD' || verdictRaw === 'AVOID' ? verdictRaw : 'HOLD'
    const confRaw = String(parsed.confidence ?? '').toLowerCase()
    const brief: BriefDoc = {
      title: String(parsed.title ?? 'Before you pay'),
      summary: String(parsed.summary ?? ''),
      findings: Array.isArray(parsed.findings) ? parsed.findings.map(String) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      next_action: String(parsed.next_action ?? ''),
      subject: String(parsed.subject ?? opts.subject),
      verdict,
      confidence: confRaw === 'low' || confRaw === 'medium' || confRaw === 'high' ? confRaw : 'medium',
    }
    return {
      brief,
      model: m,
      content,
      processResponse: independent,
      teeVerifiedRouter,
      provider,
      chatId,
    }
  }

  return await tryOnce(model)
}

/**
 * Packed attestation for TillVerifier: abi.encode(modelJson, responseBody, signedText).
 * 0G TeeML signs sha256(req):sha256(resp) over the provider body (Router JSON minus x_0g_trace).
 */
export function packTeeAttestation(modelJson: string, responseBody: string, signedText: string): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes', 'bytes', 'bytes'],
    [ethers.toUtf8Bytes(modelJson), ethers.toUtf8Bytes(responseBody), ethers.toUtf8Bytes(signedText)]
  )
}

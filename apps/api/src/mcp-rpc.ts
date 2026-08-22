import { discoverMission, runMission } from './mission.js'
import { getReceipt } from './store.js'
import {
  ALL_SCOPES,
  MCP_RESOURCE,
  WEB_PUBLIC,
  rejectPrivateKeyPayload,
  requireScope,
  verifyAccessToken,
} from './mcp-auth.js'
import { getPolicy, getSession, getTill, listTills } from './till-read.js'

type Auth = ReturnType<typeof verifyAccessToken>
type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: unknown }

const TOOLS = [
  { name: 'till_list', description: 'List Tills owned by the authenticated wallet.', scopes: ['till.read'] },
  { name: 'till_get', description: 'Get one Till: balance, policy summary, session status.', scopes: ['till.read'] },
  { name: 'till_get_policy', description: 'Read the protection policy in plain English plus on-chain fields.', scopes: ['till.policy.read'] },
  { name: 'till_create_mission', description: 'Draft a Before You Pay mission from a token/contract/protocol string. Does not pay.', scopes: ['till.mission.create'] },
  { name: 'till_quote_mission', description: 'Compile and quote a mission. Does not execute. Does not pay.', scopes: ['till.mission.create'] },
  { name: 'till_run_mission', description: 'Execute a mission. OPERATOR RAIL: uses the API operator signer for USDC.e, not the browser session. Labeled. Never uses an owner private key. Never accepts a session private key.', scopes: ['till.mission.execute'] },
  { name: 'till_get_result', description: 'Return stored mission receipt by tx hash if the API persisted it.', scopes: ['till.proof.read'] },
  { name: 'till_review', description: 'Compile a Review This mission. Does not pay unless a SETTLED bytecode SKU is quoted later.', scopes: ['till.mission.create'] },
  { name: 'till_get_mission', description: 'Return the last mission payload passed in, or re-quote.', scopes: ['till.proof.read'] },
  { name: 'till_get_activity', description: 'Show Till status and how to open on-chain activity.', scopes: ['till.activity.read'] },
  { name: 'till_get_proof', description: 'Explain how to verify a transaction hash on Aristotle. Pass tx.', scopes: ['till.proof.read'] },
  { name: 'till_get_session', description: 'Read autonomous session status. Never returns a private key.', scopes: ['till.session.read'] },
  { name: 'till_revoke_session', description: 'Does not sign revoke. Returns the owner-wallet URL required to revoke on-chain.', scopes: ['till.session.revoke'] },
] as const

function schema() {
  return {
    type: 'object',
    properties: {
      tokenId: { type: 'string', description: 'Till id. Defaults to the token bound in the access token.' },
      subject: { type: 'string', description: 'Mission text, usually including a 0x address.' },
      tx: { type: 'string', description: '0G transaction hash for proof lookup.' },
    },
  }
}

function toolsList() {
  return {
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: `${t.description} Required scope: ${t.scopes.join(', ')}.`,
      inputSchema: schema(),
    })),
  }
}

function arg(params: unknown) {
  const p = (params || {}) as { arguments?: Record<string, string>; tokenId?: string; subject?: string; tx?: string }
  return p.arguments || p
}

async function callTool(auth: Auth, name: string, params: unknown) {
  rejectPrivateKeyPayload(params)
  const a = arg(params) as Record<string, string>
  const tokenId = String(a.tokenId || auth.till)
  if (a.tokenId && a.tokenId !== auth.till) {
    throw Object.assign(new Error('wrong Till'), { status: 403 })
  }

  switch (name) {
    case 'till_list':
      requireScope(auth, 'till.read')
      return listTills(auth.sub)
    case 'till_get':
      requireScope(auth, 'till.read')
      return getTill(auth.sub, tokenId)
    case 'till_get_policy':
      requireScope(auth, 'till.policy.read')
      return getPolicy(auth.sub, tokenId)
    case 'till_create_mission':
    case 'till_quote_mission':
    case 'till_review': {
      requireScope(auth, 'till.mission.create')
      const subject = String(a.subject || '')
      if (!subject) throw new Error('subject required')
      const family = name === 'till_review' ? 'review' : undefined
      return discoverMission(subject, family, a.artifact ? String(a.artifact) : undefined)
    }
    case 'till_run_mission': {
      requireScope(auth, 'till.mission.execute')
      const session = await getSession(auth.sub, tokenId)
      if (session.status !== 'READY' && session.status !== 'NOT_FUNDED') {
        return {
          ok: false,
          error:
            session.status === 'EXPIRED'
              ? 'Session expired. Mission settlement is refused.'
              : session.status === 'PAUSED'
                ? 'Till is paused. Mission settlement is refused.'
                : 'Autonomous execution is not enabled for this Till.',
          status: session.status,
          enableUrl: `${WEB_PUBLIC}/till/agent`,
        }
      }
      const subject = String(a.subject || '')
      if (!subject) throw new Error('subject required')
      const result = await runMission({
        subject,
        tokenId,
        owner: auth.sub,
        rail: 'operator',
      })
      return {
        ...result,
        signerLabel:
          'OPERATOR RAIL. MCP execute uses the configured operator signer for USDC.e EIP-3009. It does not use the browser session key. APP missions must use the session EOA.',
        storage: {
          anchored: false,
          reason: 'MCP never holds the session private key. Storage proof is anchored in the Till app by the device-local session.',
        },
      }
    }
    case 'till_get_result':
    case 'till_get_mission': {
      requireScope(auth, 'till.proof.read')
      if (a.tx) return getReceipt(a.tx) ?? { error: 'not stored', verify: `${WEB_PUBLIC}/verify?tx=${a.tx}` }
      if (!a.subject) return { error: 'pass subject to re-quote, or tx for a stored result' }
      return discoverMission(String(a.subject))
    }
    case 'till_get_activity':
      requireScope(auth, 'till.activity.read')
      return {
        till: await getTill(auth.sub, tokenId),
        app: `${WEB_PUBLIC}/activity`,
        verify: `${WEB_PUBLIC}/verify`,
      }
    case 'till_get_proof':
      requireScope(auth, 'till.proof.read')
      if (!a.tx) return { error: 'tx required', verify: `${WEB_PUBLIC}/verify` }
      return {
        tx: a.tx,
        verifyApi: `${process.env.TILL_API_PUBLIC_URL || 'https://till-api.onrender.com'}/v1/verify?tx=${a.tx}`,
        app: `${WEB_PUBLIC}/verify?tx=${a.tx}`,
      }
    case 'till_get_session':
      requireScope(auth, 'till.session.read')
      return getSession(auth.sub, tokenId)
    case 'till_revoke_session':
      requireScope(auth, 'till.session.revoke')
      return {
        ok: false,
        error: 'MCP cannot revoke on-chain. The owner wallet must sign revoke.',
        url: `${WEB_PUBLIC}/agents`,
        note: 'This scope only authorizes requesting a revoke. It does not grant the owner key.',
      }
    default:
      throw new Error(`unknown tool ${name}`)
  }
}

export async function handleMcpRpc(auth: Auth | null, body: Rpc) {
  const id = body.id ?? null
  const method = body.method || ''
  try {
    if (method === 'initialize') {
      const params = (body.params || {}) as { protocolVersion?: string }
      const requested = params.protocolVersion || ''
      const protocolVersion = requested === '2025-11-25' || requested === '2025-03-26' ? requested : '2025-11-25'
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: 'till', version: '0.1.0' },
          instructions:
            'Till MCP never accepts private keys. Default scopes are read/quote. till.mission.execute is the OPERATOR rail (not the browser session). High-risk scopes never withdraw.',
        },
      }
    }
    if (method === 'notifications/initialized' || method === 'initialized') {
      return null
    }
    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }
    if (method === 'tools/list') {
      if (!auth) throw Object.assign(new Error('unauthorized'), { status: 401 })
      return { jsonrpc: '2.0', id, result: toolsList() }
    }
    if (method === 'tools/call') {
      if (!auth) throw Object.assign(new Error('unauthorized'), { status: 401 })
      const p = (body.params || {}) as { name: string; arguments?: unknown }
      const result = await callTool(auth, p.name, p.arguments || {})
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
      }
    }
    if (method === 'resources/list') return { jsonrpc: '2.0', id, result: { resources: [] } }
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `method not found: ${method}`, data: { scopes: ALL_SCOPES, resource: MCP_RESOURCE } },
    }
  } catch (e) {
    const err = e as Error & { status?: number }
    if (err.status === 401) throw err
    return {
      jsonrpc: '2.0',
      id,
      error: { code: err.status === 403 ? -32003 : -32000, message: err.message },
    }
  }
}

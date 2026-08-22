import {
  assertGrant,
  evaluateIntent,
  fetchCatalog,
  getGrant,
  issueGrant,
  listGrants,
  productionGuards,
  revokeGrant,
  selectForRole,
  selectPreset,
  uploadEncryptedPacket,
  writeBrief,
} from '@till/sdk'
import { blockOverBudget, discoverMission, runMission } from './mission.js'
import { compileMission } from './compiler.js'
import { verifyRegistry } from './registry.js'
import { USDCE_16661, HERALD_ROUTER, OG_CAIP } from './x402Herald.js'
import { getReceipt, listReceipts, putReceipt } from './store.js'
import { usdceBalance } from './gate.js'
import {
  API_PUBLIC,
  MCP_RESOURCE,
  WEB_PUBLIC,
  authorizationServerMetadata,
  bearerFrom,
  exchangeCode,
  issueFromSignature,
  issueMessage,
  mcpConfigured,
  parseScopes,
  protectedResourceMetadata,
  registerClient,
  storeAuthCode,
  verifyAccessToken,
  wwwAuthenticate,
} from './mcp-auth.js'
import { handleMcpRpc } from './mcp-rpc.js'
import { getPolicy, getSession, getTill, listTills } from './till-read.js'
import Fastify from 'fastify'
import { ethers } from 'ethers'
import { OG_EXPLORER_URL, OG_RPC_URL, VAULT_ABI } from '@till/config'

productionGuards()

function jsonSafe(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString()
  if (Array.isArray(v)) return v.map(jsonSafe)
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = jsonSafe(val)
    return o
  }
  return v
}

const app = Fastify({ logger: true, requestTimeout: 300_000, connectionTimeout: 300_000 })

app.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, X-Payment-Tx, MCP-Protocol-Version')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  reply.header('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Session-Id')
  if (req.method === 'OPTIONS') return reply.code(204).send()
})

app.get('/health', async () => ({
  ok: true,
  chainId: process.env.OG_CHAIN_ID ?? '16661',
  simulate: process.env.TILL_DEV_SIMULATE === '1',
}))

app.get('/v1/public-config', async () => ({
  chainId: 16661,
  rpc: OG_RPC_URL,
  explorer: OG_EXPLORER_URL,
  nft: process.env.TILL_AGENT_NFT,
  policy: process.env.TILL_POLICY,
  verifier: process.env.TILL_VERIFIER,
  vault: process.env.TILL_VAULT,
  escrow: process.env.TILL_JOB_ESCROW,
  x402: {
    rail: 'herald',
    resource: 'herald://before-you-pay',
    publicMerchant:
      process.env.X402_PUBLIC_URL &&
      !/localhost|127\.0\.0\.1/i.test(process.env.X402_PUBLIC_URL)
        ? process.env.X402_PUBLIC_URL
        : null,
  },
  herald: {
    router: HERALD_ROUTER,
    network: OG_CAIP,
    usdce: USDCE_16661,
    payTo: '0x686Ca1f3BAf7F7Df3334f2f1A65AE314ee9CDb29',
  },
  erc8004: {
    identity: process.env.ERC8004_IDENTITY ?? '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputation: process.env.ERC8004_REPUTATION ?? '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  },
  blocked: {
    da: 'No official mainnet DAEntrance. Testnet addrs have no code on 16661.',
    foundationAgenticId: 'agenticid.0g.ai/config chain_id 16602',
    erc8004Validation: '0G AgenticID issue #98',
    sealedITransfer: 'Foundation attestor is Galileo-only',
  },
}))

app.get('/v1/models/live', async () => {
  const catalog = await fetchCatalog(true)
  const roles = {
    compiler: (await selectForRole('compiler')).id,
    fastPolicy: (await selectForRole('fastPolicy')).id,
    defaultPolicy: (await selectForRole('defaultPolicy')).id,
    highRisk: (await selectForRole('highRisk')).id,
    jobSemantic: (await selectForRole('jobSemantic')).id,
  }
  const presets = {
    autoPay: selectPreset(catalog, 'auto', 'fastPolicy').id,
    cheap: selectPreset(catalog, 'cheap', 'compiler').id,
    fast: selectPreset(catalog, 'fast', 'compiler').id,
    deep: selectPreset(catalog, 'deep', 'highRisk').id,
    private: selectPreset(catalog, 'private', 'highRisk').id,
  }
  return {
    count: catalog.data.length,
    roles,
    presets,
    fetchedAt: catalog.fetchedAt,
    note: 'AUTO reads this live catalog. Models with verifiability=None cannot ALLOW spend.',
  }
})

app.post('/v1/grants', async (req) => {
  const body = req.body as Record<string, string | string[]>
  return issueGrant({
    tokenId: String(body.tokenId),
    owner: String(body.owner),
    executor: String(body.executor),
    scopes: (body.scopes as string[]) ?? ['pay', 'job'],
    resourceHashes: (body.resourceHashes as string[]) ?? [],
    capWei: String(body.capWei ?? '0'),
    expiresAt: Number(body.expiresAt ?? Math.floor(Date.now() / 1000) + 3600),
  })
})

app.post('/v1/grants/:id/revoke', async (req) => {
  const { id } = req.params as { id: string }
  revokeGrant(id)
  return { revoked: true, grantId: id }
})

app.get('/v1/grants', async () => listGrants())

app.get('/.well-known/oauth-protected-resource', async () => protectedResourceMetadata())
app.get('/.well-known/oauth-protected-resource/mcp', async () => protectedResourceMetadata())
app.get('/.well-known/oauth-authorization-server', async () => authorizationServerMetadata())

app.post('/oauth/register', async (req, reply) => {
  try {
    return registerClient((req.body || {}) as { redirect_uris?: string[]; client_name?: string })
  } catch (e) {
    return reply.code(400).send({ error: (e as Error).message })
  }
})

app.post('/oauth/consent', async (req, reply) => {
  const body = req.body as {
    owner?: string
    tokenId?: string
    scopes?: string[]
    nonce?: string
    exp?: number
    signature?: string
    allowHighRisk?: boolean
    codeChallenge?: string
    redirectUri?: string
    clientId?: string
    resource?: string
  }
  try {
    const issued = issueFromSignature({
      owner: String(body.owner),
      tokenId: String(body.tokenId),
      scopes: body.scopes ?? [],
      nonce: String(body.nonce),
      exp: Number(body.exp),
      signature: String(body.signature),
      allowHighRisk: Boolean(body.allowHighRisk),
    })
    const code = storeAuthCode({
      owner: String(body.owner),
      tokenId: String(body.tokenId),
      scopes: issued.scopes,
      codeChallenge: String(body.codeChallenge),
      redirectUri: String(body.redirectUri),
      clientId: String(body.clientId),
      resource: String(body.resource || MCP_RESOURCE),
    })
    return { code, scopes: issued.scopes, resource: MCP_RESOURCE }
  } catch (e) {
    return reply.code(400).send({ error: (e as Error).message })
  }
})

app.post('/oauth/token', async (req, reply) => {
  const body = (req.body || {}) as Record<string, string>
  try {
    if (body.grant_type !== 'authorization_code') return reply.code(400).send({ error: 'unsupported_grant_type' })
    return exchangeCode({
      code: body.code,
      codeVerifier: body.code_verifier,
      redirectUri: body.redirect_uri,
      clientId: body.client_id,
    })
  } catch (e) {
    return reply.code(400).send({ error: 'invalid_grant', error_description: (e as Error).message })
  }
})

app.post('/oauth/revoke', async () => ({
  ok: true,
  note: 'Delete the bearer token in the client. On-chain session revoke is an owner-wallet action in the Till app.',
}))

app.post('/v1/mcp/issue', async (req, reply) => {
  const body = req.body as {
    owner?: string
    tokenId?: string
    scopes?: string[]
    nonce?: string
    exp?: number
    signature?: string
    allowHighRisk?: boolean
  }
  try {
    if (!mcpConfigured()) return reply.code(503).send({ error: 'MCP signing is not configured' })
    return issueFromSignature({
      owner: String(body.owner),
      tokenId: String(body.tokenId),
      scopes: body.scopes ?? [],
      nonce: String(body.nonce),
      exp: Number(body.exp),
      signature: String(body.signature),
      allowHighRisk: Boolean(body.allowHighRisk),
    })
  } catch (e) {
    return reply.code(400).send({ error: (e as Error).message })
  }
})

app.get('/v1/mcp/message', async (req) => {
  const q = req.query as { owner?: string; tokenId?: string; scopes?: string; nonce?: string; exp?: string; high?: string }
  const scopes = parseScopes(q.scopes, q.high === '1')
  const nonce = q.nonce || 'preview'
  const exp = Number(q.exp || Math.floor(Date.now() / 1000) + 86400)
  return {
    message: issueMessage({ owner: String(q.owner || '0x0000000000000000000000000000000000000001'), tokenId: String(q.tokenId || '0'), scopes, nonce, exp }),
    scopes,
    resource: MCP_RESOURCE,
    api: API_PUBLIC,
    web: WEB_PUBLIC,
  }
})

function unauthorized(reply: { header: (k: string, v: string) => unknown; code: (n: number) => { send: (b: unknown) => unknown } }) {
  reply.header('WWW-Authenticate', wwwAuthenticate())
  return reply.code(401).send({ error: 'unauthorized' })
}

app.get('/mcp', async (req, reply) => {
  if (!bearerFrom(req.headers.authorization)) return unauthorized(reply)
  return reply.code(405).header('Allow', 'POST').send({ error: 'Use POST JSON-RPC for Till MCP' })
})

app.post('/mcp', async (req, reply) => {
  const body = req.body as { jsonrpc?: string; method?: string; grantId?: string; privateKey?: string }
  if (body && 'privateKey' in body) {
    return reply.code(400).send({ error: 'private keys are forbidden on MCP' })
  }
  if (body?.jsonrpc === '2.0' || body?.method) {
    const raw = bearerFrom(req.headers.authorization)
    let auth = null
    const needsAuth = body.method !== 'initialize' && body.method !== 'notifications/initialized'
    if (needsAuth) {
      if (!raw) return unauthorized(reply)
      try {
        auth = verifyAccessToken(raw)
      } catch {
        return unauthorized(reply)
      }
    }
    try {
      const proto = String(req.headers['mcp-protocol-version'] || '')
      if (proto && proto !== '2025-03-26' && proto !== '2025-11-25') {
        return reply.code(400).send({ error: 'unsupported MCP-Protocol-Version' })
      }
      const out = await handleMcpRpc(auth, body as { jsonrpc: '2.0'; method?: string; params?: unknown; id?: string | number | null })
      if (out == null) return reply.code(202).send()
      return out
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) return unauthorized(reply)
      return reply.code(err.status || 400).send({ error: err.message })
    }
  }
  if (!body?.grantId) {
    return reply.code(400).send({ error: 'MCP JSON-RPC required; keys are never accepted. See /developers.' })
  }
  try {
    const grant = assertGrant(
      String((body as { grantId: string }).grantId),
      String((body as { tokenId?: string }).tokenId),
      String((body as { executor?: string }).executor),
      (body as { resourceHash?: string }).resourceHash ?? ethers.ZeroHash,
      BigInt((body as { amountWei?: string }).amountWei ?? '0'),
    )
    return { ok: true, grant, note: 'Legacy grant probe. Cursor/Claude use JSON-RPC on this same path.' }
  } catch (e) {
    return reply.code(403).send({ ok: false, error: (e as Error).message })
  }
})

app.get('/v1/tills', async (req, reply) => {
  const raw = bearerFrom(req.headers.authorization)
  if (!raw) return unauthorized(reply)
  try {
    const auth = verifyAccessToken(raw)
    return { tills: await listTills(auth.sub) }
  } catch {
    return unauthorized(reply)
  }
})

app.get('/v1/tills/:id', async (req, reply) => {
  const raw = bearerFrom(req.headers.authorization)
  if (!raw) return unauthorized(reply)
  try {
    const auth = verifyAccessToken(raw)
    const { id } = req.params as { id: string }
    return { till: await getTill(auth.sub, id), policy: await getPolicy(auth.sub, id), session: await getSession(auth.sub, id) }
  } catch (e) {
    return reply.code(403).send({ error: (e as Error).message })
  }
})

app.post('/v1/intent/evaluate', async (req, reply) => {
  const body = req.body as {
    role?: 'fastPolicy' | 'defaultPolicy' | 'highRisk' | 'jobSemantic'
    digest: string
    tokenId: string
    target: string
    amountWei: string
    resource: string
    grantId?: string
    executor?: string
    resourceHash?: string
  }
  try {
    if (body.grantId && body.executor) {
      assertGrant(
        body.grantId,
        body.tokenId,
        body.executor,
        body.resourceHash ?? ethers.keccak256(ethers.toUtf8Bytes(body.resource)),
        BigInt(body.amountWei)
      )
    }
    const result = await evaluateIntent({
      role: body.role ?? 'defaultPolicy',
      digest: body.digest,
      tokenId: body.tokenId,
      target: body.target,
      amountWei: body.amountWei,
      resource: body.resource,
    })
    if (!result.decision.allow) {
      return reply.code(403).send(jsonSafe({ ...result, decision: 'DENY' }))
    }
    return jsonSafe({ ...result, decision: 'ALLOW' })
  } catch (e) {
    return reply.code(403).send({ decision: 'DENY', error: (e as Error).message })
  }
})

app.get('/v1/registry', async (req, reply) => {
  const q = req.query as { token?: string }
  try {
    return jsonSafe(await verifyRegistry(String(q.token ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')))
  } catch (e) {
    return reply.code(502).send({ error: (e as Error).message })
  }
})

app.post('/v1/mission/compile', async (req) => {
  const body = req.body as { text?: string; family?: string; artifact?: string }
  return compileMission(body)
})

app.get('/v1/mission/discover', async (req, reply) => {
  const q = req.query as { subject?: string; family?: string }
  try {
    const family = q.family === 'pay' || q.family === 'trust' || q.family === 'research' || q.family === 'review' ? q.family : undefined
    return jsonSafe(await discoverMission(String(q.subject ?? ''), family))
  } catch (e) {
    return reply.code(502).send({ error: (e as Error).message })
  }
})

app.get('/v1/drawer', async (req, reply) => {
  const q = req.query as { session?: string }
  if (!q.session) return reply.code(400).send({ error: 'session required' })
  const bal = await usdceBalance(q.session)
  return {
    session: q.session,
    atomic: bal.atomic.toString(),
    usd: bal.usd,
    asset: 'USDC.e',
    hardMaxUsd: 0.5,
    note: 'USDC.e is limited by this mission\'s session drawer, not by TillPolicy.',
  }
})

app.get('/v1/activity', async (req, reply) => {
  const q = req.query as { till?: string }
  if (!q.till) return reply.code(400).send({ error: 'till required' })
  return { till: q.till, receipts: listReceipts(q.till) }
})

app.post('/v1/mission/overbudget', async (req) => {
  const body = req.body as { requestedUsd?: number; capAtomic?: string }
  return blockOverBudget(Number(body.requestedUsd ?? 5), body.capAtomic)
})

app.post('/v1/mission/run', async (req, reply) => {
  const body = req.body as {
    subject?: string
    tokenId?: string
    maxAtomic?: string
    owner?: string
    family?: 'pay' | 'trust' | 'research' | 'review'
    artifact?: string
    session?: string
    payments?: unknown[]
    rail?: 'session' | 'operator'
  }
  if (!body.tokenId) return reply.code(400).send({ error: 'tokenId required' })
  try {
    const result = await runMission({
      subject: String(body.subject ?? '').slice(0, 4000),
      tokenId: String(body.tokenId),
      maxAtomic: body.maxAtomic,
      owner: body.owner,
      family: body.family,
      artifact: body.artifact,
      session: body.session,
      payments: body.payments as never,
      rail: body.rail,
    })
    if (!result.ok) return reply.code(403).send(jsonSafe(result))
    return jsonSafe(result)
  } catch (e) {
    const msg = (e as Error).message
    const failedHerald = /FAILED_HERALD/i.test(msg)
    return reply.code(failedHerald ? 502 : 502).send({ error: msg, code: failedHerald ? 'FAILED_HERALD' : 'MISSION_FAIL' })
  }
})

async function factsFor(subject: string) {
  const facts: Record<string, unknown> = {
    chain: '0G Aristotle',
    chainId: 16661,
    explorer: OG_EXPLORER_URL,
    subject,
  }
  const m = subject.match(/0x[a-fA-F0-9]{40}/)
  if (!m) return facts
  const addr = m[0]
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const [code, bal] = await Promise.all([provider.getCode(addr), provider.getBalance(addr)])
  facts.address = addr
  facts.hasContractCode = code !== '0x'
  facts.codeBytes = code === '0x' ? 0 : (code.length - 2) / 2
  facts.nativeBalance0G = ethers.formatEther(bal)
  const vault = process.env.TILL_VAULT
  if (vault && addr.toLowerCase() === vault.toLowerCase()) {
    facts.label = 'TillVault'
    try {
      const v = new ethers.Contract(vault, VAULT_ABI, provider)
      facts.till1Available0G = ethers.formatEther(await v.available(1n))
      facts.till1Locked0G = ethers.formatEther(await v.locked(1n))
    } catch {
      /* view optional */
    }
  }
  return facts
}

app.post('/v1/brief', async (req, reply) => {
  const body = req.body as { subject?: string; tx?: string }
  const subject = String(body.subject ?? 'TillVault on 0G Aristotle').slice(0, 280)
  try {
    const facts = await factsFor(subject)
    const result = await writeBrief({ subject, facts })
    return jsonSafe({
      ok: true,
      sku: 'private-investigation',
      brief: result.brief,
      model: result.model.id,
      provider: result.provider,
      chatId: result.chatId,
      processResponse: result.processResponse,
      teeVerifiedRouter: result.teeVerifiedRouter,
      trust: 'private',
      tx: body.tx ?? null,
    })
  } catch (e) {
    return reply.code(502).send({ error: (e as Error).message })
  }
})

app.post('/v1/storage/packet', async (req, reply) => {
  const body = req.body as {
    till?: string
    tx?: string
    model?: string
    tee?: boolean
    brief?: unknown
  }
  if (!body?.till || !body?.tx) return reply.code(400).send({ error: 'till and tx required' })
  try {
    const packet = await uploadEncryptedPacket({
      till: body.till,
      tx: body.tx,
      model: body.model,
      tee: body.tee,
      sku: 'before-you-pay',
      brief: body.brief ?? null,
    })
    return packet
  } catch (e) {
    return reply.code(502).send({ error: (e as Error).message })
  }
})

async function verifyHandler(req: { query: unknown }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  const q = req.query as { till?: string; tx?: string }
  if (!q.tx) return reply.code(400).send({ error: 'tx required' })
  const hash = String(q.tx)
  const cached = getReceipt(hash)
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const receipt = await provider.getTransactionReceipt(hash)
  if (!receipt) return reply.code(404).send({ error: 'tx not found on Aristotle' })
  const tx = await provider.getTransaction(hash)
  const vaultAddr = process.env.TILL_VAULT
  const usdce = USDCE_16661
  const transferTopic = ethers.id('Transfer(address,address,uint256)')
  const vaultEvents: { event: string; args: unknown }[] = []
  const usdceTransfers: { from: string; to: string; amount: string; amountUsd: number }[] = []
  let storageRoot: string | null = null
  if (vaultAddr) {
    const vault = new ethers.Contract(vaultAddr, VAULT_ABI, provider)
    for (const log of receipt.logs) {
      try {
        const parsed = vault.interface.parseLog({ topics: log.topics as string[], data: log.data })
        if (!parsed) continue
        const args = jsonSafe(parsed.args.toObject ? parsed.args.toObject() : parsed.args)
        vaultEvents.push({ event: parsed.name, args })
        if (parsed.name === 'PacketAnchored') {
          const obj = args as { rootHash?: string }
          storageRoot = obj.rootHash ?? (Array.isArray(parsed.args) ? String(parsed.args[1]) : null)
        }
      } catch {
        /* not a vault log */
      }
    }
  }
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdce.toLowerCase()) continue
    if (log.topics[0] !== transferTopic) continue
    const from = ethers.getAddress(ethers.dataSlice(log.topics[1], 12))
    const to = ethers.getAddress(ethers.dataSlice(log.topics[2], 12))
    const amount = ethers.toBigInt(log.data).toString()
    usdceTransfers.push({ from, to, amount, amountUsd: Number(amount) / 1e6 })
  }
  const released = vaultEvents.find((e) => e.event === 'Released') ?? null
  return {
    chain: '0G Aristotle',
    chainId: 16661,
    till: q.till ?? null,
    tx: hash,
    explorer: `${OG_EXPLORER_URL}/tx/${hash}`,
    status: receipt.status,
    blockNumber: receipt.blockNumber,
    from: tx?.from ?? null,
    to: tx?.to ?? null,
    nativeValue0G: tx ? ethers.formatEther(tx.value) : '0',
    vaultEvents,
    usdceTransfers,
    storageRoot,
    released,
    sessionCache: cached ?? null,
    durable: Boolean(cached),
    family: cached?.family ?? null,
    signer: cached?.session ?? tx?.from ?? null,
    model: cached?.model ?? null,
    processResponse: cached?.processResponse ?? null,
    verdict: cached?.verdict ?? null,
    rail: cached?.rail ?? null,
    note: 'On-chain fields are reconstructed from the Aristotle receipt. Durable receipts survive API restart. They are not a substitute for the receipt.',
  }
}

app.get('/verify', verifyHandler)
app.get('/v1/verify', verifyHandler)

app.post('/v1/receipts', async (req) => {
  const body = req.body as { tx: string; packet?: unknown; tokenId?: string; family?: string }
  if (!body.tx) return { stored: false, error: 'tx required' }
  putReceipt({
    id: body.tx.toLowerCase(),
    tx: body.tx,
    tokenId: body.tokenId,
    family: body.family,
    packet: body.packet,
    createdAt: new Date().toISOString(),
  })
  return { stored: true, durable: true }
})

app.get('/v1/receipts/:tx', async (req, reply) => {
  const tx = (req.params as { tx: string }).tx
  const row = getReceipt(tx)
  if (!row) return reply.code(404).send({ error: 'not stored' })
  return row
})

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })

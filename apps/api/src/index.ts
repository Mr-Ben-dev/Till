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
  uploadEncryptedPacket,
  writeBrief,
} from '@till/sdk'
import { blockOverBudget, discoverMission, runMission } from './mission.js'
import { verifyRegistry } from './registry.js'
import { USDCE_16661, HERALD_ROUTER, OG_CAIP } from './x402Herald.js'
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

const receipts = new Map<string, unknown>()
const app = Fastify({ logger: true, requestTimeout: 300_000, connectionTimeout: 300_000 })

app.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, X-Payment-Tx')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
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
    fastPolicy: (await selectForRole('fastPolicy')).id,
    defaultPolicy: (await selectForRole('defaultPolicy')).id,
    highRisk: (await selectForRole('highRisk')).id,
    jobSemantic: (await selectForRole('jobSemantic')).id,
  }
  return { count: catalog.data.length, roles, fetchedAt: catalog.fetchedAt }
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

app.post('/mcp', async (req, reply) => {
  const body = req.body as {
    grantId?: string
    tokenId?: string
    executor?: string
    resourceHash?: string
    amountWei?: string
    method?: string
  }
  if (!body.grantId || !body.tokenId || !body.executor) {
    return reply.code(400).send({ error: 'grant required; keys are never accepted' })
  }
  if ('privateKey' in body) {
    return reply.code(400).send({ error: 'private keys are forbidden on MCP' })
  }
  try {
    const grant = assertGrant(
      body.grantId,
      body.tokenId,
      body.executor,
      body.resourceHash ?? ethers.ZeroHash,
      BigInt(body.amountWei ?? '0')
    )
    return { ok: true, grant, note: 'MCP proves grants, not a live Claude/Cursor session' }
  } catch (e) {
    return reply.code(403).send({ ok: false, error: (e as Error).message })
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

app.get('/v1/mission/discover', async (req, reply) => {
  const q = req.query as { subject?: string }
  try {
    return jsonSafe(await discoverMission(String(q.subject ?? '')))
  } catch (e) {
    return reply.code(502).send({ error: (e as Error).message })
  }
})

app.post('/v1/mission/overbudget', async (req) => {
  const body = req.body as { requestedUsd?: number; capAtomic?: string }
  return blockOverBudget(Number(body.requestedUsd ?? 5), body.capAtomic)
})

app.post('/v1/mission/run', async (req, reply) => {
  const body = req.body as { subject?: string; tokenId?: string; maxAtomic?: string; owner?: string }
  if (!body.tokenId) return reply.code(400).send({ error: 'tokenId required' })
  try {
    const result = await runMission({
      subject: String(body.subject ?? '').slice(0, 280),
      tokenId: String(body.tokenId),
      maxAtomic: body.maxAtomic,
      owner: body.owner,
    })
    if (!result.ok) return reply.code(403).send(jsonSafe(result))
    return jsonSafe(result)
  } catch (e) {
    return reply.code(502).send({ error: (e as Error).message })
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
  const cached = receipts.get(hash.toLowerCase())
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
    note: 'On-chain fields are reconstructed from the Aristotle receipt. Session cache is optional operator evidence, not a substitute for the receipt.',
  }
}

app.get('/verify', verifyHandler)
app.get('/v1/verify', verifyHandler)

app.post('/v1/receipts', async (req) => {
  const body = req.body as { tx: string; packet?: unknown }
  receipts.set(body.tx.toLowerCase(), body)
  return { stored: true }
})

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })

import { existsSync } from 'node:fs'
import path from 'node:path'
import { config as load } from 'dotenv'
import Fastify from 'fastify'
import { ethers } from 'ethers'
import { OG_RPC_URL, VAULT_ABI } from '@till/config'

for (const f of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  'd:\\route\\0g\\.env',
]) {
  if (existsSync(f)) load({ path: f, override: false })
}

const PRICE_WEI = BigInt(process.env.X402_PRICE_WEI ?? '10000000000000000') // 0.01 0G
const PAYEE = (process.env.X402_PAYEE ?? '').toLowerCase()
const VAULT = process.env.TILL_VAULT ?? ''
const RESOURCE = 'till://paid-result/v1'
const RESOURCE_HASH = ethers.keccak256(ethers.toUtf8Bytes(RESOURCE))

const paid = new Map<string, unknown>()

const app = Fastify({ logger: true, requestTimeout: 180_000, connectionTimeout: 180_000 })

app.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, X-Payment, X-Payment-Tx')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return reply.code(204).send()
})

app.get('/paid/result', async (req, reply) => {
  const txHash = String((req.headers['x-payment'] ?? req.headers['x-payment-tx'] ?? '') || '')
  const subject = String((req.query as { subject?: string }).subject ?? 'TillVault on 0G Aristotle').slice(0, 280)
  if (!txHash) {
    return reply.code(402).send({
      x402Version: 1,
      error: 'PAYMENT_REQUIRED',
      accepts: [
        {
          scheme: 'exact',
          network: '0g-aristotle-16661',
          maxAmountRequired: PRICE_WEI.toString(),
          resource: RESOURCE,
          resourceHash: RESOURCE_HASH,
          payTo: PAYEE,
          extra: { vault: VAULT, sku: 'private-investigation', subject },
        },
      ],
    })
  }

  if (!VAULT || !PAYEE) {
    return reply.code(503).send({ error: 'x402 merchant not configured' })
  }

  const cached = paid.get(txHash.toLowerCase())
  if (cached) return cached

  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const receipt = await provider.getTransactionReceipt(txHash)
  if (!receipt || receipt.status !== 1) {
    return reply.code(402).send({ error: 'payment tx not confirmed' })
  }
  const vault = new ethers.Contract(VAULT, VAULT_ABI, provider)
  let found = false
  for (const log of receipt.logs) {
    try {
      const parsed = vault.interface.parseLog({ topics: log.topics as string[], data: log.data })
      if (parsed?.name === 'Released') {
        const to = String(parsed.args.to).toLowerCase()
        const amount = parsed.args.amount as bigint
        const resourceHash = String(parsed.args.resourceHash)
        if (to === PAYEE && amount >= PRICE_WEI && resourceHash.toLowerCase() === RESOURCE_HASH.toLowerCase()) {
          found = true
        }
      }
    } catch {
      /* skip */
    }
  }
  if (!found) {
    return reply.code(402).send({ error: 'payment does not match resource/payee/amount' })
  }
  const api = process.env.TILL_API_URL || 'http://127.0.0.1:3001'
  const briefRes = await fetch(`${api}/v1/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, tx: txHash }),
  })
  const briefBody = await briefRes.json().catch(() => ({ error: 'brief parse failed' }))
  if (!briefRes.ok) {
    return reply.code(502).send(briefBody)
  }
  paid.set(txHash.toLowerCase(), briefBody)
  return briefBody
})

app.get('/health', async () => ({ ok: true, resource: RESOURCE, priceWei: PRICE_WEI.toString() }))

const port = Number(process.env.X402_PORT ?? 3002)
await app.listen({ port, host: '0.0.0.0' })

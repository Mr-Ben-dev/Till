import { ethers } from 'ethers'
import { OG_EXPLORER_URL, OG_RPC_URL, VAULT_ABI } from '@till/config'
import { USDCE_16661 } from './x402Herald.js'
import { getReceipt } from './store.js'

function jsonSafe(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString()
  if (Array.isArray(v)) return v.map(jsonSafe)
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!Number.isNaN(Number(k)) && String(Number(k)) === k) continue
      o[k] = jsonSafe(val)
    }
    return o
  }
  return v
}

export async function reconstructVerify(hash: string, tillQuery?: string | null) {
  const cached = getReceipt(hash)
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const receipt = await provider.getTransactionReceipt(hash)
  if (!receipt) return null
  const tx = await provider.getTransaction(hash)
  const vaultAddr = process.env.TILL_VAULT
  const usdce = USDCE_16661
  const transferTopic = ethers.id('Transfer(address,address,uint256)')
  const vaultEvents: { event: string; args: unknown }[] = []
  const usdceTransfers: { from: string; to: string; amount: string; amountUsd: number }[] = []
  let storageRoot: string | null = null
  let onchainTill: string | null = null
  if (vaultAddr) {
    const vault = new ethers.Contract(vaultAddr, VAULT_ABI, provider)
    for (const log of receipt.logs) {
      try {
        const parsed = vault.interface.parseLog({ topics: log.topics as string[], data: log.data })
        if (!parsed) continue
        const args = jsonSafe(parsed.args.toObject ? parsed.args.toObject() : parsed.args)
        vaultEvents.push({ event: parsed.name, args })
        if (parsed.name === 'PacketAnchored') {
          const obj = args as { tokenId?: string; rootHash?: string }
          if (obj.tokenId != null) onchainTill = String(obj.tokenId)
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
  const tillSource = onchainTill
    ? 'on-chain PacketAnchored'
    : cached?.tokenId
      ? 'api cache'
      : tillQuery
        ? 'query'
        : null
  return {
    chain: '0G Aristotle',
    chainId: 16661,
    till: onchainTill ?? tillQuery ?? cached?.tokenId ?? null,
    tillSource,
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
    sessionCache: cached
      ? {
          tokenId: cached.tokenId ?? null,
          family: cached.family ?? null,
          verdict: cached.verdict ?? null,
          model: cached.model ?? null,
          processResponse: cached.processResponse ?? null,
          session: cached.session ?? null,
          packet: cached.packet ?? null,
          label: 'API durable cache — not a substitute for the Aristotle receipt',
        }
      : null,
    durable: Boolean(cached),
    family: cached?.family ?? null,
    signer: cached?.session ?? tx?.from ?? null,
    model: cached?.model ?? null,
    processResponse: cached?.processResponse ?? null,
    verdict: cached?.verdict ?? null,
    rail: cached?.rail ?? null,
    note: onchainTill
      ? 'Till id and storage root come from on-chain PacketAnchored. Family/verdict/model from API cache are labeled cache and lose if they disagree with the receipt.'
      : 'On-chain fields are reconstructed from the Aristotle receipt. Cache is labeled and is never proof.',
  }
}

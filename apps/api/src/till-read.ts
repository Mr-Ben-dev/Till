import { ethers } from 'ethers'
import { NFT_ABI, POLICY_ABI, VAULT_ABI, OG_RPC_URL, OG_EXPLORER_URL } from '@till/config'

const MINT_FROM = 42_110_000n
const USDCE = '0x1f3aa82227281ca364bfb3d253b0f1af1da6473e'

function provider() {
  return new ethers.JsonRpcProvider(OG_RPC_URL)
}

function addrs() {
  return {
    nft: process.env.TILL_AGENT_NFT!,
    policy: process.env.TILL_POLICY!,
    vault: process.env.TILL_VAULT!,
  }
}

export async function listTills(owner: string) {
  const p = provider()
  const nft = new ethers.Contract(addrs().nft, NFT_ABI, p)
  const vault = new ethers.Contract(addrs().vault, VAULT_ABI, p)
  const policy = new ethers.Contract(addrs().policy, POLICY_ABI, p)
  const filter = nft.filters.TillMinted(owner)
  let logs
  try {
    logs = await nft.queryFilter(filter, MINT_FROM)
  } catch {
    logs = await nft.queryFilter(filter, -50_000)
  }
  const ids = logs
    .map((l) => {
      const parsed = nft.interface.parseLog({ topics: l.topics as string[], data: l.data })
      return parsed?.args.tokenId as bigint | undefined
    })
    .filter((x): x is bigint => typeof x === 'bigint')
  const unique = [...new Set(ids.map((i) => i.toString()))]
  const rows = []
  for (const id of unique) {
    const tokenId = BigInt(id)
    const [available, locked, authorized, pol] = await Promise.all([
      vault.available(tokenId),
      vault.locked(tokenId),
      nft.authorizedUsersOf(tokenId),
      policy.policyOf(tokenId),
    ])
    rows.push({
      id,
      active: true,
      balance0G: ethers.formatEther(available),
      locked0G: ethers.formatEther(locked),
      paused: Boolean(pol.paused),
      maxPerPurchase0G: ethers.formatEther(pol.maxSpendPerTx),
      rollingCap0G: ethers.formatEther(pol.rollingWindowBudget),
      sessionExpiresAt: Number(pol.sessionExpiresAt),
      authorized: authorized as string[],
      agent: (authorized as string[]).length > 0 ? 'authorized' : 'owner',
      status: pol.paused ? 'paused' : (authorized as string[]).length ? 'autonomous' : 'owner',
    })
  }
  return rows
}

export async function getTill(owner: string, tokenId: string) {
  const rows = await listTills(owner)
  const hit = rows.find((r) => r.id === tokenId)
  if (!hit) throw new Error('Till not found for this owner')
  return hit
}

export async function getPolicy(owner: string, tokenId: string) {
  const till = await getTill(owner, tokenId)
  const p = provider()
  const policy = new ethers.Contract(addrs().policy, POLICY_ABI, p)
  const pol = await policy.policyOf(BigInt(tokenId))
  const exp = Number(pol.sessionExpiresAt)
  return {
    till: tokenId,
    maximumPerPurchase0G: till.maxPerPurchase0G,
    rollingCap0G: till.rollingCap0G,
    missionBudgetUsd: Number(process.env.TILL_USDCE_MAX_ATOMIC ?? '500000') / 1e6,
    allowedServices: ['Investigate', 'Review', 'Research', 'Compare'],
    allowedAssets: ['0G (Till vault + session gas)', '0G Compute (operator Payment Layer)', 'USDC.e session drawer (optional x402)'],
    sessionExpiresAt: exp,
    sessionExpiresIso: exp ? new Date(exp * 1000).toISOString() : null,
    paused: till.paused,
    requireTee: Boolean(pol.requireTee),
    onChain: {
      contract: addrs().policy,
      explorer: `${OG_EXPLORER_URL}/address/${addrs().policy}`,
    },
    note: '0G vault caps are native 0G on TillPolicy. Work Desk Compute tokens are billed to the operator Payment Layer, not TillVault. Optional USDC.e x402 uses a session drawer that is not TillPolicy.',
  }
}

export async function getSession(owner: string, tokenId: string) {
  const till = await getTill(owner, tokenId)
  const now = Math.floor(Date.now() / 1000)
  let status = 'OWNER_MODE'
  if (till.paused) status = 'PAUSED'
  else if (!till.authorized.length) status = 'REVOKED'
  else if (till.sessionExpiresAt && till.sessionExpiresAt < now) status = 'EXPIRED'
  else status = 'READY'
  const p = provider()
  const gas = till.authorized[0] ? await p.getBalance(till.authorized[0]) : 0n
  if (status === 'READY' && gas === 0n) status = 'NOT_FUNDED'
  return {
    till: tokenId,
    status,
    authorized: till.authorized,
    gas0G: ethers.formatEther(gas),
    scope: 'This Till only',
    expiresAt: till.sessionExpiresAt,
    note: 'The session private key never leaves the owner device. Work Desk Storage/anchor is signed by this session. MCP execute is a labeled operator Compute rail and does not use the session key.',
    enableUrl: `${process.env.TILL_WEB_PUBLIC_URL || 'https://till-0g.vercel.app'}/agents`,
  }
}

export async function usdceOf(owner: string) {
  const c = new ethers.Contract(USDCE, ['function balanceOf(address) view returns (uint256)'], provider())
  const raw = (await c.balanceOf(owner)) as bigint
  return { atomic: raw.toString(), usd: Number(raw) / 1e6, asset: 'USDC.e', token: USDCE }
}

export async function assertOwner(owner: string, tokenId: string) {
  const nft = new ethers.Contract(addrs().nft, NFT_ABI, provider())
  const o = String(await nft.ownerOf(BigInt(tokenId)))
  if (o.toLowerCase() !== ethers.getAddress(owner).toLowerCase()) {
    throw new Error('wrong Till')
  }
}

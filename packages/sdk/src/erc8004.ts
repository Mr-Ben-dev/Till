import { ethers } from 'ethers'
import { ERC8004_IDENTITY, ERC8004_REPUTATION, ERC8004_IDENTITY_ABI, ERC8004_REPUTATION_ABI, OG_RPC_URL } from '@till/config'
import { requireEnv } from './env.js'
import { normalizePrivateKey } from './chain.js'

export async function registerAgent(agentURI: string): Promise<{ agentId: bigint; txHash: string }> {
  const key = normalizePrivateKey(requireEnv('DEPLOYER_PRIVATE_KEY'))
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const wallet = new ethers.Wallet(key, provider)
  const identity = new ethers.Contract(ERC8004_IDENTITY, ERC8004_IDENTITY_ABI, wallet)
  const tx = await identity['register(string)'](agentURI)
  const receipt = await tx.wait()
  if (!receipt) throw new Error('ERC-8004 register: no receipt')
  let agentId = 0n
  for (const log of receipt.logs) {
    try {
      const parsed = identity.interface.parseLog({ topics: log.topics as string[], data: log.data })
      if (parsed?.name === 'Registered') agentId = parsed.args.agentId as bigint
    } catch {
      /* skip */
    }
  }
  if (!agentId) throw new Error('ERC-8004 register: Registered event missing')
  return { agentId, txHash: receipt.hash }
}

export async function giveFeedback(
  opts: {
    agentId: bigint
    value: bigint
    tag1: string
    tag2: string
    endpoint: string
    feedbackURI: string
    feedbackHash: string
  },
  signerKey = process.env.DEPLOYER_PRIVATE_KEY
): Promise<{ txHash: string; index: bigint }> {
  if (!signerKey) throw new Error('Missing signer for feedback')
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const wallet = new ethers.Wallet(normalizePrivateKey(signerKey), provider)
  const reputation = new ethers.Contract(ERC8004_REPUTATION, ERC8004_REPUTATION_ABI, wallet)
  const tx = await reputation.giveFeedback(
    opts.agentId,
    opts.value,
    0,
    opts.tag1,
    opts.tag2,
    opts.endpoint,
    opts.feedbackURI,
    opts.feedbackHash
  )
  const receipt = await tx.wait()
  if (!receipt) throw new Error('ERC-8004 feedback: no receipt')
  const index = await reputation.getLastIndex(opts.agentId, wallet.address)
  return { txHash: receipt.hash, index }
}

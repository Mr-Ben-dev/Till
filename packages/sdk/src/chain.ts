import { ethers } from 'ethers'
import {
  ESCROW_ABI,
  NFT_ABI,
  OG_RPC_URL,
  POLICY_ABI,
  VAULT_ABI,
  VERIFIER_ABI,
} from '@till/config'
import { requireEnv } from './env.js'

export type Addresses = {
  nft: string
  policy: string
  verifier: string
  vault: string
  escrow: string
}

export function loadAddresses(): Addresses {
  return {
    nft: requireEnv('TILL_AGENT_NFT'),
    policy: requireEnv('TILL_POLICY'),
    verifier: requireEnv('TILL_VERIFIER'),
    vault: requireEnv('TILL_VAULT'),
    escrow: requireEnv('TILL_JOB_ESCROW'),
  }
}

export function normalizePrivateKey(pk: string): string {
  const hex = pk.trim()
  return hex.startsWith('0x') ? hex : `0x${hex}`
}

export function getSigner(pk = process.env.DEPLOYER_PRIVATE_KEY) {
  if (!pk) throw new Error('Missing private key')
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  return new ethers.Wallet(normalizePrivateKey(pk), provider)
}

/** Deterministic secondary wallet so isolation tests do not burn unrecovered 0G. */
export function derivedWallet(label: string, provider: ethers.Provider) {
  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) throw new Error('Missing private key')
  const seed = ethers.keccak256(ethers.solidityPacked(['string', 'string'], [normalizePrivateKey(pk), label]))
  return new ethers.Wallet(seed, provider)
}

export function contracts(signer: ethers.Signer, addr = loadAddresses()) {
  return {
    nft: new ethers.Contract(addr.nft, NFT_ABI, signer),
    policy: new ethers.Contract(addr.policy, POLICY_ABI, signer),
    verifier: new ethers.Contract(addr.verifier, VERIFIER_ABI, signer),
    vault: new ethers.Contract(addr.vault, VAULT_ABI, signer),
    escrow: new ethers.Contract(addr.escrow, ESCROW_ABI, signer),
  }
}

export async function wait(tx: ethers.ContractTransactionResponse) {
  const receipt = await tx.wait()
  if (!receipt) throw new Error('missing receipt')
  return receipt
}

export const CHAIN_ID = 16661
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://evmrpc.0g.ai'
export const EXPLORER = import.meta.env.VITE_EXPLORER_URL || 'https://chainscan.0g.ai'
export const API = import.meta.env.VITE_API_URL || ''
export const X402 = import.meta.env.VITE_X402_URL || ''

export const ADDR = {
  nft: '0x730e7c02D1C238D98aD38AFED98a7CBA980901bF',
  policy: '0xBf05e322e3C3047089e9Dd9E10Bd8ee320149f7c',
  verifier: '0x4C8bed5Ec7e1F0c0CC7a7Ef141370dd9f4e1A7f1',
  vault: '0x2eD09745E5Ca4BdeaBc93aB3aab65781B03Ed4cB',
  escrow: '0x1BB730Ff8A4Ff93dE9eDD54B178C0Bc9ddE99de9',
  identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
} as const

export const RESOURCE = 'herald://before-you-pay'
export const DEFAULT_BRIEF_SUBJECT =
  'Should I deposit into this protocol? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const MINT_FROM_BLOCK = 42_110_000n

import { defineChain } from 'viem'

export const ogAristotle = defineChain({
  id: CHAIN_ID,
  name: '0G Aristotle',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: '0G ChainScan', url: EXPLORER },
  },
})

export function txUrl(hash: string) {
  return `${EXPLORER}/tx/${hash}`
}

export function addrUrl(addr: string) {
  return `${EXPLORER}/address/${addr}`
}

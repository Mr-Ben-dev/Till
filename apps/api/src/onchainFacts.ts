import { ethers } from 'ethers'
import { OG_RPC_URL } from '@till/config'

export type PublicFacts = {
  chain: string
  chainId: number
  explorer: string
  addresses: Record<
    string,
    {
      address: string
      hasContractCode: boolean
      codeBytes: number
      nativeBalance0G: string
      txCount: number
    }
  >
  source: 'aristotle-rpc'
  note: string
}

export async function publicFactsFor(subject: string, extra?: string[]): Promise<PublicFacts> {
  const fromText = [...new Set((subject.match(/0x[a-fA-F0-9]{40}/g) || []).map((a) => a))]
  const addrs = [...new Set([...(extra || []), ...fromText])].slice(0, 2)
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const addresses: PublicFacts['addresses'] = {}
  for (const raw of addrs) {
    const address = ethers.getAddress(raw)
    const [code, bal, txCount] = await Promise.all([
      provider.getCode(address),
      provider.getBalance(address),
      provider.getTransactionCount(address),
    ])
    addresses[address] = {
      address,
      hasContractCode: code !== '0x',
      codeBytes: code === '0x' ? 0 : (code.length - 2) / 2,
      nativeBalance0G: ethers.formatEther(bal),
      txCount,
    }
  }
  return {
    chain: '0G Aristotle',
    chainId: 16661,
    explorer: 'https://chainscan.0g.ai',
    addresses,
    source: 'aristotle-rpc',
    note: 'Public RPC facts only. Not a paid x402 scanner. Not shared with external sellers.',
  }
}

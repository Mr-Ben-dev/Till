export const CHECKS = [
  {
    id: 'safety',
    title: 'Safety',
    body: 'Honeypot · taxes · admin controls',
    seller: 'AgentToll',
    sku: 'base-safety',
    price: '$0.003',
  },
  {
    id: 'market',
    title: 'Market',
    body: 'Price · oracle freshness · liquidity signals',
    seller: 'api402x',
    sku: 'oracle-staleness',
    price: '$0.003',
  },
  {
    id: 'contract',
    title: 'Contract',
    body: 'Mint · pause · blacklist · upgradeability',
    seller: 'token-risk',
    sku: 'bytecode-scan',
    price: '$0.010',
  },
] as const

export const EXAMPLES = [
  { label: 'Should I deposit into this protocol?', value: 'Should I deposit into this protocol? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { label: 'Is this token safe to buy?', value: 'Is this token safe to buy? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { label: 'Is this contract too risky to interact with?', value: 'Is this contract too risky to interact with? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { label: 'Check this protocol before I fund it.', value: 'Check this protocol before I fund it. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
] as const

export function humanCheck(seller: string, sku: string) {
  const hit = CHECKS.find(
    (c) => c.seller.toLowerCase() === seller.toLowerCase() || sku.toLowerCase().includes(c.sku.split('-')[0]!),
  )
  if (hit) return { title: hit.title, body: hit.body, provider: hit.seller }
  if (/toll|safety|honeypot|tax/i.test(seller + sku)) return { title: 'Token Safety', body: 'Honeypot / tax / owner checks', provider: seller }
  if (/oracle|api402|price|pyth/i.test(seller + sku)) return { title: 'Market Check', body: 'Oracle freshness / price reliability', provider: seller }
  if (/token-risk|bytecode|upgrade/i.test(seller + sku)) return { title: 'Contract Risk', body: 'Mint / pause / blacklist / upgradeability', provider: seller }
  return { title: seller, body: sku, provider: seller }
}

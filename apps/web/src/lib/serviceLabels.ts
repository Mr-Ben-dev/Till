export const CHECKS = [
  {
    id: 'safety',
    title: 'Safety',
    body: 'Public on-chain facts plus private Compute',
    seller: 'Aristotle RPC',
    sku: 'investigate',
    price: 'Compute',
  },
] as const

export const USES = [
  {
    label: 'Investigate',
    body: 'Private on-chain investigation of an address, token, or protocol.',
    value: 'Investigate this contract. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    label: 'Review',
    body: 'AI-assisted Solidity/ABI review. Not a certified audit.',
    value: 'Review this Solidity. pragma solidity ^0.8.20; contract NaiveVault { mapping(address => uint256) public deposits; function deposit() external payable { deposits[msg.sender] += msg.value; } function rescue() external { payable(msg.sender).transfer(address(this).balance); } }',
  },
  {
    label: 'Research',
    body: 'A private structured brief from 0G Compute. Not a chatbot.',
    value: 'Research the Till vault design on 0G Aristotle for me.',
  },
  {
    label: 'Compare',
    body: 'Two addresses. Differences, not a scoreboard.',
    value: 'Compare 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 and 0x220f5CeDDB65FD7b9D228c9495639Af58e61d1d7',
  },
] as const

export const EXAMPLES = USES.map((u) => ({ label: u.label, value: u.value }))

export function humanCheck(seller: string, sku: string) {
  const hit = CHECKS.find(
    (c) => c.seller.toLowerCase() === seller.toLowerCase() || sku.toLowerCase().includes(c.sku.split('-')[0]!),
  )
  if (hit) return { title: hit.title, body: hit.body, provider: hit.seller }
  return { title: seller, body: sku, provider: seller }
}

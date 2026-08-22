export const WEB = 'https://till-0g.vercel.app'
export const API = 'https://till-api.onrender.com'
export const MCP_URL = `${API}/mcp`
export const NPM_SDK = 'till-0g-sdk'
export const NPM_MCP = 'till-0g-mcp'
export const NPM_SDK_VER = '0.1.1'
export const NPM_MCP_VER = '0.1.0'
export const CHAIN_ID = 16661
export const EXPLORER = 'https://chainscan.0g.ai'
export const HUB_SWAP = 'https://hub.0g.ai/swap?network=mainnet'
export const GITHUB = 'https://github.com/Mr-Ben-dev/Till'
export const MISSION_CAP_USD = 0.5

export const ADDR = {
  nft: '0x730e7c02D1C238D98aD38AFED98a7CBA980901bF',
  policy: '0xBf05e322e3C3047089e9Dd9E10Bd8ee320149f7c',
  verifier: '0x4C8bed5Ec7e1F0c0CC7a7Ef141370dd9f4e1A7f1',
  vault: '0x2eD09745E5Ca4BdeaBc93aB3aab65781B03Ed4cB',
  escrow: '0x1BB730Ff8A4Ff93dE9eDD54B178C0Bc9ddE99de9',
  identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  paymentLayer: '0xA3b15Bd2aD18BFB6b5f92D8AA9F444Dd59d1cE32',
  storageFlow: '0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526',
  usdce: '0x1f3aa82227281ca364bfb3d253b0f1af1da6473e',
  heraldPayTo: '0x686Ca1f3BAf7F7Df3334f2f1A65AE314ee9CDb29',
} as const

export const CREATE_TX = {
  nft: '0x59f24f1e56504ed93b1fdc2b7901c7db56bed4011a9d13ace8e8f1d4a4b75db0',
  policy: '0x86e6ade3764913aa19de4f28aa14ab5b650f9c2eb5699d41bb93a1f978fa47cb',
  verifier: '0xd9fc3e4e50ebff47791bbec6cd981b79c757c82837ca0e35c1a64dbfcd8f05a1',
  vault: '0xc7be3972506842a8794307bbee4f8d41999dce4cef56dce8334ad86e051fab5d',
  escrow: '0xe801cb7f12dba2b34ef47227a805b3993111900449c6d9f58d6cb62ab0452c42',
} as const

export const INTERFACES = [
  { id: '0x80ac58cd', name: 'IERC721', result: true },
  { id: '0x2afbede9', name: 'IERC7857', result: true },
  { id: '0xdf597d99', name: 'IERC7857Authorize', result: true },
  { id: '0x74f8628b', name: 'IERC7857Cloneable', result: true },
  { id: '0xf9a82da5', name: 'old Till IERC7857', result: false },
] as const

export const PROOFS = {
  mint2: '0x02b138362ded4b4930a55c3ab96eee9521b0eec009c90824cb0beb22326472d6',
  fund: '0x8fb641a85bdfe99a222399fbe25843c0bbdd2ad69b8f3063428997aabe3073d5',
  agentToll: '0x58731e432ae12ba2ed3d428fe834d40c28c838cf599ea87aa254d4091b1a37a1',
  storageFlow: '0x4ea0b7938003b35dfa13f4865289da130a36686ae6f56acebcbd8939d05bccd0',
  storageAnchor: '0xefbe1b3d29564f19bed969d4737f9182fd80f30553f80acc09adb5617a0a5415',
  sessionAnchor: '0x3ed197be21fd587954821f1e36c9387e53833e9108ab2ec0ebcca3a7c0380fd1',
  workInvestigateFlow: '0x913cae3a6aaaea0949bac9f27427bd338ac2ad21479427b9c62d5dfb7f05c860',
  workInvestigateAnchor: '0x494a23418750b795ef8070240f0d8bb416b29f7f2f8ffd7613265101f5cbeb50',
  workReviewFlow: '0x18365995d04d825c204ccf1a56a52452fb3548779f59f73d6babc500f0b22d88',
  workReviewAnchor: '0x34be22641171b57c197408461ded8e7bf8328771ca285292b2bfafe36f1d6403',
  workResearchFlow: '0x4707bf70d38290b59bce2001fa4acb764df1a46a5fae3b08c45db6833bca9989',
  workResearchAnchor: '0xb953923663552262965ab0d745cdd0fe496b71f963fd19f8b3d6cf70be4983d4',
  workCompareFlow: '0xbae0b8083de50838d409e833ddfc5b8ed8711c294d27cbe5b1b26c857f4a98bc',
  workCompareAnchor: '0x8d8dfce597bccccd506e933264cf8d5c111471399c0dc01a5f4c788dc3cd1f12',
  erc8004Identity: '0x6446a6c24a28b23088ef36d92309a3aefbe58b7264da88ae691cb374358ff33a',
  jobSettle: '0x50b1052fb6aa6b133d013f631f584867a6d14fdc685bc789f9ff9ba84666bbdc',
  jobRefund: '0x3695d0ffb906e4c3d82bd3a610276ba738bfca214113ce6b1f2b1117c6e60bad',
} as const

export const ROLES = {
  fastPolicy: 'glm-5.2',
  defaultPolicy: '0gm-1.0-35b-a3b',
  highRisk: '0gm-1.0-35b-a3b',
  jobSemantic: 'glm-5.2',
} as const

export const SCOPES_READ = [
  'till.read',
  'till.policy.read',
  'till.mission.create',
  'till.activity.read',
  'till.proof.read',
  'till.session.read',
] as const
export const SCOPES_EXEC = ['till.mission.execute'] as const
export const SCOPES_RISK = ['till.policy.write', 'till.session.revoke', 'till.withdraw'] as const

export const TOOLS = [
  { name: 'till_list', purpose: 'List Tills owned by the signed wallet.', args: 'none', spend: false, policy: false, revoke: false, scope: 'till.read' },
  { name: 'till_get', purpose: 'Balance, policy summary, session status for one Till.', args: 'tokenId?', spend: false, policy: false, revoke: false, scope: 'till.read' },
  { name: 'till_get_policy', purpose: 'Plain-English policy plus on-chain caps.', args: 'tokenId?', spend: false, policy: false, revoke: false, scope: 'till.policy.read' },
  { name: 'till_create_mission', purpose: 'Draft a Work Desk job. Does not execute.', args: 'subject', spend: false, policy: false, revoke: false, scope: 'till.mission.create' },
  { name: 'till_quote_mission', purpose: 'Compile a Work Desk job. Does not execute.', args: 'subject', spend: false, policy: false, revoke: false, scope: 'till.mission.create' },
  { name: 'till_run_mission', purpose: 'OPERATOR rail: API operator runs 0G Compute (Payment Layer), not the browser session. Labeled. No owner key. No session key. Cannot Storage-anchor.', args: 'subject, tokenId?', spend: true, policy: false, revoke: false, scope: 'till.mission.execute' },
  { name: 'till_get_result', purpose: 'Stored mission receipt by tx if persisted.', args: 'tx', spend: false, policy: false, revoke: false, scope: 'till.proof.read' },
  { name: 'till_review', purpose: 'Compile a Review job. AI-assisted — not a certified audit.', args: 'subject', spend: false, policy: false, revoke: false, scope: 'till.mission.create' },
  { name: 'till_get_mission', purpose: 'Re-quote if subject is passed.', args: 'subject?', spend: false, policy: false, revoke: false, scope: 'till.proof.read' },
  { name: 'till_get_activity', purpose: 'Till status plus Activity/Verify URLs.', args: 'tokenId?', spend: false, policy: false, revoke: false, scope: 'till.activity.read' },
  { name: 'till_get_proof', purpose: 'How to verify a tx hash on Aristotle.', args: 'tx', spend: false, policy: false, revoke: false, scope: 'till.proof.read' },
  { name: 'till_get_session', purpose: 'Session status. Never returns a private key.', args: 'tokenId?', spend: false, policy: false, revoke: false, scope: 'till.session.read' },
  { name: 'till_revoke_session', purpose: 'Does not sign revoke. Returns the owner-wallet URL.', args: 'none', spend: false, policy: false, revoke: false, scope: 'till.session.revoke' },
] as const

export function txUrl(hash: string) {
  return `${EXPLORER}/tx/${hash}`
}
export function addrUrl(addr: string) {
  return `${EXPLORER}/address/${addr}`
}

export function setupPrompt(token: string) {
  return `You are connecting to Till MCP.

1. Install Till MCP (HTTP ${MCP_URL} or stdio npx -y till-0g-mcp).
2. Configure that production endpoint. Do not use localhost unless I say so.
3. Authenticate with the scoped token I provide. Token (do not print, save to source, commit, or log): ${token}
4. initialize
5. tools/list
6. till_list then till_get for the active Till
7. till_get_policy
8. till_get_session and report READY / NOT_FUNDED / OWNER_MODE honestly
9. till_quote_mission for the subject I give you
10. Stop before any spend unless I explicitly ask you to run the mission

Never print the token.
Never save it to source code.
Never commit it.
Never log it.
Never execute till_run_mission unless the on-chain session is READY and I asked.

After setup, report only: MCP connected, tools available, Till detected, session status.`
}

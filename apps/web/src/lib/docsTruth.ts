export const WEB = 'https://till-0g.vercel.app'
export const API = 'https://till-api.onrender.com'
export const MCP_URL = `${API}/mcp`
export const NPM_SDK = 'till-0g-sdk'
export const NPM_MCP = 'till-0g-mcp'
export const NPM_SDK_VER = '0.1.0'
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
  api402x: '0x3994a707a4c370a45fa98f39261c3ce1560af62656b45eda4ec64959b52315e3',
  tokenRisk: '0x637d9ca7d4ecf39bb256ee0aae0d62be9ea4cb4e4ca857499e9e3da916c4679f',
  storageFlow: '0x4ea0b7938003b35dfa13f4865289da130a36686ae6f56acebcbd8939d05bccd0',
  storageAnchor: '0xefbe1b3d29564f19bed969d4737f9182fd80f30553f80acc09adb5617a0a5415',
  sessionAnchor: '0x3ed197be21fd587954821f1e36c9387e53833e9108ab2ec0ebcca3a7c0380fd1',
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
  { name: 'till_create_mission', purpose: 'Draft a Before You Pay mission. Does not pay.', args: 'subject', spend: false, policy: false, revoke: false, scope: 'till.mission.create' },
  { name: 'till_quote_mission', purpose: 'Live x402 quotes. Does not execute.', args: 'subject', spend: false, policy: false, revoke: false, scope: 'till.mission.create' },
  { name: 'till_run_mission', purpose: 'Execute under policy only if on-chain session is READY. No owner key. Does not fake Storage anchor.', args: 'subject, tokenId?', spend: true, policy: false, revoke: false, scope: 'till.mission.execute' },
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
  return `You are connecting to Till.

Install the Till MCP server.

Use ONLY the provided scoped token.
Token (do not print, save to source, commit, or log): ${token}

Never print the token.
Never save it to source code.
Never commit it to git.
Never send it to another service.
Never expose it in logs.

Configure the MCP server using the following production endpoint:

${MCP_URL}

Use the provided authorization credential exactly as instructed.

Then test:

1. initialize
2. tools/list
3. till_list
4. till_get
5. till_get_policy
6. till_quote_mission

Do NOT execute spending until the user explicitly asks.

If the user's Till has no READY autonomous session, explain that autonomous execution is unavailable.

After setup, report ONLY:

MCP connected
Tools available
Till detected
Session status

Never print the secret token.`
}

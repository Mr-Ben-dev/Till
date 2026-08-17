export const OG_CHAIN_ID = 16661
export const OG_RPC_URL = process.env.OG_RPC_URL ?? 'https://evmrpc.0g.ai'
export const OG_EXPLORER_URL = process.env.OG_EXPLORER_URL ?? 'https://chainscan.0g.ai'
export const OG_ROUTER_URL = process.env.OG_ROUTER_URL ?? 'https://router-api.0g.ai/v1'
export const OG_STORAGE_INDEXER_URL =
  process.env.OG_STORAGE_INDEXER_URL ?? 'https://indexer-storage-turbo.0g.ai'
export const OG_PAYMENT_LAYER =
  process.env.OG_PAYMENT_LAYER ?? '0xA3b15Bd2aD18BFB6b5f92D8AA9F444Dd59d1cE32'
export const ERC8004_IDENTITY =
  process.env.ERC8004_IDENTITY ?? '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
export const ERC8004_REPUTATION =
  process.env.ERC8004_REPUTATION ?? '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63'

export const ROLES = {
  fastPolicy: 'fastPolicy',
  defaultPolicy: 'defaultPolicy',
  highRisk: 'highRisk',
  jobSemantic: 'jobSemantic',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_REQUIREMENTS: Record<
  Role,
  { json: true; tools: boolean; tee: true; privatePreferred: boolean; reasoning: boolean }
> = {
  fastPolicy: { json: true, tools: true, tee: true, privatePreferred: false, reasoning: false },
  defaultPolicy: { json: true, tools: true, tee: true, privatePreferred: true, reasoning: false },
  highRisk: { json: true, tools: true, tee: true, privatePreferred: true, reasoning: true },
  jobSemantic: { json: true, tools: true, tee: true, privatePreferred: false, reasoning: true },
}

export const NFT_ABI = [
  'function mint() returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function authorizeUsage(uint256,address)',
  'function revokeAuthorization(uint256,address)',
  'function clearAuthorizedUsers(uint256)',
  'function authorizedUsersOf(uint256) view returns (address[])',
  'function isUsageAuthorized(uint256,address) view returns (bool)',
  'function supportsInterface(bytes4) view returns (bool)',
  'function intelligentDatasOf(uint256) view returns (tuple(string dataDescription,bytes32 dataHash)[])',
  'event TillMinted(address indexed owner, uint256 indexed tokenId)',
  'event AuthorizationGranted(address indexed owner, address indexed user, uint256 indexed tokenId)',
  'event AuthorizationRevoked(address indexed owner, address indexed user, uint256 indexed tokenId)',
]

export const POLICY_ABI = [
  'function setPolicy(uint256,uint128,uint128,uint64,uint64,bool,bool)',
  'function setPaused(uint256,bool)',
  'function setAllowlistMode(uint256,bool,bool,bool)',
  'function setAllowedTarget(uint256,address,bool)',
  'function setAllowedResource(uint256,bytes32,bool)',
  'function preview(uint256,address,uint256,bytes32,bytes4) view returns (bool,bool)',
  'function policyOf(uint256) view returns (tuple(uint128 maxSpendPerTx,uint128 rollingWindowBudget,uint64 rollingWindowSeconds,uint64 sessionExpiresAt,uint64 windowStart,uint128 windowSpent,bool paused,bool requireTee,bool requireEvidence,bool targetAllowlistEnabled,bool resourceAllowlistEnabled,bool selectorAllowlistEnabled))',
  'function allowedTargets(uint256,address) view returns (bool)',
  'function allowedResourceHashes(uint256,bytes32) view returns (bool)',
]

export const VERIFIER_ABI = [
  'function digest((uint256,uint256,address,uint256,bytes32,bool)) view returns (bytes32)',
  'function setTillTeeSigner(uint256,address,bool)',
  'function setGlobalTeeSigner(address,bool)',
  'function tillTeeSigners(uint256,address) view returns (bool)',
]

export const VAULT_ABI = [
  'function deposit(uint256) payable',
  'function withdraw(uint256,uint256)',
  'function available(uint256) view returns (uint256)',
  'function locked(uint256) view returns (uint256)',
  'function usedNonces(uint256,uint256) view returns (bool)',
  'function release(uint256,address,uint256,bytes32,uint256,bytes,bytes)',
  'function lockToJob(bytes32,uint256,address,uint256,bytes32,uint256,uint64,bytes,bytes)',
  'function anchorPacket(uint256,bytes32)',
  'function RELEASE_SELECTOR() view returns (bytes4)',
  'event Released(uint256 indexed tokenId, address indexed executor, address indexed to, uint256 amount, bytes32 resourceHash, uint256 nonce)',
  'event Deposited(uint256 indexed tokenId, address indexed from, uint256 amount, uint256 availableAfter)',
  'event Withdrawn(uint256 indexed tokenId, address indexed to, uint256 amount, uint256 availableAfter)',
  'event CreditRefund(uint256 indexed tokenId, uint256 amount, uint256 availableAfter)',
  'event PacketAnchored(uint256 indexed tokenId, bytes32 indexed rootHash)',
]

export const ESCROW_ABI = [
  'function settle(bytes32)',
  'function refund(bytes32)',
  'function jobs(bytes32) view returns (uint256 tokenId, address payee, uint256 amount, uint64 deadline, bool settled, bool refunded)',
  'event JobSettled(bytes32 indexed jobId, uint256 indexed tokenId, address payee, uint256 amount)',
  'event JobRefunded(bytes32 indexed jobId, uint256 indexed tokenId, uint256 amount)',
]

export const ERC8004_IDENTITY_ABI = [
  'function register(string) returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]

export const ERC8004_REPUTATION_ABI = [
  'function giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)',
  'function getLastIndex(uint256,address) view returns (uint64)',
  'function readFeedback(uint256,address,uint64) view returns (int128,uint8,string,string,bool)',
  'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
]

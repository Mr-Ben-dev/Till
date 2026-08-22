export const NFT_ABI = [
  'function mint() returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function authorizeUsage(uint256,address)',
  'function revokeAuthorization(uint256,address)',
  'function clearAuthorizedUsers(uint256)',
  'function authorizedUsersOf(uint256) view returns (address[])',
  'function isUsageAuthorized(uint256,address) view returns (bool)',
  'function supportsInterface(bytes4) view returns (bool)',
  'event TillMinted(address indexed owner, uint256 indexed tokenId)',
  'event AuthorizationGranted(address indexed owner, address indexed user, uint256 indexed tokenId)',
  'event AuthorizationRevoked(address indexed owner, address indexed user, uint256 indexed tokenId)',
] as const

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
  'event PolicySet(uint256 indexed tokenId,uint128,uint128,uint64,uint64,bool,bool)',
  'event PauseSet(uint256 indexed tokenId,bool paused)',
  'error NotOwner()',
  'error OnlyVault()',
  'error BadWindow()',
  'error Paused()',
  'error SessionExpired()',
  'error CapExceeded()',
  'error WindowExceeded()',
  'error TargetNotAllowed()',
  'error ResourceNotAllowed()',
  'error SelectorNotAllowed()',
  'error ZeroToken()',
] as const

export const VERIFIER_ABI = [
  'function digest((uint256,uint256,address,uint256,bytes32,bool)) view returns (bytes32)',
  'function setTillTeeSigner(uint256,address,bool)',
  'function tillTeeSigners(uint256,address) view returns (bool)',
  'function tillTeeSigners(uint256,address) view returns (bool)',
] as const

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
  'event PacketAnchored(uint256 indexed tokenId, bytes32 indexed rootHash)',
] as const

export const ESCROW_ABI = [
  'function settle(bytes32)',
  'function refund(bytes32)',
  'function jobs(bytes32) view returns (uint256 tokenId, address payee, uint256 amount, uint64 deadline, bool settled, bool refunded)',
  'event JobSettled(bytes32 indexed jobId, uint256 indexed tokenId, address payee, uint256 amount)',
  'event JobRefunded(bytes32 indexed jobId, uint256 indexed tokenId, uint256 amount)',
  'event JobOpened(bytes32 indexed jobId, uint256 indexed tokenId, address payee, uint256 amount, uint64 deadline)',
] as const

export const ERC8004_IDENTITY_ABI = [
  'function register(string) returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
] as const

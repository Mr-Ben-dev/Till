export type Grant = {
  grantId: string
  tokenId: string
  owner: string
  executor: string
  scopes: string[]
  resourceHashes: string[]
  capWei: string
  expiresAt: number
  revoked: boolean
}

const grants = new Map<string, Grant>()

export function issueGrant(g: Omit<Grant, 'grantId' | 'revoked'>): Grant {
  const grant: Grant = { ...g, grantId: crypto.randomUUID(), revoked: false }
  grants.set(grant.grantId, grant)
  return grant
}

export function revokeGrant(grantId: string): void {
  const g = grants.get(grantId)
  if (!g) throw new Error('unknown grant')
  g.revoked = true
}

export function assertGrant(grantId: string, tokenId: string, executor: string, resourceHash: string, amountWei: bigint): Grant {
  const g = grants.get(grantId)
  if (!g) throw new Error('unknown grant')
  if (g.revoked) throw new Error('grant revoked')
  if (g.tokenId !== tokenId) throw new Error('grant token mismatch')
  if (g.executor.toLowerCase() !== executor.toLowerCase()) throw new Error('grant executor mismatch')
  if (Date.now() / 1000 > g.expiresAt) throw new Error('grant expired')
  if (g.resourceHashes.length && !g.resourceHashes.includes(resourceHash)) {
    throw new Error('resource not in grant')
  }
  if (amountWei > BigInt(g.capWei)) throw new Error('grant cap exceeded')
  return g
}

export function getGrant(grantId: string): Grant | undefined {
  return grants.get(grantId)
}

export function listGrants(): Grant[] {
  return [...grants.values()]
}

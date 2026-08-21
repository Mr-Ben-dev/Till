export type SignKind = 'owner' | 'auto' | ''

const OWNER: Record<string, string> = {
  mint: 'Creating a Till is an owner mint on Aristotle.',
  fund: 'Depositing 0G into this Till uses your wallet.',
  policy: 'Only the owner can write or change protection rules.',
  authorize: 'You are authorizing a device-local session. The agent never gets this wallet.',
  revoke: 'Revoking a session is an owner action.',
  pause: 'Pause and unpause always use the owner wallet.',
  withdraw: 'Withdrawals always use the owner wallet.',
  gas: 'Sending gas to the session key uses your wallet.',
  'job-tee': 'Registering this Till’s TEE signer is a one-time owner action.',
  'job-lock': 'Locking job funds into escrow uses the owner wallet.',
  'job-finish': 'Settle and refund are owner actions. The session cannot move job escrow.',
  network: 'Switching to 0G Aristotle uses your wallet.',
  mission: 'No READY session. This mission will ask for your wallet.',
}

export function ownerWhy(write: string) {
  return OWNER[write] || 'This change is an owner action on Aristotle.'
}

export function autoWhy(write: string) {
  if (write === 'mission') return 'A READY session signs approved purchases. MetaMask will not open.'
  return 'Approved work runs on the device-local session. MetaMask will not open.'
}

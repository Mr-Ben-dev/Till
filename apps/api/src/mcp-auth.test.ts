import assert from 'node:assert/strict'
import { parseScopes, rejectPrivateKeyPayload, READ_SCOPES, HIGH_RISK_SCOPES } from './mcp-auth.js'

const read = parseScopes(undefined, false)
assert.deepEqual(read, [...READ_SCOPES])
const noRisk = parseScopes(['till.read', 'till.withdraw'], false)
assert.ok(!noRisk.includes('till.withdraw'))
assert.ok(parseScopes(['till.withdraw'], true).includes('till.withdraw'))
assert.throws(() => rejectPrivateKeyPayload({ privateKey: '0xabc' }))
assert.throws(() => rejectPrivateKeyPayload({ k: '0x' + 'ab'.repeat(32) }))
rejectPrivateKeyPayload({ subject: 'hello' })
assert.ok(HIGH_RISK_SCOPES.includes('till.withdraw'))
console.log('mcp-auth ok')

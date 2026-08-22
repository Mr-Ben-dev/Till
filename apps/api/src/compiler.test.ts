import { compileMission } from './compiler.js'
import assert from 'node:assert/strict'
import test from 'node:test'

test('refuses poems', () => {
  const r = compileMission({ text: 'write a poem about dogs' })
  assert.equal(r.ok, false)
  assert.ok(r.refuse)
})

test('pay asks for address', () => {
  const r = compileMission({ text: 'I am considering putting $500 into this protocol' })
  assert.equal(r.ok, false)
  assert.equal(r.family, 'pay')
  assert.ok(r.ask)
})

test('pay with address', () => {
  const r = compileMission({
    text: 'Should I deposit? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  })
  assert.equal(r.ok, true)
  assert.equal(r.family, 'pay')
  assert.equal(r.needsProcurement, true)
})

test('review asks for artifact', () => {
  const r = compileMission({ text: 'review this solidity' })
  assert.equal(r.ok, false)
  assert.equal(r.family, 'review')
})

test('review with paste', () => {
  const r = compileMission({
    text: 'review this',
    family: 'review',
    artifact: 'pragma solidity ^0.8.20; contract X { function mint() external {} } extra padding for length -----',
  })
  assert.equal(r.ok, true)
  assert.equal(r.family, 'review')
  assert.equal(r.needsProcurement, false)
})

test('review infers artifact from solidity in the request', () => {
  const r = compileMission({
    family: 'review',
    text: 'pragma solidity ^0.8.20; contract NaiveVault { mapping(address => uint256) public deposits; function deposit() external payable { deposits[msg.sender] += msg.value; } }',
  })
  assert.equal(r.ok, true)
  assert.equal(r.family, 'review')
  assert.equal(r.needsProcurement, false)
  assert.ok(r.artifact)
})

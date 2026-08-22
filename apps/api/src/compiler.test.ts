import { compileMission } from './compiler.js'
import assert from 'node:assert/strict'
import test from 'node:test'

test('refuses poems', () => {
  const r = compileMission({ text: 'write a poem about dogs' })
  assert.equal(r.ok, false)
  assert.ok(r.refuse)
})

test('investigate asks for address', () => {
  const r = compileMission({ text: 'I am considering putting $500 into this protocol' })
  assert.equal(r.ok, false)
  assert.equal(r.family, 'investigate')
  assert.ok(r.ask)
})

test('pay alias becomes investigate and does not require x402', () => {
  const r = compileMission({
    text: 'Should I deposit? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    family: 'pay',
  })
  assert.equal(r.ok, true)
  assert.equal(r.family, 'investigate')
  assert.equal(r.needsProcurement, false)
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

test('compare asks for two addresses', () => {
  const r = compileMission({ family: 'compare', text: 'compare these' })
  assert.equal(r.ok, false)
  assert.ok(r.ask)
})

test('research without address is ok', () => {
  const r = compileMission({ text: 'Research the Till vault design on 0G Aristotle for me.' })
  assert.equal(r.ok, true)
  assert.equal(r.family, 'research')
  assert.equal(r.needsProcurement, false)
})

test('compare with two addresses', () => {
  const r = compileMission({
    family: 'compare',
    text: 'compare 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 and 0x220f5CeDDB65FD7b9D228c9495639Af58e61d1d7',
  })
  assert.equal(r.ok, true)
  assert.equal(r.family, 'compare')
  assert.ok(r.targetB)
})

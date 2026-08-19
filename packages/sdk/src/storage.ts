import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ethers } from 'ethers'
import { Indexer, ZgFile } from '@0gfoundation/0g-storage-ts-sdk'
import { OG_RPC_URL, OG_STORAGE_INDEXER_URL } from '@till/config'
import './env.js'
import { normalizePrivateKey } from './chain.js'

export type StoredPacket = {
  rootHash: string
  txHash: string
  keyHex: string
}

export async function uploadEncryptedPacket(packet: unknown): Promise<StoredPacket> {
  const key = process.env.DEPLOYER_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY
  if (!key) throw new Error('Missing DEPLOYER_PRIVATE_KEY for Storage upload')
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL)
  const signer = new ethers.Wallet(normalizePrivateKey(key), provider)
  const indexer = new Indexer(OG_STORAGE_INDEXER_URL)
  const aesKey = randomBytes(32)
  const dir = await mkdtemp(path.join(os.tmpdir(), 'till-'))
  const filePath = path.join(dir, 'packet.json')
  await writeFile(filePath, JSON.stringify(packet), 'utf8')
  const file = await ZgFile.fromFilePath(filePath)
  try {
    const [result, err] = await indexer.upload(file, OG_RPC_URL, signer, {
      encryption: { type: 'aes256', key: aesKey },
      proof: true,
      finalityRequired: true,
    } as never)
    if (err) throw err
    if (!('rootHash' in result) || !result.rootHash) {
      throw new Error('Storage upload returned no root hash')
    }
    return { rootHash: result.rootHash, txHash: result.txHash, keyHex: aesKey.toString('hex') }
  } finally {
    await file.close().catch(() => undefined)
    await rm(dir, { recursive: true, force: true })
  }
}

export async function downloadEncryptedPacket(rootHash: string, outPath: string): Promise<Buffer> {
  const indexer = new Indexer(OG_STORAGE_INDEXER_URL)
  const err = await indexer.download(rootHash, outPath, true)
  if (err) throw err
  return readFile(outPath)
}

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

export type StoredReceipt = {
  id: string
  tx: string
  tokenId?: string
  family?: string
  session?: string
  owner?: string
  rail?: 'session' | 'operator'
  spentUsd?: number
  verdict?: string
  model?: string
  processResponse?: boolean
  purchases?: unknown
  packet?: unknown
  createdAt: string
}

const DIR = process.env.TILL_DATA_DIR || path.resolve(process.cwd(), 'data')
const FILE = path.join(DIR, 'receipts.json')

type Db = { receipts: Record<string, StoredReceipt> }

function load(): Db {
  try {
    if (!existsSync(FILE)) return { receipts: {} }
    return JSON.parse(readFileSync(FILE, 'utf8')) as Db
  } catch {
    return { receipts: {} }
  }
}

function save(db: Db) {
  mkdirSync(DIR, { recursive: true })
  const tmp = FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(db, null, 0))
  renameSync(tmp, FILE)
}

export function putReceipt(row: StoredReceipt) {
  const db = load()
  const key = row.tx.toLowerCase()
  db.receipts[key] = row
  if (row.id) db.receipts[row.id] = row
  save(db)
  return row
}

export function getReceipt(txOrId: string): StoredReceipt | null {
  const db = load()
  return db.receipts[txOrId.toLowerCase()] ?? db.receipts[txOrId] ?? null
}

export function listReceipts(tokenId?: string): StoredReceipt[] {
  const db = load()
  const seen = new Set<string>()
  const out: StoredReceipt[] = []
  for (const row of Object.values(db.receipts)) {
    if (tokenId && row.tokenId !== tokenId) continue
    if (seen.has(row.tx.toLowerCase())) continue
    seen.add(row.tx.toLowerCase())
    out.push(row)
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

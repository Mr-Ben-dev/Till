import { existsSync } from 'node:fs'
import path from 'node:path'
import { config as load } from 'dotenv'

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
  'd:\\route\\0g\\.env',
  'd:\\route\\0g\\till\\.env',
]

for (const file of candidates) {
  if (existsSync(file)) load({ path: file, override: false })
}

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

export function productionGuards(): void {
  const chain = process.env.OG_CHAIN_ID ?? '16661'
  if (process.env.TILL_DEV_SIMULATE === '1' && (process.env.NODE_ENV === 'production' || chain === '16661')) {
    throw new Error('TILL_DEV_SIMULATE=1 is forbidden on Aristotle / production boot')
  }
  if (process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY) {
    throw new Error('OpenAI/Groq keys are forbidden on the Till money path')
  }
}

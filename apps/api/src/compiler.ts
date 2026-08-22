export type MissionFamily = 'investigate' | 'review' | 'research' | 'compare'

export type CompileResult = {
  ok: boolean
  family?: MissionFamily
  familyLabel?: string
  refuse?: string
  ask?: string
  goal?: string
  target?: string | null
  targetB?: string | null
  artifact?: string | null
  needsProcurement: boolean
  expectedOutput?: string
  proof?: string
  copilot?: string
}

const ADDR = /0x[a-fA-F0-9]{40}/g
const REFUSE =
  /\b(poem|poems|haiku|joke|meme|memes|chat with me|girlfriend|roleplay|nsfw)\b/i

function inferredArtifact(text: string, artifact: string): string {
  if (artifact) return artifact
  if (/\bpragma\s+solidity\b/i.test(text)) return text
  if (/\bcontract\s+[A-Za-z_]/.test(text) && text.length > 40) return text
  if (/\[\s*\{\s*"type"\s*:/.test(text)) return text
  return ''
}

function addrs(text: string): string[] {
  return [...new Set((text.match(ADDR) || []).map((a) => a))]
}

function normalizeFamily(raw: string): MissionFamily | undefined {
  const f = raw.toLowerCase()
  if (f === 'investigate' || f === 'pay' || f === 'trust') return 'investigate'
  if (f === 'review') return 'review'
  if (f === 'research') return 'research'
  if (f === 'compare') return 'compare'
  return undefined
}

export function compileMission(input: { text?: string; family?: string; artifact?: string }): CompileResult {
  const text = String(input.text ?? '').trim()
  const artifact = inferredArtifact(text, String(input.artifact ?? '').trim())
  const found = addrs(text)
  const target = found[0] ?? null
  const targetB = found[1] ?? null

  if (REFUSE.test(text) && !target && !artifact) {
    return {
      ok: false,
      needsProcurement: false,
      refuse:
        'Till runs private work (investigate / review / research / compare). It is not a chatbot. Name a target or paste an artifact.',
    }
  }

  let family = normalizeFamily(String(input.family ?? ''))
  if (!family) {
    if (/\bcompare\b/i.test(text) || found.length >= 2) family = 'compare'
    else if (/\b(review|solidity|abi|diff|bytecode|audit this)\b/i.test(text) || artifact.length > 40) family = 'review'
    else if (/\b(research|brief|explain|what is|diligence report)\b/i.test(text) && !/\b(deposit|buy|pay|safe)\b/i.test(text))
      family = 'research'
    else if (
      /\b(deposit|buy|pay|honeypot|before i|invest|putting \$|into this protocol|token|trust|vendor|grant|authorize|wallet|investigate)\b/i.test(
        text,
      ) ||
      target
    )
      family = 'investigate'
    else if (text) family = 'research'
  }

  if (!family) {
    return {
      ok: false,
      needsProcurement: false,
      ask: 'What do you need done? Investigate, review, research, or compare.',
      copilot: 'Quick risk check, full contract review, or a private research brief?',
    }
  }

  if (family === 'compare' && found.length < 2) {
    return {
      ok: false,
      family,
      familyLabel: label(family),
      needsProcurement: false,
      ask: 'Paste two 0x addresses (or two artifacts) to compare.',
      copilot: 'Compare needs two targets.',
    }
  }
  if (family === 'investigate' && !target) {
    return {
      ok: false,
      family,
      familyLabel: label(family),
      needsProcurement: false,
      ask: 'Paste the 0x address of the token, contract, wallet, or protocol.',
      copilot: 'Do you want a quick on-chain risk check or a full contract review?',
    }
  }
  if (family === 'review' && !artifact && !target) {
    return {
      ok: false,
      family,
      familyLabel: label(family),
      needsProcurement: false,
      ask: 'Paste Solidity, ABI, a diff, or a 0x contract to review. This is AI-assisted review — not a certified audit.',
    }
  }

  return {
    ok: true,
    family,
    familyLabel: label(family),
    goal: goal(family),
    target,
    targetB,
    artifact: artifact || null,
    needsProcurement: false,
    expectedOutput: output(family),
    proof: '0G Compute TEE attestation, encrypted Storage packet, vault PacketAnchored on Aristotle.',
    copilot: undefined,
  }
}

function label(f: MissionFamily) {
  return {
    investigate: 'Investigate',
    review: 'Review',
    research: 'Research',
    compare: 'Compare',
  }[f]
}

function goal(f: MissionFamily) {
  return {
    investigate: 'Private on-chain investigation from public facts plus 0G Compute.',
    review: 'AI-assisted review of the provided artifact — not a certified audit.',
    research: 'Produce a private structured brief.',
    compare: 'Compare two targets using public facts plus 0G Compute.',
  }[f]
}

function output(f: MissionFamily) {
  return {
    investigate: 'HOLD / AVOID / CAUTION from public RPC facts plus private Compute. Not a paid scanner.',
    review: 'Findings and questions. Not a certified audit.',
    research: 'Private research brief. Cite only provided facts.',
    compare: 'Differences, shared risks, what to verify next.',
  }[f]
}

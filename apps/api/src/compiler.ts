export type MissionFamily = 'pay' | 'trust' | 'research' | 'review'

export type CompileResult = {
  ok: boolean
  family?: MissionFamily
  familyLabel?: string
  refuse?: string
  ask?: string
  goal?: string
  target?: string | null
  artifact?: string | null
  needsProcurement: boolean
  expectedOutput?: string
  proof?: string
}

const ADDR = /0x[a-fA-F0-9]{40}/
const REFUSE =
  /\b(poem|poems|haiku|joke|meme|memes|chat with me|girlfriend|roleplay|nsfw)\b/i

export function compileMission(input: { text?: string; family?: string; artifact?: string }): CompileResult {
  const text = String(input.text ?? '').trim()
  const artifact = String(input.artifact ?? '').trim()
  const forced = String(input.family ?? '').toLowerCase()

  if (REFUSE.test(text) && !ADDR.test(text) && !artifact) {
    return {
      ok: false,
      needsProcurement: false,
      refuse:
        'Till runs private missions (pay / trust / research / review). It is not a chatbot. Name a target or paste an artifact.',
    }
  }

  const target = text.match(ADDR)?.[0] ?? null
  let family: MissionFamily | undefined
  if (forced === 'pay' || forced === 'trust' || forced === 'research' || forced === 'review') {
    family = forced
  } else if (/\b(review|solidity|abi|diff|bytecode|audit this)\b/i.test(text) || artifact.length > 40) {
    family = 'review'
  } else if (/\b(trust|vendor|grant|authorize|agent wallet|who is this)\b/i.test(text)) {
    family = 'trust'
  } else if (/\b(research|brief|explain|what is|diligence report)\b/i.test(text) && !/\b(deposit|buy|pay)\b/i.test(text)) {
    family = 'research'
  } else if (
    /\b(deposit|buy|pay|honeypot|before i|invest|putting \$|into this protocol|token)\b/i.test(text) ||
    target
  ) {
    family = 'pay'
  } else if (text) {
    family = 'research'
  }

  if (!family) {
    return { ok: false, needsProcurement: false, ask: 'What do you need done? Pick a mission family or describe a target.' }
  }

  if ((family === 'pay' || family === 'trust') && !target) {
    return {
      ok: false,
      family,
      familyLabel: label(family),
      needsProcurement: family === 'pay',
      ask: 'Paste the 0x address of the token, contract, wallet, or protocol.',
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

  const needsProcurement = family === 'pay' || (family === 'review' && !!target)
  return {
    ok: true,
    family,
    familyLabel: label(family),
    goal: goal(family),
    target,
    artifact: artifact || null,
    needsProcurement,
    expectedOutput: output(family),
    proof: '0G Compute attestation, optional USDC.e session payments on Aristotle, Storage packet + vault anchor.',
  }
}

function label(f: MissionFamily) {
  return {
    pay: 'Before You Pay',
    trust: 'Before You Trust',
    research: 'Research For Me',
    review: 'Review This',
  }[f]
}

function goal(f: MissionFamily) {
  return {
    pay: 'Decide whether to send funds or interact.',
    trust: 'Decide whether to grant authority to this address.',
    research: 'Produce a private structured brief.',
    review: 'AI-assisted review of the provided artifact — not a certified audit.',
  }[f]
}

function output(f: MissionFamily) {
  return {
    pay: 'BUY / HOLD / AVOID with cited paid facts.',
    trust: 'TRUST / CAUTION / DON’T GRANT from public on-chain facts plus Compute. Paid wallet-risk SKUs stay pending until settled.',
    research: 'Private research brief. Paid market SKUs only if SETTLED.',
    review: 'Findings and questions. Not a certified audit.',
  }[f]
}

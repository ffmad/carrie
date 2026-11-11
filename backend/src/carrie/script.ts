import type { ExtractedFact, TurnRequest, TurnResponse } from './types'

/**
 * Scripted fallback used when no ANTHROPIC_API_KEY is set (or Claude fails),
 * so the demo runs end to end. Replies advance with the number of things the
 * elder has said so far; a fact is only emitted when her actual words contain
 * the matching keywords, and the quote is always her literal text.
 */
interface Step {
  reply: string
  fact?: { match: RegExp; category: ExtractedFact['category']; statement: string }
  consent?: { audience: 'family' | 'doctor'; question: string }
}

const OPENING =
  "Hello Rose, it's Carrie. I'm an AI helper, not a person, calling for your check-in. How have you been feeling this week?"

const STEPS: Step[] = [
  {
    reply: "I'm sorry your knee is bothering you. May I share that with Dr. Chen?",
    fact: { match: /knee|stairs/i, category: 'health', statement: 'Knee hurts on the stairs since Sunday' },
    consent: { audience: 'doctor', question: 'May I share that with Dr. Chen?' },
  },
  {
    reply: "Of course. I'll tell Dr. Chen, and I won't tell Mia. And how have you been getting on with your pills?",
  },
  {
    reply: 'Thank you for telling me, that happens. May I tell Dr. Chen about the missed pill as well?',
    fact: { match: /pill|tablet|medic/i, category: 'medication', statement: 'Skipped her pill on Tuesday' },
    consent: { audience: 'doctor', question: 'May I tell Dr. Chen about the missed pill as well?' },
  },
  {
    reply: "I'll do just that. Now, is there anyone you have been missing lately?",
  },
  {
    reply: 'That is lovely to hear. May I tell your family that you miss Leo?',
    fact: { match: /leo|miss|grandson/i, category: 'social', statement: 'Misses Leo and would love to hear from him' },
    consent: { audience: 'family', question: 'May I tell your family that you miss Leo?' },
  },
  {
    reply: "I'll pass that on. Thank you for the chat, Rose. I'll call again on Thursday. Take care, goodbye!",
  },
]

const NOTHING_NOTED = 'I see, thank you for telling me. Tell me a little more?'
const CLOSING = "Thank you, Rose. I'll call again on Thursday. Take care!"

/** The lines the demo elder says, in order. Mirrored in frontend/src/lib/demoData.ts. */
export const SCRIPTED_ELDER_LINES = [
  "Oh, not too bad, but my knee's been hurting on the stairs since Sunday.",
  "Yes, tell the doctor, but don't tell my daughter. She worries so.",
  'Well, I skipped my pill on Tuesday. I just plain forgot.',
  'Yes, but only the doctor.',
  "I do miss Leo. I'd love to hear his voice.",
  'Yes, please do.',
]

export function scriptedTurn(req: TurnRequest): TurnResponse {
  const elderText = req.elderText.trim()
  const eldersSoFar = req.history.filter((h) => h.speaker === 'elder').length

  if (!elderText && eldersSoFar === 0) {
    const notes = req.pendingVoiceNotes ?? []
    const from = notes[0]?.from
    if (!from) return { reply: OPENING, facts: [] }
    return {
      reply: `Hello Rose, it's Carrie. I'm an AI helper, not a person. ${from} left you a voice message, so I'll play it now in their own voice, and then you can tell me how you have been.`,
      facts: [],
    }
  }

  const step = STEPS[eldersSoFar]
  if (!step) return { reply: CLOSING, facts: [] }

  const facts: ExtractedFact[] = []
  if (step.fact && step.fact.match.test(elderText)) {
    facts.push({ category: step.fact.category, statement: step.fact.statement, quote: elderText })
  }
  // Only ask to share something that was actually recorded this turn.
  if (step.fact && facts.length === 0) return { reply: NOTHING_NOTED, facts }
  const response: TurnResponse = { reply: step.reply, facts }
  if (step.consent) response.consentQuestion = { factIndex: 0, ...step.consent }
  return response
}

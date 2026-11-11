import { z } from 'zod'

export const FACT_CATEGORIES = ['health', 'medication', 'mood', 'daily', 'social', 'request'] as const
export const AUDIENCES = ['family', 'doctor'] as const

/** Request body of POST /api/carrie/turn. An empty `elderText` with empty `history` asks for Carrie's opening line. */
export const TurnRequestSchema = z.object({
  history: z
    .array(z.object({ speaker: z.enum(['elder', 'carrie', 'family']), text: z.string() }))
    .default([]),
  elderText: z.string().default(''),
  pendingVoiceNotes: z.array(z.object({ from: z.string(), transcript: z.string() })).optional(),
})
export type TurnRequest = z.infer<typeof TurnRequestSchema>

export interface ExtractedFact {
  category: (typeof FACT_CATEGORIES)[number]
  statement: string
  /** Exact words the elder said. This is what the audio receipt plays back. */
  quote: string
}

export interface ConsentQuestion {
  /** Index into `facts` of this same response. */
  factIndex: number
  audience: (typeof AUDIENCES)[number]
  question: string
}

export interface TurnResponse {
  reply: string
  facts: ExtractedFact[]
  consentQuestion?: ConsentQuestion
}

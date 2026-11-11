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

/** Request body of POST /api/carrie/facts: same as a turn. Facts come only from `elderText`. */
export const FactsRequestSchema = TurnRequestSchema.extend({
  /** Which call these words came from; saved as the fact's source in Carrie's memory. */
  callId: z.string().max(200).optional(),
})
export type FactsRequest = z.infer<typeof FactsRequestSchema>
/** Response of POST /api/carrie/facts: a TurnResponse without `reply` (GPT-Live does the talking). */
export type FactsResponse = Omit<TurnResponse, 'reply'>

/** Request body of POST /api/live/session. The browser's WebRTC offer plus what Carrie should know. */
export const LiveSessionRequestSchema = z.object({
  sdp: z.string().min(1).max(65536),
  pendingVoiceNotes: z.array(z.object({ from: z.string(), transcript: z.string() })).optional(),
  /** Facts Rose shared on earlier calls, as short statements, so Carrie can follow up ("How's the knee?"). */
  earlierFacts: z.array(z.string()).max(50).optional(),
})
export type LiveSessionRequest = z.infer<typeof LiveSessionRequestSchema>
export interface LiveSessionResponse {
  sessionId: string
  /** The WebRTC answer. Apply it with setRemoteDescription({ type: 'answer', sdp }). */
  sdp: string
}

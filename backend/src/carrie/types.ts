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
  /**
   * How this fact is shared under the circle's agreed framework (set by the OpenAI facts path):
   * - 'everyday': ordinary, non-worrying life (cooked, saw a friend, feeling better). Shared with family
   *   automatically, as everyone agreed up front. Not sent to the doctor unless it is about health.
   * - 'ask': health that is new, worse or negative, medicine problems, falls. Carrie asks Rose, one person at a time.
   * - 'private': Rose said to keep it to herself ("don't tell anyone", "between us"). Shared with nobody.
   */
  sharing?: 'everyday' | 'ask' | 'private'
}

export interface ConsentQuestion {
  /** Index into `facts` of this same response. */
  factIndex: number
  audience: (typeof AUDIENCES)[number]
  question: string
  /** The one person this question is about: "Mia", "Leo" or "Dr. Chen". Set by the OpenAI facts path. */
  person?: string
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
export type FactsResponse = Omit<TurnResponse, 'reply'> & {
  /** Set when Rose describes something urgent (a fall, chest pain, can't breathe, fainted, self-harm). */
  urgent?: { reason: string; quote: string }
}

/** Request body of POST /api/live/session. The browser's WebRTC offer plus what Carrie should know. */
export const LiveSessionRequestSchema = z.object({
  sdp: z.string().min(1).max(65536),
  pendingVoiceNotes: z.array(z.object({ from: z.string(), transcript: z.string() })).optional(),
  /** Facts Rose shared on earlier calls, as short statements, so Carrie can follow up ("How's the knee?"). */
  earlierFacts: z.array(z.string()).max(50).optional(),
  /** Who Carrie talks to. 'family': a family member asks about Rose by voice. */
  audience: z.enum(['elder', 'family']).default('elder'),
  /** For 'family': who is calling (e.g. "Mia"). */
  familyMember: z.string().max(60).optional(),
  /** For 'family': ONLY the facts Rose agreed to share with family. Carrie's own memory is never used here. */
  sharedFacts: z.array(z.string()).max(100).optional(),
})
export type LiveSessionRequest = z.infer<typeof LiveSessionRequestSchema>
export interface LiveSessionResponse {
  sessionId: string
  /** The WebRTC answer. Apply it with setRemoteDescription({ type: 'answer', sdp }). */
  sdp: string
}

/** Request body of POST /api/carrie/family-update. `sharedFacts` must be ONLY what Rose shared with family. */
export const FamilyUpdateRequestSchema = z.object({
  member: z.object({ name: z.string(), relation: z.string().optional(), lastSpokeWithElder: z.string().optional() }),
  sharedFacts: z
    .array(z.object({ id: z.string(), statement: z.string(), quote: z.string(), category: z.string(), createdAt: z.string() }))
    .max(200),
  /** Defaults to now. Lets the demo pretend it is a given day. */
  now: z.string().optional(),
})
export type FamilyUpdateRequest = z.infer<typeof FamilyUpdateRequestSchema>
export interface FamilyUpdateResponse {
  /** Heads-ups on change ("dizzy 2 days running", "new: a fall"). Each points at a shared fact. */
  alerts: { factId: string; text: string }[]
  /** A reason to call Rose now, and things to talk about, each from her own shared words. */
  nudge: { reason: string; daysSinceLastCall: number | null; talkAbout: { factId: string; text: string }[] } | null
}

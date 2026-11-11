/**
 * Domain types. They mirror the Supabase tables (people, calls, utterances,
 * facts, voice_notes) in camelCase; lib/supabase.ts maps rows to and from them.
 */
export type Role = 'elder' | 'family' | 'doctor'
export type Speaker = 'elder' | 'carrie' | 'family'
export type FactCategory = 'health' | 'medication' | 'mood' | 'daily' | 'social' | 'request'
export type Consent = 'pending' | 'granted' | 'declined'
export type Audience = 'family' | 'doctor'

export interface Person {
  id: string
  role: Role
  name: string
  relation: string
  /** Any CSS color, usually a token reference such as `var(--color-person-rose)`. */
  avatarColor: string
  createdAt: string
}

export interface Call {
  id: string
  elderId: string
  startedAt: string
  endedAt: string | null
  summary: string | null
}

export interface Utterance {
  id: string
  callId: string
  speaker: Speaker
  speakerId: string | null
  text: string
  /** Path in the `clips` bucket, or a local blob: URL for clips recorded this session. */
  audioPath: string | null
  position: number
  createdAt: string
}

export interface Fact {
  id: string
  callId: string
  elderId: string
  /** The receipt: the utterance in which the elder said this. */
  utteranceId: string | null
  category: FactCategory
  statement: string
  quote: string
  shareFamily: boolean
  shareDoctor: boolean
  consent: Consent
  createdAt: string
}

export interface VoiceNote {
  id: string
  fromId: string
  toId: string
  audioPath: string
  transcript: string | null
  replyToFactId: string | null
  deliveredCallId: string | null
  deliveredAt: string | null
  createdAt: string
}

/** Who a fact is shared with. Family and doctor are independent. */
export interface ShareDecision {
  family?: boolean
  doctor?: boolean
}

/* Backend contract: POST /api/carrie/turn */
export interface CarrieTurnRequest {
  history: { speaker: Speaker; text: string }[]
  elderText: string
  pendingVoiceNotes?: { from: string; transcript: string }[]
}

export interface CarrieTurnResponse {
  reply: string
  facts: { category: FactCategory; statement: string; quote: string }[]
  /** `factIndex` points into `facts` of the same response. */
  consentQuestion?: { factIndex: number; audience: Audience; question: string }
}

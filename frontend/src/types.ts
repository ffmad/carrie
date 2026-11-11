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
  /** Ids of the people who may see it. Sharing is per person: telling Mia does not tell Leo. */
  sharedWith: string[]
  /** Who said "I'll do it" (for things she needs someone to do). */
  claimedBy: string | null
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
  /** The elder's spoken answer to a family note points at that note. */
  inReplyTo: string | null
  deliveredCallId: string | null
  deliveredAt: string | null
  createdAt: string
}

export type RequestKind = 'ask' | 'tell' | 'checkin'

/** Something the family or the doctor gives Carrie for the next call, or a "check in now". */
export interface CareRequest {
  id: string
  elderId: string
  fromId: string
  kind: RequestKind
  text: string
  status: 'pending' | 'done'
  handledCallId: string | null
  createdAt: string
}

export interface CareSettings {
  elderId: string
  /** When Carrie rings, "10:00". */
  callTime: string
  /** What Carrie gently checks on in every call. */
  checks: string[]
  mainContactId: string | null
  doctorId: string | null
  nextAppointment: string | null
}

/** The elder's spoken answer, per audience. The call store turns it into the people it names. */
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
  /**
   * `sharing` (from the OpenAI facts path) follows the circle's agreed framework: 'everyday' goes to the
   * family without asking, 'ask' waits for Rose's yes, 'private' stays between Rose and Carrie.
   */
  facts: { category: FactCategory; statement: string; quote: string; sharing?: 'everyday' | 'ask' | 'private' }[]
  /** `factIndex` points into `facts` of the same response. */
  consentQuestion?: { factIndex: number; audience: Audience; question: string; person?: string }
  /** Set by the facts step when she describes something urgent (a fall, chest pain, cannot breathe). */
  urgent?: { reason: string; quote: string }
}

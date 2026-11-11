import type { Call, CareRequest, CareSettings, Fact, Person, Utterance, VoiceNote } from '../types'

/**
 * Bundled seed so every screen renders without Supabase: the cast, a week of
 * short calls (the latest one with a full transcript), 7 facts and 1 voice note.
 * Dates are relative to "now" so the week always looks current.
 */
const daysAgo = (days: number, hour = 10, minute = 0): string => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

export const DEMO_IDS = {
  rose: '00000000-0000-4000-8000-000000000001',
  mia: '00000000-0000-4000-8000-000000000002',
  leo: '00000000-0000-4000-8000-000000000003',
  chen: '00000000-0000-4000-8000-000000000004',
} as const

const CALL_EARLY = '00000000-0000-4000-8000-0000000000c1'
const CALL_MID = '00000000-0000-4000-8000-0000000000c2'
const CALL_LATEST = '00000000-0000-4000-8000-0000000000c3'

export const demoPeople: Person[] = [
  { id: DEMO_IDS.rose, role: 'elder', name: 'Rose', relation: 'Grandma, 78', avatarColor: 'var(--color-person-rose)', createdAt: daysAgo(30) },
  { id: DEMO_IDS.mia, role: 'family', name: 'Mia', relation: 'Daughter', avatarColor: 'var(--color-person-mia)', createdAt: daysAgo(30) },
  { id: DEMO_IDS.leo, role: 'family', name: 'Leo', relation: 'Grandson', avatarColor: 'var(--color-person-leo)', createdAt: daysAgo(30) },
  { id: DEMO_IDS.chen, role: 'doctor', name: 'Dr. Chen', relation: 'Family doctor', avatarColor: 'var(--color-person-chen)', createdAt: daysAgo(30) },
]

export const demoCalls: Call[] = [
  { id: CALL_EARLY, elderId: DEMO_IDS.rose, startedAt: daysAgo(6), endedAt: daysAgo(6, 10, 6), summary: null },
  { id: CALL_MID, elderId: DEMO_IDS.rose, startedAt: daysAgo(4), endedAt: daysAgo(4, 10, 8), summary: null },
  { id: CALL_LATEST, elderId: DEMO_IDS.rose, startedAt: daysAgo(1), endedAt: daysAgo(1, 10, 7), summary: null },
]

interface SeedFact {
  key: string
  callId: string
  day: number
  category: Fact['category']
  statement: string
  quote: string
  /** Who Rose said yes to. Empty with 'declined' means she kept it to herself. */
  sharedWith: string[]
  consent: Fact['consent']
}

const seedFacts: SeedFact[] = [
  { key: 'a1', callId: CALL_EARLY, day: 6, category: 'daily', statement: 'Sleeping poorly, waking around 4am', quote: "I keep waking up at four and I can't get back to sleep.", sharedWith: [DEMO_IDS.mia, DEMO_IDS.chen], consent: 'granted' },
  { key: 'a2', callId: CALL_MID, day: 4, category: 'mood', statement: 'Felt cheerful after the garden club', quote: 'The garden club was lovely, I laughed all afternoon.', sharedWith: [DEMO_IDS.mia, DEMO_IDS.leo], consent: 'granted' },
  { key: 'a3', callId: CALL_MID, day: 4, category: 'request', statement: 'Would like Mia to bring the photo albums on Sunday', quote: 'Could Mia bring the old photo albums when she comes on Sunday?', sharedWith: [DEMO_IDS.mia], consent: 'granted' },
  { key: 'a4', callId: CALL_MID, day: 4, category: 'mood', statement: 'Feels lonely in the evenings', quote: 'The evenings are the hard part. It gets very quiet.', sharedWith: [], consent: 'declined' },
  { key: 'a5', callId: CALL_LATEST, day: 1, category: 'health', statement: 'Knee hurts on the stairs since Sunday', quote: "My knee's been hurting on the stairs since Sunday.", sharedWith: [DEMO_IDS.chen], consent: 'granted' },
  { key: 'a6', callId: CALL_LATEST, day: 1, category: 'medication', statement: 'Skipped her pill on Tuesday', quote: 'I skipped my pill on Tuesday. I just plain forgot.', sharedWith: [DEMO_IDS.chen], consent: 'granted' },
  { key: 'a7', callId: CALL_LATEST, day: 1, category: 'social', statement: 'Misses Leo and would love to hear from him', quote: "I do miss Leo. I'd love to hear his voice.", sharedWith: [DEMO_IDS.mia, DEMO_IDS.leo], consent: 'granted' },
]

const factId = (key: string) => `00000000-0000-4000-8000-0000000000${key}`
const utteranceId = (key: string) => `00000000-0000-4000-8000-0000000001${key}`

/** One elder utterance per fact: the receipt. The demo seed ships without audio clips. */
export const demoUtterances: Utterance[] = [
  {
    id: '00000000-0000-4000-8000-000000000100',
    callId: CALL_LATEST,
    speaker: 'carrie',
    speakerId: null,
    text: "Hello Rose, it's Carrie. I'm an AI helper, not a person, calling for your check-in. How have you been feeling this week?",
    audioPath: null,
    position: 0,
    createdAt: daysAgo(1, 10, 0),
  },
  ...seedFacts.map((seed, index): Utterance => ({
    id: utteranceId(seed.key),
    callId: seed.callId,
    speaker: 'elder',
    speakerId: DEMO_IDS.rose,
    text: seed.quote,
    audioPath: null,
    position: index + 1,
    createdAt: daysAgo(seed.day, 10, index + 1),
  })),
]

export const demoFacts: Fact[] = seedFacts.map((seed, index) => ({
  id: factId(seed.key),
  callId: seed.callId,
  elderId: DEMO_IDS.rose,
  utteranceId: utteranceId(seed.key),
  category: seed.category,
  statement: seed.statement,
  quote: seed.quote,
  sharedWith: seed.sharedWith,
  claimedBy: null,
  consent: seed.consent,
  createdAt: daysAgo(seed.day, 10, index + 1),
}))

export const demoVoiceNotes: VoiceNote[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    fromId: DEMO_IDS.leo,
    toId: DEMO_IDS.rose,
    audioPath: '',
    transcript: "Hi Grandma, it's Leo! I aced my chemistry test. I'll call you on Sunday. Love you!",
    replyToFactId: factId('a7'),
    inReplyTo: null,
    deliveredCallId: null,
    deliveredAt: null,
    createdAt: daysAgo(0, 8, 30),
  },
]

export const demoSettings: CareSettings = {
  elderId: DEMO_IDS.rose,
  callTime: '10:00',
  checks: ['Blood pressure pill', 'Sleep', 'Her knee'],
  mainContactId: DEMO_IDS.mia,
  doctorId: DEMO_IDS.chen,
  nextAppointment: daysAgo(-2, 10, 0),
}

export const demoRequests: CareRequest[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    elderId: DEMO_IDS.rose,
    fromId: DEMO_IDS.chen,
    kind: 'ask',
    text: 'Does the dizziness come on after the morning pill?',
    status: 'pending',
    handledCallId: null,
    createdAt: daysAgo(0, 8, 0),
  },
]

/** What Rose says in the scripted demo call (mirrors backend/src/carrie/script.ts). */
export const demoElderLines: string[] = [
  "Oh, not too bad, but my knee's been hurting on the stairs since Sunday.",
  "Yes, tell the doctor, but don't tell my daughter. She worries so.",
  'Well, I skipped my pill on Tuesday. I just plain forgot.',
  'Yes, but only the doctor.',
  "I do miss Leo. I'd love to hear his voice.",
  'Yes, please do.',
]

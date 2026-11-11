import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { carrieFacts, carrieTurn, getHealth } from '../lib/api'
import { LiveCall } from '../lib/live'
import { playAudio, type Recording } from '../lib/recorder'
import { speak, stopSpeaking } from '../lib/speech'
import { clipUrl, fromCall, fromUtterance, saveRow, uploadClip } from '../lib/supabase'
import type { Audience, Call, CarrieTurnResponse, ShareDecision, Speaker, Utterance, VoiceNote } from '../types'
import { useCallsStore } from './calls'
import { useCircleStore } from './circle'
import { useFactsStore } from './facts'
import { useRequestsStore } from './requests'
import { useSettingsStore } from './settings'
import { useVoiceNotesStore } from './voiceNotes'

/**
 * Live call state machine:
 *   idle -> ringing -> talking <-> consent -> ended
 * `talking` and `consent` alternate: Carrie asks "can I share this?", the elder
 * answers (by voice or by tapping), and the call goes back to talking.
 */
export type CallPhase = 'idle' | 'ringing' | 'talking' | 'consent' | 'ended'
export type CarrieState = 'idle' | 'listening' | 'speaking'

export interface PendingConsent {
  question: string
  audience: Audience
  /** The fact Carrie asked about. The answer applies to this fact only; unasked facts stay private. */
  factId: string | null
  /** The people a yes would tell. Sharing is per person: "Can I tell Mia?" does not tell Leo. */
  personIds: string[]
}

export const useCallStore = defineStore('call', () => {
  const circle = useCircleStore()
  const factsStore = useFactsStore()
  const voiceNotes = useVoiceNotesStore()
  const requests = useRequestsStore()
  const settings = useSettingsStore()

  const phase = ref<CallPhase>('idle')
  const carrie = ref<CarrieState>('idle')
  const call = ref<Call | null>(null)
  const utterances = ref<Utterance[]>([])
  /** What the elder is saying right now, before it becomes an utterance. */
  const interim = ref('')
  const thinking = ref(false)
  const error = ref<string | null>(null)
  const pendingConsent = ref<PendingConsent | null>(null)
  /** True when Carrie runs on GPT-Live 1 (backend has an OpenAI key): she listens and speaks herself. */
  const liveMode = ref(false)
  let live: LiveCall | null = null
  /** The family recording that is playing to the elder right now. */
  const playingNote = ref<VoiceNote | null>(null)
  /** A family recording has just been played: if the elder answers its sender, her words go back to them. */
  let answerableNote: VoiceNote | null = null
  /** Typed questions from the family or the doctor that Carrie still has to ask in this call (turn path). */
  let toAsk: string[] = []

  const inCall = computed(() => phase.value === 'talking' || phase.value === 'consent')
  const callFacts = computed(() => (call.value ? factsStore.forCall(call.value.id) : []))
  const elderTurns = computed(() => utterances.value.filter((u) => u.speaker === 'elder').length)

  function ring() {
    stopSpeaking()
    phase.value = 'ringing'
    carrie.value = 'idle'
    call.value = null
    utterances.value = []
    interim.value = ''
    error.value = null
    pendingConsent.value = null
    playingNote.value = null
    answerableNote = null
    toAsk = []
  }

  /** The elder taps Carrie to talk: the same call, without the ringing. */
  async function start() {
    if (inCall.value) return
    ring()
    await answer()
  }

  /** Back to resting, after the summary or a declined call. */
  function reset() {
    if (inCall.value) hangUp()
    phase.value = 'idle'
    call.value = null
    utterances.value = []
    liveMode.value = false
  }

  /** The elder picks up: Carrie introduces herself (as an AI) and plays any waiting voice notes. */
  async function answer() {
    if (phase.value !== 'ringing') return
    const health = await getHealth().catch(() => null)
    if (health?.live && (await canTalkLive())) return answerLive()
    const elder = circle.elder
    call.value = { id: crypto.randomUUID(), elderId: elder.id, startedAt: new Date().toISOString(), endedAt: null, summary: null }
    phase.value = 'talking'
    void saveRow('calls', fromCall(call.value))

    const waiting = voiceNotes.pendingFor(elder.id)
    const carried = takeRequests(call.value.id)
    const response = await askCarrie('', waiting.map((n) => ({ from: circle.byId(n.fromId)?.name ?? 'Your family', transcript: n.transcript ?? '' })))
    if (!response) return
    await say(response.reply)

    for (const note of waiting) {
      if (!inCall.value) return
      const url = clipUrl(note.audioPath)
      addUtterance('family', note.transcript ?? 'Voice note', note.audioPath || null, note.fromId)
      carrie.value = 'idle'
      playingNote.value = note
      if (url) await playAudio(url)
      playingNote.value = null
      answerableNote = note
      void voiceNotes.markDelivered(note.id, call.value.id)
    }
    // Typed messages have no recording, so Carrie says them herself and names who they are from.
    // Things to tell come now; questions wait until Rose has had her say (see askNext).
    for (const q of carried.filter((c) => c.kind === 'tell')) {
      if (!inCall.value) return
      await say(`${q.from} asked me to tell you: ${q.text}`)
    }
    toAsk = carried.filter((c) => c.kind === 'ask').map((q) => `${q.from} asked me to check something with you. ${q.text}`)
    if (inCall.value) carrie.value = 'listening'
  }

  /** The elder said something (final transcript + optional recording of her saying it). */
  async function hearElder(text: string, recording?: Recording | null, options: { consentHandled?: boolean } = {}) {
    const said = text.trim()
    if (!said || !call.value || !inCall.value || thinking.value) return
    interim.value = ''

    const utteranceId = crypto.randomUUID()
    const audioPath = recording
      ? await uploadClip(`calls/${call.value.id}/${utteranceId}.${recording.extension}`, recording.blob)
      : null
    const history = historyForCarrie()
    const utterance = addUtterance('elder', said, audioPath, circle.elder.id, utteranceId)
    factsStore.addReceipt(utterance)
    carryAnswerBack(said, audioPath)
    if (URGENT.test(said)) await raiseAlarm(said, utteranceId)

    if (phase.value === 'consent' && pendingConsent.value && !options.consentHandled) {
      await applyConsent(interpretConsent(said, pendingConsent.value.audience))
    }
    pendingConsent.value = null
    phase.value = 'talking'

    const response = await askCarrie(said, [], history)
    if (!response) return

    const createdIds: string[] = []
    for (const extracted of response.facts) {
      const id = crypto.randomUUID()
      createdIds.push(id)
      await factsStore.add({
        id,
        callId: call.value.id,
        elderId: circle.elder.id,
        utteranceId,
        category: extracted.category,
        statement: extracted.statement,
        quote: extracted.quote,
        sharedWith: [],
        claimedBy: null,
        consent: 'pending',
        createdAt: new Date().toISOString(),
      })
    }

    if (response.consentQuestion) {
      pendingConsent.value = {
        question: response.consentQuestion.question,
        audience: response.consentQuestion.audience,
        factId: createdIds[response.consentQuestion.factIndex] ?? null,
        personIds: peopleAskedAbout(response.consentQuestion.audience, response.consentQuestion.question, response.consentQuestion.person),
      }
      phase.value = 'consent'
    }
    await say(response.reply)
    if (!response.consentQuestion) await askNext()
  }

  /** One carried question at a time, and never on top of a sharing question. */
  async function askNext() {
    if (!inCall.value || phase.value !== 'talking' || !toAsk.length) return
    await say(toAsk.shift()!)
  }

  /**
   * A live call needs a microphone. On a machine without one, or with `?typed` in the address,
   * the call stays turn by turn so it can still be driven by tapping and typing.
   */
  async function canTalkLive(): Promise<boolean> {
    if (new URLSearchParams(window.location.search).has('typed')) return false
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some((device) => device.kind === 'audioinput')
    } catch {
      return false
    }
  }

  /* GPT-Live 1: Carrie talks on her own; the app keeps receipts, facts and consent beside the call. */

  async function answerLive() {
    const elder = circle.elder
    call.value = { id: crypto.randomUUID(), elderId: elder.id, startedAt: new Date().toISOString(), endedAt: null, summary: null }
    phase.value = 'talking'
    liveMode.value = true
    carrie.value = 'idle'
    void saveRow('calls', fromCall(call.value))

    const waiting = voiceNotes.pendingFor(elder.id)
    let notesPlayed = waiting.length === 0
    const session = (live = new LiveCall({
      onStarted: () => {
        carrie.value = 'listening'
        const carried = call.value ? takeRequests(call.value.id) : []
        if (carried.length) {
          live?.instruct(
            `Rose's family and doctor gave you these to bring up during this call, one at a time, when it fits. Say who each is from. ${carried
              .map((q, i) => `${i + 1}) ${q.from} ${q.kind === 'ask' ? 'asks' : 'wants her to know'}: "${q.text}"`)
              .join(' ')}`,
          )
        }
      },
      onElderPartial: (text) => (interim.value = text),
      onElderTurn: (text, clip) => void hearElderLive(text, clip),
      onCarrieSpeaking: (speaking) => {
        if (inCall.value) carrie.value = speaking ? 'speaking' : 'listening'
      },
      onCarrieTurn: (text) => {
        if (!call.value) return
        addUtterance('carrie', text, null, null)
        if (!notesPlayed) {
          notesPlayed = true // Carrie's opening line announces the notes; play the real recordings now.
          void playVoiceNotes(waiting)
        }
      },
      onError: (message) => (error.value = message),
    }))
    try {
      await session.start({ pendingVoiceNotes: waiting.map((n) => ({ from: circle.byId(n.fromId)?.name ?? 'Your family', transcript: n.transcript ?? '' })) })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not start the call'
      hangUp()
    }
  }

  async function playVoiceNotes(notes: ReturnType<typeof voiceNotes.pendingFor>) {
    for (const note of notes) {
      if (!inCall.value || !call.value) return
      const url = clipUrl(note.audioPath)
      addUtterance('family', note.transcript ?? 'Voice note', note.audioPath || null, note.fromId)
      playingNote.value = note
      if (url) await playAudio(url)
      playingNote.value = null
      answerableNote = note
      void voiceNotes.markDelivered(note.id, call.value.id)
    }
    const names = notes.map((n) => circle.byId(n.fromId)?.name ?? 'the family').join(' and ')
    live?.instruct(`The voice note from ${names} has just finished playing. Gently ask Rose what she thought of it, and whether she would like you to tell them anything back.`)
  }

  async function hearElderLive(text: string, clip: Recording | null) {
    if (!call.value || !inCall.value) return
    interim.value = ''
    const callId = call.value.id
    const utteranceId = crypto.randomUUID()
    const audioPath = clip ? await uploadClip(`calls/${callId}/${utteranceId}.${clip.extension}`, clip.blob) : null
    const history = historyForCarrie()
    const utterance = addUtterance('elder', text, audioPath, circle.elder.id, utteranceId)
    factsStore.addReceipt(utterance)
    carryAnswerBack(text, audioPath)
    if (URGENT.test(text)) void raiseAlarm(text, utteranceId)

    if (phase.value === 'consent' && pendingConsent.value) {
      await applyConsent(interpretConsent(text, pendingConsent.value.audience))
      pendingConsent.value = null
      phase.value = 'talking'
    }

    let response: Awaited<ReturnType<typeof carrieFacts>>
    try {
      response = await carrieFacts({ history, elderText: text, callId } as Parameters<typeof carrieFacts>[0])
    } catch (cause) {
      console.warn('[call] facts failed', cause)
      return
    }
    if (!call.value || call.value.id !== callId) return
    // The facts step also judges urgency; the word match above is the fast path.
    if (response.urgent && !URGENT.test(text)) void raiseAlarm(text, utteranceId)
    const createdIds: string[] = []
    for (const extracted of response.facts) {
      const id = crypto.randomUUID()
      createdIds.push(id)
      await factsStore.add({
        id, callId, elderId: circle.elder.id, utteranceId,
        category: extracted.category, statement: extracted.statement, quote: extracted.quote,
        sharedWith: [], claimedBy: null, consent: 'pending', createdAt: new Date().toISOString(),
      })
    }
    if (response.consentQuestion && !pendingConsent.value) {
      const q = response.consentQuestion
      pendingConsent.value = { question: q.question, audience: q.audience, factId: createdIds[q.factIndex] ?? null, personIds: peopleAskedAbout(q.audience, q.question, q.person) }
      phase.value = 'consent'
      live?.instruct(`As soon as Rose finishes her current thought, ask her this sharing question in your own warm words: "${q.question}" Ask only about this one thing and this one audience.`)
    }
  }

  /** The elder answered the sharing question by tapping instead of speaking. */
  async function answerConsent(decision: ShareDecision) {
    if (phase.value !== 'consent') return
    if (liveMode.value) {
      await applyConsent(decision)
      const said = describeDecision(decision)
      if (call.value) addUtterance('elder', said, null, circle.elder.id)
      pendingConsent.value = null
      phase.value = 'talking'
      live?.instruct(`Rose answered your sharing question by tapping: "${said}" Acknowledge it in a few words, say who you will and will not tell, and move on.`)
      return
    }
    await applyConsent(decision)
    await hearElder(describeDecision(decision), null, { consentHandled: true })
  }

  function hangUp() {
    stopSpeaking()
    if (live) {
      void live.close()
      live = null
    }
    if (call.value && !call.value.endedAt) {
      call.value.endedAt = new Date().toISOString()
      void saveRow('calls', fromCall(call.value)).then(() => useCallsStore().load())
    }
    playingNote.value = null
    answerableNote = null
    phase.value = call.value ? 'ended' : 'idle'
    carrie.value = 'idle'
    interim.value = ''
    pendingConsent.value = null
  }

  /* Internals */

  function historyForCarrie() {
    return utterances.value.map((u) => ({ speaker: u.speaker, text: u.text }))
  }

  function addUtterance(speaker: Speaker, text: string, audioPath: string | null, speakerId: string | null, id: string = crypto.randomUUID()): Utterance {
    const utterance: Utterance = {
      id,
      callId: call.value!.id,
      speaker,
      speakerId,
      text,
      audioPath,
      position: utterances.value.length,
      createdAt: new Date().toISOString(),
    }
    utterances.value = [...utterances.value, utterance]
    void saveRow('utterances', fromUtterance(utterance))
    return utterance
  }

  async function askCarrie(
    elderText: string,
    pendingVoiceNotes: { from: string; transcript: string }[] = [],
    history = historyForCarrie(),
  ): Promise<CarrieTurnResponse | null> {
    thinking.value = true
    error.value = null
    try {
      return await carrieTurn({ history, elderText, pendingVoiceNotes })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Carrie could not answer'
      carrie.value = 'idle'
      return null
    } finally {
      thinking.value = false
    }
  }

  async function say(text: string) {
    if (!call.value) return
    addUtterance('carrie', text, null, null)
    carrie.value = 'speaking'
    await speak(text)
    if (inCall.value) carrie.value = 'listening'
  }

  /** The answer covers the one fact Carrie asked about. Anything she did not ask about stays private. */
  async function applyConsent(decision: ShareDecision) {
    const pending = pendingConsent.value
    if (!pending?.factId) return
    const allow: string[] = []
    const deny: string[] = []
    if (decision.family !== undefined) {
      // A yes tells only the people Carrie named; a no keeps it from the whole family.
      if (decision.family) allow.push(...(pending.audience === 'family' ? pending.personIds : peopleAskedAbout('family', '')))
      else deny.push(...circle.family.map((p) => p.id))
    }
    if (decision.doctor !== undefined && circle.doctor) (decision.doctor ? allow : deny).push(circle.doctor.id)
    await factsStore.setSharing(pending.factId, { allow, deny })
  }

  /**
   * The one stated exception to consent: when she says something that sounds dangerous,
   * the main contact is told at once, and Carrie tells her so in the same breath.
   */
  async function raiseAlarm(text: string, utteranceId: string) {
    const main = settings.mainContact
    if (!main || !call.value) return
    await factsStore.add({
      id: crypto.randomUUID(),
      callId: call.value.id,
      elderId: circle.elder.id,
      utteranceId,
      category: 'health',
      statement: 'Urgent: she said something that may need help now',
      quote: text,
      sharedWith: [main.id],
      claimedBy: null,
      consent: 'granted',
      createdAt: new Date().toISOString(),
    })
    if (live) {
      live.instruct(`Rose just said something that may be an emergency: "${text}" Tell her calmly, in your own words, that you are letting ${main.name} know right now, and that she should call the emergency number if she feels unsafe. Then stay with her.`)
    } else {
      await say(`Rose, that worries me. I am letting ${main.name} know right now. If you feel unsafe, please call the emergency number.`)
    }
  }

  /** Who a yes would tell: the doctor, or the family members named in the question (the main contact if none is). */
  function peopleAskedAbout(audience: Audience, question: string, person?: string): string[] {
    // The backend names the one person when it can; otherwise read the name out of the question.
    const namedByBackend = person ? circle.people.find((p) => p.role !== 'elder' && p.name.toLowerCase() === person.toLowerCase()) : null
    if (namedByBackend) return [namedByBackend.id]
    if (audience === 'doctor') return circle.doctor ? [circle.doctor.id] : []
    const named = circle.family.filter((p) => new RegExp(`\\b${p.name}\\b`, 'i').test(question))
    if (named.length) return named.map((p) => p.id)
    const main = settings.mainContact
    return main ? [main.id] : []
  }

  /** The pending "ask her" and "tell her" requests, handed to Carrie for this call and marked as carried. */
  function takeRequests(callId: string): { from: string; kind: 'ask' | 'tell'; text: string }[] {
    const carried = requests.pending().filter((q) => q.kind !== 'checkin' && q.text)
    carried.forEach((q) => void requests.markDone(q.id, callId))
    return carried.map((q) => ({ from: circle.byId(q.fromId)?.name ?? 'Your family', kind: q.kind as 'ask' | 'tell', text: q.text }))
  }

  /**
   * After a family recording, the elder's words go back to its sender only when she addresses them
   * ("Tell Leo…", "Leo, …"). Anything else she says stays in the call until she agrees to share it.
   */
  function carryAnswerBack(text: string, audioPath: string | null) {
    const note = answerableNote
    if (!note || !call.value) return
    const sender = circle.byId(note.fromId)
    if (!sender) return
    const addressed = new RegExp(`\\btell (him|her|them|${sender.name})\\b|^(oh,?\\s+)?${sender.name}\\b`, 'i').test(text.trim())
    if (!addressed) return
    answerableNote = null
    void voiceNotes.addReply({ fromId: circle.elder.id, toId: sender.id, audioPath, transcript: text.trim(), inReplyTo: note.id, callId: call.value.id })
  }

  return { phase, carrie, call, utterances, interim, thinking, error, pendingConsent, liveMode, playingNote, inCall, callFacts, elderTurns, ring, answer, start, reset, hearElder, answerConsent, hangUp }
})

/** Narrow on purpose: her own fall, chest pain, not breathing, passing out. A word match, not a judgement. */
const URGENT = /\b(i|i've|i have|i just)\s+(fell|fallen|had a fall)\b|\bchest (pain|hurts)\b|\bcan(?:'|no)t breathe\b|\b(passed out|fainted|blacked out)\b/i

const FAMILY_WORDS = /\b(daughter|family|mia|leo|grandson|son|kids|children)\b/
const DOCTOR_WORDS = /\b(doctor|dr|chen|physician|gp)\b/
const NEGATION = /\b(no|not|don't|dont|do not|never|nobody|rather not|private|between us)\b/

/**
 * Stub: reads a spoken answer such as "tell the doctor, but not my daughter".
 * Each clause sets the audiences it names; a bare yes/no answers the audience asked about.
 * Good enough for the demo; the backend should own this once it returns a consent decision.
 */
export function interpretConsent(text: string, asked: Audience): ShareDecision {
  const decision: ShareDecision = {}
  let general: boolean | null = null
  for (const clause of text.toLowerCase().split(/,|;|\.|\bbut\b|\band\b/)) {
    if (!clause.trim()) continue
    const allow = !NEGATION.test(clause)
    const family = FAMILY_WORDS.test(clause)
    const doctor = DOCTOR_WORDS.test(clause)
    if (family) decision.family = allow
    if (doctor) decision.doctor = allow
    if (!family && !doctor && general === null) general = allow
  }
  if (decision[asked] === undefined) decision[asked] = general ?? false
  return decision
}

function describeDecision(decision: ShareDecision): string {
  if (decision.family && decision.doctor) return 'Yes, you can tell my family and the doctor.'
  if (decision.doctor) return 'Yes, tell the doctor, but not my family.'
  if (decision.family) return 'Yes, tell my family, but not the doctor.'
  return 'No, please keep that private.'
}

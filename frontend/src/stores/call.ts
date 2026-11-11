import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { carrieFacts, carrieTurn, getHealth } from '../lib/api'
import { LiveCall } from '../lib/live'
import { playAudio, type Recording } from '../lib/recorder'
import { speak, stopSpeaking } from '../lib/speech'
import { clipUrl, fromCall, fromUtterance, saveRow, uploadClip } from '../lib/supabase'
import type { Audience, Call, CarrieTurnResponse, ShareDecision, Speaker, Utterance } from '../types'
import { useCircleStore } from './circle'
import { useFactsStore } from './facts'
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
}

export const useCallStore = defineStore('call', () => {
  const circle = useCircleStore()
  const factsStore = useFactsStore()
  const voiceNotes = useVoiceNotesStore()

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
  }

  /** The elder picks up: Carrie introduces herself (as an AI) and plays any waiting voice notes. */
  async function answer() {
    if (phase.value !== 'ringing') return
    const health = await getHealth().catch(() => null)
    if (health?.live) return answerLive()
    const elder = circle.elder
    call.value = { id: crypto.randomUUID(), elderId: elder.id, startedAt: new Date().toISOString(), endedAt: null, summary: null }
    phase.value = 'talking'
    void saveRow('calls', fromCall(call.value))

    const waiting = voiceNotes.pendingFor(elder.id)
    const response = await askCarrie('', waiting.map((n) => ({ from: circle.byId(n.fromId)?.name ?? 'Your family', transcript: n.transcript ?? '' })))
    if (!response) return
    await say(response.reply)

    for (const note of waiting) {
      if (!inCall.value) return
      const url = clipUrl(note.audioPath)
      addUtterance('family', note.transcript ?? 'Voice note', note.audioPath || null, note.fromId)
      carrie.value = 'idle'
      if (url) await playAudio(url)
      void voiceNotes.markDelivered(note.id, call.value.id)
    }
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
        shareFamily: false,
        shareDoctor: false,
        consent: 'pending',
        createdAt: new Date().toISOString(),
      })
    }

    if (response.consentQuestion) {
      pendingConsent.value = {
        question: response.consentQuestion.question,
        audience: response.consentQuestion.audience,
        factId: createdIds[response.consentQuestion.factIndex] ?? null,
      }
      phase.value = 'consent'
    }
    await say(response.reply)
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
      onStarted: () => (carrie.value = 'listening'),
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
      if (url) await playAudio(url)
      void voiceNotes.markDelivered(note.id, call.value.id)
    }
    const names = notes.map((n) => circle.byId(n.fromId)?.name ?? 'the family').join(' and ')
    live?.instruct(`The voice note from ${names} has just finished playing. Gently ask Rose what she thought of it.`)
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
    const createdIds: string[] = []
    for (const extracted of response.facts) {
      const id = crypto.randomUUID()
      createdIds.push(id)
      await factsStore.add({
        id, callId, elderId: circle.elder.id, utteranceId,
        category: extracted.category, statement: extracted.statement, quote: extracted.quote,
        shareFamily: false, shareDoctor: false, consent: 'pending', createdAt: new Date().toISOString(),
      })
    }
    if (response.consentQuestion && !pendingConsent.value) {
      const q = response.consentQuestion
      pendingConsent.value = { question: q.question, audience: q.audience, factId: createdIds[q.factIndex] ?? null }
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
      void saveRow('calls', fromCall(call.value))
    }
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
    const factId = pendingConsent.value?.factId
    if (factId) await factsStore.setSharing(factId, decision)
  }

  return { phase, carrie, call, utterances, interim, thinking, error, pendingConsent, liveMode, inCall, callFacts, elderTurns, ring, answer, hearElder, answerConsent, hangUp }
})

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

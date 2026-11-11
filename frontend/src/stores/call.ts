import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { carrieTurn } from '../lib/api'
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

  /** The elder answered the sharing question by tapping instead of speaking. */
  async function answerConsent(decision: ShareDecision) {
    if (phase.value !== 'consent') return
    await applyConsent(decision)
    await hearElder(describeDecision(decision), null, { consentHandled: true })
  }

  function hangUp() {
    stopSpeaking()
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

  return { phase, carrie, call, utterances, interim, thinking, error, pendingConsent, inCall, callFacts, elderTurns, ring, answer, hearElder, answerConsent, hangUp }
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

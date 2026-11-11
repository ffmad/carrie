import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { demoFacts, demoUtterances } from '../lib/demoData'
import { clipUrl, fetchRows, fromFact, patchRow, saveRow, supabase, toFact, toUtterance } from '../lib/supabase'
import type { Fact, ShareDecision, Utterance } from '../types'

/** Facts, who each is shared with, and the utterances that act as their receipts. */
export const useFactsStore = defineStore('facts', () => {
  // Demo data straight away when Supabase is not configured; otherwise wait for load().
  const facts = ref<Fact[]>(supabase ? [] : demoFacts)
  const receipts = ref<Record<string, Utterance>>(supabase ? {} : indexById(demoUtterances))
  const source = ref<'demo' | 'supabase'>('demo')
  const loaded = ref(!supabase)

  const newestFirst = computed(() => [...facts.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  const sharedWithFamily = computed(() => newestFirst.value.filter((f) => f.shareFamily))
  const sharedWithDoctor = computed(() => newestFirst.value.filter((f) => f.shareDoctor))

  const byId = (id: string): Fact | null => facts.value.find((f) => f.id === id) ?? null
  const forCall = (callId: string): Fact[] => facts.value.filter((f) => f.callId === callId)

  /** URL of the clip in which the elder said this fact, if a recording exists. */
  function receiptUrl(fact: Fact): string | null {
    if (!fact.utteranceId) return null
    return clipUrl(receipts.value[fact.utteranceId]?.audioPath)
  }

  async function load() {
    const [factRows, utteranceRows] = await Promise.all([fetchRows('facts'), fetchRows('utterances')])
    if (factRows?.length) {
      // Keep anything captured locally while the request was in flight.
      const local = facts.value.filter((f) => !factRows.some((row) => row.id === f.id))
      facts.value = [...factRows.map(toFact), ...local]
      receipts.value = { ...indexById((utteranceRows ?? []).map(toUtterance)), ...receipts.value }
      source.value = 'supabase'
    } else if (!facts.value.length) {
      facts.value = demoFacts
      receipts.value = { ...indexById(demoUtterances), ...receipts.value }
    }
    loaded.value = true
  }

  /** Registers the utterance a new fact points at, so its receipt can be played. */
  function addReceipt(utterance: Utterance) {
    receipts.value = { ...receipts.value, [utterance.id]: utterance }
  }

  async function add(fact: Fact) {
    facts.value = [...facts.value, fact]
    await saveRow('facts', fromFact(fact))
  }

  /** Applies the elder's answer. Only the audiences present in `decision` change. */
  async function setSharing(id: string, decision: ShareDecision) {
    const fact = byId(id)
    if (!fact) return
    if (decision.family !== undefined) fact.shareFamily = decision.family
    if (decision.doctor !== undefined) fact.shareDoctor = decision.doctor
    fact.consent = fact.shareFamily || fact.shareDoctor ? 'granted' : 'declined'
    await patchRow('facts', id, {
      share_family: fact.shareFamily,
      share_doctor: fact.shareDoctor,
      consent: fact.consent,
    })
  }

  return { facts, receipts, source, loaded, newestFirst, sharedWithFamily, sharedWithDoctor, byId, forCall, receiptUrl, load, addReceipt, add, setSharing }
})

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

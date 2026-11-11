import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { demoFacts, demoUtterances } from '../lib/demoData'
import { clipUrl, fetchRows, fromFact, patchRow, saveRow, supabase, toFact, toUtterance } from '../lib/supabase'
import type { Fact, Utterance } from '../types'

/** Facts, the people each is shared with, and the utterances that act as their receipts. */
export const useFactsStore = defineStore('facts', () => {
  // Demo data straight away when Supabase is not configured; otherwise wait for load().
  const facts = ref<Fact[]>(supabase ? [] : demoFacts)
  const receipts = ref<Record<string, Utterance>>(supabase ? {} : indexById(demoUtterances))
  const source = ref<'demo' | 'supabase'>('demo')
  const loaded = ref(!supabase)

  const newestFirst = computed(() => [...facts.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

  const byId = (id: string): Fact | null => facts.value.find((f) => f.id === id) ?? null
  const forCall = (callId: string): Fact[] => facts.value.filter((f) => f.callId === callId)
  /** What this person may see, newest first. Nobody is ever shown anything else. */
  const sharedWith = (personId: string): Fact[] => newestFirst.value.filter((f) => f.sharedWith.includes(personId))

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
      receipts.value = { ...receipts.value, ...indexById((utteranceRows ?? []).map(toUtterance)) }
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

  /** Applies the elder's answer: the people she said yes to, and the people she said no to. */
  async function setSharing(id: string, change: { allow?: string[]; deny?: string[] }) {
    const fact = byId(id)
    if (!fact) return
    const people = new Set(fact.sharedWith)
    change.allow?.forEach((personId) => people.add(personId))
    change.deny?.forEach((personId) => people.delete(personId))
    fact.sharedWith = [...people]
    fact.consent = fact.sharedWith.length ? 'granted' : 'declined'
    await patchRow('facts', id, { shared_with: fact.sharedWith, consent: fact.consent })
  }

  /** The elder takes something back from one person. */
  const revoke = (id: string, personId: string) => setSharing(id, { deny: [personId] })

  /** "I'll do it", or null to let it go. */
  async function claim(id: string, personId: string | null) {
    const fact = byId(id)
    if (!fact) return
    fact.claimedBy = personId
    await patchRow('facts', id, { claimed_by: personId })
  }

  return { facts, receipts, source, loaded, newestFirst, byId, forCall, sharedWith, receiptUrl, load, addReceipt, add, setSharing, revoke, claim }
})

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '../lib/api'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import ReceiptPlayer from './ReceiptPlayer.vue'

/**
 * "We don't replace the call. We give you a reason to make it."
 * Heads-ups on what changed, and a reason to ring her with things to talk about, each in her own words.
 * The backend only ever receives what she shared with this one person.
 */
interface FamilyUpdate {
  alerts: { factId: string; text: string }[]
  nudge: { reason: string; daysSinceLastCall: number | null; talkAbout: { factId: string; text: string }[] } | null
}

const props = defineProps<{ her: string }>()

const circle = useCircleStore()
const facts = useFactsStore()

const viewer = computed(() => circle.viewer)
const shared = computed(() => facts.sharedWith(viewer.value.id))
const update = ref<FamilyUpdate | null>(null)

// Ask again only when what she shared with this person changes, not on every 3-second refresh.
watch(
  () => `${viewer.value.id}:${shared.value.map((f) => f.id).join()}`,
  async () => {
    if (!shared.value.length) return (update.value = null)
    try {
      update.value = await api.post<FamilyUpdate>('/carrie/family-update', {
        member: { name: viewer.value.name, relation: viewer.value.relation },
        sharedFacts: shared.value.map((f) => ({ id: f.id, statement: f.statement, quote: f.quote, category: f.category, createdAt: f.createdAt })),
      })
    } catch {
      update.value = null // The page works without it.
    }
  },
  { immediate: true },
)

// Never render a fact the backend names unless this person may see it.
const withFact = <T extends { factId: string }>(items: T[]) =>
  items.flatMap((item) => {
    const fact = shared.value.find((f) => f.id === item.factId)
    return fact ? [{ ...item, fact }] : []
  })
const alerts = computed(() => withFact(update.value?.alerts ?? []))
const talkAbout = computed(() => withFact(update.value?.nudge?.talkAbout ?? []))
const phone = import.meta.env.VITE_ELDER_PHONE ?? ''
</script>

<template>
  <section v-if="alerts.length || update?.nudge" class="nudge card" aria-label="Carrie suggests">
    <ul v-if="alerts.length" class="nudge__alerts">
      <li v-for="alert in alerts" :key="alert.factId" class="nudge__alert">
        <strong>Heads-up</strong>
        <span>{{ alert.text }}</span>
      </li>
    </ul>

    <template v-if="update?.nudge">
      <p class="eyebrow">Carrie suggests</p>
      <h2 class="nudge__title">Give {{ props.her }} a call</h2>
      <p class="nudge__reason">
        {{ update.nudge.reason }}
        <template v-if="update.nudge.daysSinceLastCall !== null"> You last spoke {{ update.nudge.daysSinceLastCall }} days ago.</template>
      </p>

      <ul v-if="talkAbout.length" class="nudge__topics">
        <li v-for="topic in talkAbout" :key="topic.factId" class="nudge__topic">
          <p class="nudge__topic-text">{{ topic.text }}</p>
          <ReceiptPlayer :src="facts.receiptUrl(topic.fact)" :quote="topic.fact.quote" :speaker="circle.elder.name" />
        </li>
      </ul>

      <a class="btn btn--primary btn--block" :href="`tel:${phone}`">Call {{ props.her }}</a>
    </template>
  </section>
</template>

<style scoped>
.nudge {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border: 2px solid var(--color-primary);
}

.nudge__alerts,
.nudge__topics {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nudge__alert {
  display: flex;
  flex-direction: column;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-share-pending-bg);
  color: var(--color-share-pending-fg);
}

.nudge__title {
  font-size: var(--text-lg);
}

.nudge__reason {
  color: var(--color-text-muted);
}

.nudge__topic {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
}

.nudge__topic-text {
  font-weight: var(--weight-medium);
}
</style>

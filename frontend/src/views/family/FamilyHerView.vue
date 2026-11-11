<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import FactCard from '../../components/FactCard.vue'
import FamilyNudge from '../../components/FamilyNudge.vue'
import { CATEGORY_LABELS, formatDay, initialOf } from '../../lib/format'
import { useCallsStore } from '../../stores/calls'
import { useCircleStore } from '../../stores/circle'
import { useFactsStore } from '../../stores/facts'
import { useRequestsStore } from '../../stores/requests'
import { useSettingsStore } from '../../stores/settings'
import { useVoiceNotesStore } from '../../stores/voiceNotes'
import type { Fact, FactCategory } from '../../types'

/** "Mum" for Mia, "Grandma" for Leo: how she is, from what she agreed to share with this person. */
const route = useRoute()
const circle = useCircleStore()
const calls = useCallsStore()
const facts = useFactsStore()
const voiceNotes = useVoiceNotesStore()
const requests = useRequestsStore()
const settings = useSettingsStore()

const viewer = computed(() => circle.viewer)
const elder = computed(() => circle.elder)
const isGrandchild = computed(() => /grand/i.test(viewer.value.relation))
const her = computed(() => (isGrandchild.value ? 'Grandma' : 'Mum'))

const mine = computed<Fact[]>(() => facts.sharedWith(viewer.value.id))

/* Header: last call, next call, what Carrie will bring from this person. */
const timeFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })

const lastSpoke = computed(() => {
  const call = calls.latest
  if (!call) return null
  const at = call.endedAt ?? call.startedAt
  const day = formatDay(at)
  const lead = day === 'Today' ? 'today' : day === 'Yesterday' ? 'yesterday' : `on ${day}`
  return `${lead} at ${timeFormat.format(new Date(call.startedAt))}`
})

const callTime = computed(() => (settings.settings?.callTime ?? '10:00').slice(0, 5))

const nextCall = computed(() => {
  const [hours, minutes] = callTime.value.split(':').map(Number)
  const now = new Date()
  const todayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 0, minutes || 0)
  return `${now < todayAt ? 'Today' : 'Tomorrow'} at ${callTime.value}`
})

const bringing = computed(() => {
  const me = viewer.value.id
  const recordings = voiceNotes
    .pendingFor(elder.value.id)
    .filter((note) => note.fromId === me)
    .map((note) => ({
      key: `note-${note.id}`,
      kind: 'Your recording',
      text: note.transcript ? `“${note.transcript}”` : 'In your own voice',
    }))
  const asks = requests
    .from(me)
    .filter((request) => request.status === 'pending' && request.kind !== 'checkin')
    .map((request) => ({
      key: `request-${request.id}`,
      kind: request.kind === 'ask' ? 'A question' : 'A message',
      text: request.text,
    }))
  return [...recordings, ...asks]
})

/* What she needs, then the rest by topic. A grandchild gets the lighter things first. */
const needs = computed(() => mine.value.filter((fact) => fact.category === 'request'))

const LIGHT: FactCategory[] = ['mood', 'social', 'daily']
const moments = computed(() => (isGrandchild.value ? mine.value.filter((fact) => LIGHT.includes(fact.category)) : []))

const topics = computed(() => {
  const order: FactCategory[] = isGrandchild.value ? ['health', 'medication'] : ['health', 'medication', 'mood', 'daily', 'social']
  return order
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      facts: mine.value.filter((fact) => fact.category === category),
    }))
    .filter((topic) => topic.facts.length)
})

const carriePath = computed(() => `/family/${route.params.who === 'leo' ? 'leo' : 'mia'}/carrie`)
</script>

<template>
  <div class="her">
    <div class="screen__scroll her__scroll">
      <FamilyNudge :her="her" />
      <section class="card her__head">
        <div class="her__who">
          <span class="her__avatar" :style="{ background: elder.avatarColor }" aria-hidden="true">{{ initialOf(elder.name) }}</span>
          <div>
            <h1>{{ her }}</h1>
            <p class="muted small">{{ elder.name }} · only what she chose to share with you</p>
          </div>
        </div>

        <dl class="her__facts">
          <div class="her__fact">
            <dt>Carrie last spoke with her</dt>
            <dd>{{ lastSpoke ?? 'Not yet' }}</dd>
          </div>
          <div class="her__fact">
            <dt>Next call</dt>
            <dd>{{ nextCall }}</dd>
          </div>
        </dl>

        <div class="her__bring">
          <p class="eyebrow">Carrie will bring from you</p>
          <ul v-if="bringing.length" class="her__bring-list">
            <li v-for="item in bringing" :key="item.key" class="her__bring-item">
              <span class="her__bring-kind">{{ item.kind }}</span>
              <span class="her__bring-text">{{ item.text }}</span>
            </li>
          </ul>
          <p v-else class="muted small">
            Nothing waiting.
            <RouterLink :to="carriePath" class="her__link">Give Carrie something to carry</RouterLink>
          </p>
        </div>
      </section>

      <section v-if="moments.length" class="her__section" aria-labelledby="her-moments">
        <h2 id="her-moments">Moments</h2>
        <FactCard v-for="fact in moments" :key="fact.id" :fact="fact" />
      </section>

      <section v-if="needs.length" class="her__section" aria-labelledby="her-needs">
        <h2 id="her-needs">She needs</h2>
        <FactCard v-for="fact in needs" :key="fact.id" :fact="fact" />
      </section>

      <section v-for="topic in topics" :key="topic.category" class="her__section" :aria-labelledby="`her-${topic.category}`">
        <h2 :id="`her-${topic.category}`">{{ topic.label }}</h2>
        <FactCard v-for="fact in topic.facts" :key="fact.id" :fact="fact" />
      </section>

      <p v-if="!mine.length" class="her__empty muted">
        Nothing shared with you yet. {{ elder.name }} decides what Carrie passes on, and to whom.
      </p>
    </div>
  </div>
</template>

<style scoped>
.her {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.her__scroll {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-8);
}

.her__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.her__who {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.her__avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-pill);
  color: var(--color-person-contrast);
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
}

.her__facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin: 0;
}

.her__fact {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.her__fact dt {
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-text-muted);
}

.her__fact dd {
  margin: 0;
  font-weight: var(--weight-bold);
}

.her__bring {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.her__bring-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.her__bring-item {
  display: flex;
  flex-direction: column;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-accent-soft);
}

.her__bring-kind {
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-share-family-fg);
}

.her__bring-text {
  font-size: var(--text-sm);
}

.her__link {
  font-weight: var(--weight-bold);
  color: var(--color-primary);
  text-decoration: underline;
}

.her__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.her__empty {
  padding: var(--space-6);
  text-align: center;
}
</style>

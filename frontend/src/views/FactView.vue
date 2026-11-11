<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ReceiptPlayer from '../components/ReceiptPlayer.vue'
import ShareBadge from '../components/ShareBadge.vue'
import { CATEGORY_LABELS, formatDay } from '../lib/format'
import { homeRouteFor, useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'

/** One fact: the statement, the quote behind it, the receipt, and who it is shared with. */
const props = defineProps<{ id: string }>()

const circle = useCircleStore()
const facts = useFactsStore()

const fact = computed(() => facts.byId(props.id))
const isElder = computed(() => circle.viewer.role === 'elder')
/** The elder sees everything; family and doctor only what was shared with them. */
const canSee = computed(() => {
  if (!fact.value) return false
  if (isElder.value) return true
  return circle.viewer.role === 'family' ? fact.value.shareFamily : fact.value.shareDoctor
})
const backTo = computed(() => homeRouteFor(circle.viewerKey))
</script>

<template>
  <section class="screen">
    <RouterLink :to="backTo" class="small muted">‹ Back</RouterLink>

    <template v-if="fact && canSee">
      <header class="stack">
        <p class="eyebrow">{{ CATEGORY_LABELS[fact.category] }} · {{ formatDay(fact.createdAt) }}</p>
        <h1>{{ fact.statement }}</h1>
      </header>

      <section class="card stack" aria-label="Receipt">
        <p class="eyebrow">In {{ circle.elder.name }}'s own words</p>
        <blockquote class="quote">“{{ fact.quote }}”</blockquote>
        <ReceiptPlayer :src="facts.receiptUrl(fact)" :quote="fact.quote" :speaker="circle.elder.name" />
      </section>

      <section class="card stack" aria-label="Sharing">
        <div class="row share-row">
          <p class="eyebrow">Shared with</p>
          <ShareBadge :fact="fact" />
        </div>
        <template v-if="isElder">
          <label class="toggle">
            <input type="checkbox" :checked="fact.shareFamily" @change="facts.setSharing(fact.id, { family: !fact.shareFamily })" />
            My family
          </label>
          <label class="toggle">
            <input type="checkbox" :checked="fact.shareDoctor" @change="facts.setSharing(fact.id, { doctor: !fact.shareDoctor })" />
            My doctor
          </label>
          <p class="muted small">You decide. Carrie only passes on what you allow.</p>
        </template>
        <p v-else class="muted small">{{ circle.elder.name }} chose who can see this.</p>
      </section>
    </template>

    <p v-else-if="!facts.loaded" class="muted">Loading…</p>

    <div v-else class="card stack">
      <h2>{{ fact ? 'This one is private' : 'Nothing here' }}</h2>
      <p class="muted">
        {{ fact ? `${circle.elder.name} has not shared this with you.` : 'Carrie could not find that note.' }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.quote {
  font-size: var(--text-lg);
  font-style: italic;
  line-height: 1.35;
}

.share-row {
  justify-content: space-between;
}

.toggle {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--tap-min);
  font-size: var(--text-lg);
}

.toggle input {
  width: 24px;
  height: 24px;
  accent-color: var(--color-accent);
}
</style>

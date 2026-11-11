<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ReceiptPlayer from '../components/ReceiptPlayer.vue'
import { CATEGORY_LABELS, formatDay } from '../lib/format'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import type { Fact, FactCategory } from '../types'

/** One screen for the next appointment, built only from facts shared with the doctor. */
const circle = useCircleStore()
const facts = useFactsStore()

const ORDER: FactCategory[] = ['health', 'medication', 'daily', 'mood', 'social', 'request']

const sections = computed(() =>
  ORDER.map((category) => ({
    category,
    items: facts.sharedWithDoctor.filter((fact: Fact) => fact.category === category),
  })).filter((section) => section.items.length > 0),
)
</script>

<template>
  <section class="screen">
    <header class="stack">
      <p class="eyebrow">Appointment brief · {{ circle.doctor?.name ?? 'Doctor' }}</p>
      <h1>{{ circle.elder.name }}</h1>
      <p class="muted">{{ circle.elder.relation }} · {{ facts.sharedWithDoctor.length }} notes from Carrie's calls</p>
      <p class="brief__note small">
        Only what {{ circle.elder.name }} agreed to share with you. Each line is backed by her own words.
      </p>
    </header>

    <p v-if="!sections.length" class="muted">{{ circle.elder.name }} has not shared anything with her doctor yet.</p>

    <section v-for="section in sections" :key="section.category" class="stack">
      <h2>{{ CATEGORY_LABELS[section.category] }}</h2>
      <article v-for="fact in section.items" :key="fact.id" class="card stack brief__item">
        <div class="row brief__head">
          <RouterLink :to="`/fact/${fact.id}`" class="brief__statement">{{ fact.statement }}</RouterLink>
          <span class="muted small brief__day">{{ formatDay(fact.createdAt) }}</span>
        </div>
        <blockquote class="brief__quote">“{{ fact.quote }}”</blockquote>
        <ReceiptPlayer :src="facts.receiptUrl(fact)" :quote="fact.quote" :speaker="circle.elder.name" />
      </article>
    </section>
  </section>
</template>

<style scoped>
.brief__note {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-share-doctor-bg);
  color: var(--color-share-doctor-fg);
}

.brief__item {
  gap: var(--space-2);
}

.brief__head {
  align-items: baseline;
  justify-content: space-between;
}

.brief__statement {
  font-weight: var(--weight-medium);
}

.brief__day {
  flex: none;
}

.brief__quote {
  padding-left: var(--space-3);
  border-left: 3px solid var(--color-accent-soft);
  color: var(--color-text-muted);
  font-style: italic;
}
</style>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CATEGORY_LABELS, formatDay } from '../lib/format'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import type { Fact } from '../types'
import ReceiptPlayer from './ReceiptPlayer.vue'
import ShareBadge from './ShareBadge.vue'

/** One thing Carrie learned, always shown with the elder's own words and a way to hear them. */
defineProps<{ fact: Fact }>()

const circle = useCircleStore()
const facts = useFactsStore()
</script>

<template>
  <article class="card fact">
    <header class="fact__meta">
      <span class="eyebrow">{{ CATEGORY_LABELS[fact.category] }} · {{ formatDay(fact.createdAt) }}</span>
      <ShareBadge :fact="fact" />
    </header>
    <RouterLink :to="`/fact/${fact.id}`" class="fact__statement">{{ fact.statement }}</RouterLink>
    <blockquote class="fact__quote">“{{ fact.quote }}”</blockquote>
    <ReceiptPlayer :src="facts.receiptUrl(fact)" :quote="fact.quote" :speaker="circle.elder.name" />
  </article>
</template>

<style scoped>
.fact {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.fact__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.fact__statement {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: 1.25;
}

.fact__quote {
  padding-left: var(--space-3);
  border-left: 3px solid var(--color-primary-soft);
  color: var(--color-text-muted);
  font-style: italic;
}
</style>

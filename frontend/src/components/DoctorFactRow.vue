<script setup lang="ts">
import ReceiptPlayer from './ReceiptPlayer.vue'
import type { Fact } from '../types'

/**
 * One line of the doctor's summary: the date, Carrie's one-line statement,
 * the patient's exact words and the recording of her saying them.
 */
defineProps<{ fact: Fact; src: string | null; speaker: string }>()

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
</script>

<template>
  <article class="fact-row">
    <time class="fact-row__date" :datetime="fact.createdAt">{{ shortDate.format(new Date(fact.createdAt)) }}</time>
    <div class="fact-row__body">
      <p class="fact-row__statement">{{ fact.statement }}</p>
      <blockquote class="fact-row__quote">“{{ fact.quote }}”</blockquote>
      <ReceiptPlayer :src="src" :quote="fact.quote" :speaker="speaker" />
    </div>
  </article>
</template>

<style scoped>
.fact-row {
  display: grid;
  grid-template-columns: 3.25rem 1fr;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.fact-row + .fact-row {
  border-top: 1px solid var(--color-border);
}

.fact-row__date {
  padding-top: 1px;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.fact-row__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.fact-row__statement {
  font-weight: var(--weight-medium);
  line-height: 1.3;
}

.fact-row__quote {
  padding-left: var(--space-3);
  border-left: 3px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { CATEGORY_LABELS, formatDay } from '../lib/format'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import type { Fact } from '../types'
import ReceiptPlayer from './ReceiptPlayer.vue'
import ShareBadge from './ShareBadge.vue'

/**
 * One thing Carrie passed on, always with Rose's own words and a way to hear them.
 * When it is something she needs, a family member can say "I'll do it".
 */
const props = withDefaults(defineProps<{ fact: Fact; showShare?: boolean; showMeta?: boolean }>(), {
  showShare: true,
  showMeta: true,
})

const circle = useCircleStore()
const facts = useFactsStore()

const isNeed = computed(() => props.fact.category === 'request')
const canClaim = computed(() => isNeed.value && circle.viewer.role === 'family')
const claimer = computed(() => circle.byId(props.fact.claimedBy ?? null))
const claimedByMe = computed(() => props.fact.claimedBy === circle.viewer.id)

function claim() {
  void facts.claim(props.fact.id, circle.viewer.id)
}

function unclaim() {
  void facts.claim(props.fact.id, null)
}
</script>

<template>
  <article class="card fact" :class="{ 'fact--need': isNeed }">
    <header v-if="showMeta || showShare" class="fact__meta">
      <span v-if="showMeta" class="eyebrow">
        {{ isNeed ? 'She asked' : CATEGORY_LABELS[fact.category] }} · {{ formatDay(fact.createdAt) }}
      </span>
      <ShareBadge v-if="showShare" :fact="fact" />
    </header>
    <p class="fact__statement">{{ fact.statement }}</p>
    <blockquote class="fact__quote">“{{ fact.quote }}”</blockquote>
    <ReceiptPlayer :src="facts.receiptUrl(fact)" :quote="fact.quote" :speaker="circle.elder.name" />

    <footer v-if="isNeed && (canClaim || claimer)" class="fact__claim">
      <template v-if="claimer">
        <span class="fact__claimed">
          <svg viewBox="0 0 24 24" class="fact__check" aria-hidden="true"><path d="M9.2 16.6 4.8 12.2l-1.6 1.6 6 6L21 8l-1.6-1.6z" /></svg>
          {{ claimedByMe ? "You're on it" : `${claimer.name} is on it` }}
        </span>
        <button v-if="claimedByMe" type="button" class="fact__undo" @click="unclaim">Undo</button>
      </template>
      <button v-else type="button" class="btn btn--primary fact__do" @click="claim">I'll do it</button>
    </footer>
  </article>
</template>

<style scoped>
.fact {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.fact--need {
  border-color: var(--color-accent);
}

.fact__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.fact__statement {
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  line-height: 1.3;
}

.fact__quote {
  padding-left: var(--space-3);
  border-left: 3px solid var(--color-primary-soft);
  color: var(--color-text-muted);
  font-style: italic;
}

.fact__claim {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.fact__do {
  min-height: 40px;
}

.fact__claimed {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  color: var(--color-person-chen);
}

.fact__check {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.fact__undo {
  padding: var(--space-1) var(--space-2);
  border: 0;
  background: none;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  text-decoration: underline;
}
</style>

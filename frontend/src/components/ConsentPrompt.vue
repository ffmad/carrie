<script setup lang="ts">
import { AUDIENCE_LABELS } from '../lib/format'
import type { Audience, ShareDecision } from '../types'

/**
 * "Can I share this?" Carrie asks before passing anything on. The elder can
 * answer out loud, or tap. Family and doctor are separate choices.
 */
defineProps<{ question: string; audience: Audience; statement?: string | null; disabled?: boolean }>()
const emit = defineEmits<{ answer: [decision: ShareDecision] }>()
</script>

<template>
  <section class="consent card" aria-label="Carrie is asking permission to share">
    <p class="eyebrow">Carrie is asking</p>
    <p class="consent__question">{{ question }}</p>
    <p v-if="statement" class="consent__about muted small">About: {{ statement }}</p>
    <div class="consent__choices">
      <button type="button" class="btn btn--accent btn--block" :disabled="disabled" @click="emit('answer', { [audience]: true })">
        Yes, tell {{ AUDIENCE_LABELS[audience] }}
      </button>
      <button type="button" class="btn btn--block" :disabled="disabled" @click="emit('answer', { family: true, doctor: true })">
        Tell my family and my doctor
      </button>
      <button type="button" class="btn btn--block" :disabled="disabled" @click="emit('answer', { family: false, doctor: false })">
        No, keep it private
      </button>
    </div>
  </section>
</template>

<style scoped>
.consent {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border-color: var(--color-share-pending-fg);
  background: var(--color-share-pending-bg);
}

.consent__question {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: 1.3;
}

.consent__choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Utterance } from '../types'

/**
 * Large live captions of the call, on Rose's phone. Carrie's words sit on the left,
 * Rose's on the right, and a family recording is labelled with whose voice it is.
 * `interim` is what Rose is saying right now.
 */
const props = defineProps<{
  utterances: (Pick<Utterance, 'id' | 'speaker' | 'text'> & { speakerId?: string | null })[]
  interim?: string
  /** Person id to first name, to label a family recording ("Leo's voice"). */
  names?: Record<string, string>
}>()

function labelFor(line: { speaker: Utterance['speaker']; speakerId?: string | null }): string {
  if (line.speaker === 'carrie') return 'Carrie'
  if (line.speaker === 'elder') return 'You'
  const name = line.speakerId ? props.names?.[line.speakerId] : null
  return name ? `${name}'s voice` : 'A message for you'
}

const list = ref<HTMLElement | null>(null)
async function toLatest(smooth = true) {
  await nextTick()
  list.value?.scrollTo({ top: list.value.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}
watch(() => [props.utterances.length, props.interim], () => toLatest())

// Keep the newest line in view when the space changes too (a question from Carrie appears under the captions).
let resizes: ResizeObserver | null = null
onMounted(() => {
  void toLatest(false)
  if (typeof ResizeObserver === 'undefined' || !list.value) return
  resizes = new ResizeObserver(() => void toLatest(false))
  resizes.observe(list.value)
})
onBeforeUnmount(() => resizes?.disconnect())
</script>

<template>
  <div ref="list" class="captions" aria-live="polite">
    <p v-if="!utterances.length && !interim" class="captions__empty">Just a moment…</p>
    <p
      v-for="(line, index) in utterances"
      :key="line.id"
      class="captions__line"
      :class="[`captions__line--${line.speaker}`, { 'captions__line--earlier': interim || index < utterances.length - 1 }]"
    >
      <span class="captions__who" :class="{ 'captions__who--hidden': line.speaker !== 'family' }">{{ labelFor(line) }}</span>
      {{ line.text }}
    </p>
    <p v-if="interim" class="captions__line captions__line--elder captions__line--interim">
      <span class="captions__who captions__who--hidden">You</span>
      {{ interim }}
    </p>
  </div>
</template>

<style scoped>
.captions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4) 0 var(--space-2);
  scrollbar-width: none;
  /* Older lines fade out under the dove instead of being cut off. */
  mask-image: linear-gradient(to bottom, transparent, var(--color-text) var(--space-6));
}

.captions::-webkit-scrollbar {
  display: none;
}

/* Push the first lines to the bottom, next to the controls, while the call is still short. */
.captions > :first-child {
  margin-top: auto;
}

.captions__empty {
  font-size: var(--text-lg);
  text-align: center;
  color: var(--color-text-muted);
}

.captions__line {
  max-width: 90%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: 1.35;
  transition: opacity var(--duration-slow) var(--ease);
  animation: caption-in var(--duration-slow) var(--ease);
}

.captions__line--earlier {
  opacity: 0.6;
}

.captions__who {
  display: block;
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--color-share-family-fg);
}

/* Read out by screen readers; on screen the side and the color already say who is talking. */
.captions__who--hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.captions__line--carrie {
  align-self: flex-start;
  border: 1px solid var(--color-border);
  border-bottom-left-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.captions__line--elder {
  align-self: flex-end;
  border-bottom-right-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}

.captions__line--family {
  align-self: flex-start;
  border: 1px solid var(--color-accent);
  border-bottom-left-radius: var(--radius-sm);
  background: var(--color-accent-soft);
}

.captions__line--interim {
  opacity: 0.75;
}

@keyframes caption-in {
  from {
    opacity: 0;
    transform: translateY(var(--space-3));
  }
}
</style>

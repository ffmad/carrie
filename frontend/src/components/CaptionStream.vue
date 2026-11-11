<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Utterance } from '../types'

/** Live captions of the call. `interim` is what the elder is saying right now. */
const props = defineProps<{
  utterances: Pick<Utterance, 'id' | 'speaker' | 'text'>[]
  interim?: string
  elderName?: string
}>()

const SPEAKER_LABELS = { carrie: 'Carrie', family: 'Voice note' } as const
const labelFor = (speaker: Utterance['speaker']) =>
  speaker === 'elder' ? (props.elderName ?? 'You') : SPEAKER_LABELS[speaker]

const list = ref<HTMLElement | null>(null)
watch(
  () => [props.utterances.length, props.interim],
  async () => {
    await nextTick()
    list.value?.scrollTo({ top: list.value.scrollHeight, behavior: 'smooth' })
  },
)
</script>

<template>
  <div ref="list" class="captions" aria-live="polite">
    <p v-if="!utterances.length && !interim" class="captions__empty muted">Captions will appear here.</p>
    <p v-for="line in utterances" :key="line.id" class="captions__line" :class="`captions__line--${line.speaker}`">
      <span class="captions__who">{{ labelFor(line.speaker) }}</span>
      {{ line.text }}
    </p>
    <p v-if="interim" class="captions__line captions__line--elder captions__line--interim">
      <span class="captions__who">{{ labelFor('elder') }}</span>
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
  padding: var(--space-2) 0;
}

.captions__empty {
  text-align: center;
}

.captions__line {
  max-width: 88%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  line-height: 1.35;
}

.captions__who {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.7;
}

.captions__line--carrie {
  align-self: flex-start;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.captions__line--elder {
  align-self: flex-end;
  background: var(--color-primary-soft);
}

.captions__line--family {
  align-self: flex-start;
  background: var(--color-accent-soft);
}

.captions__line--interim {
  opacity: 0.65;
}
</style>

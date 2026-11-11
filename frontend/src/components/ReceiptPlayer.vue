<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { speak, stopSpeaking } from '../lib/speech'

/**
 * The receipt: plays the clip of the person saying the quote, in their own voice.
 * When no recording exists (bundled demo seed), it says so and reads the quote
 * in the synthetic voice instead, clearly labelled.
 */
const props = defineProps<{ src: string | null; quote: string; speaker?: string }>()

const playing = ref(false)
const progress = ref(0)
let audio: HTMLAudioElement | null = null

function stop() {
  audio?.pause()
  audio = null
  if (!props.src) stopSpeaking()
  playing.value = false
  progress.value = 0
}

async function toggle() {
  if (playing.value) return stop()
  playing.value = true
  if (!props.src) {
    await speak(props.quote)
    playing.value = false
    return
  }
  const clip = new Audio(props.src)
  audio = clip
  clip.addEventListener('timeupdate', () => {
    const ratio = clip.currentTime / clip.duration
    progress.value = Number.isFinite(ratio) ? ratio : 0
  })
  clip.addEventListener('ended', stop)
  clip.addEventListener('error', stop)
  try {
    await clip.play()
  } catch {
    stop()
  }
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="receipt">
    <button type="button" class="receipt__button" :aria-pressed="playing" @click="toggle">
      <svg viewBox="0 0 24 24" class="receipt__icon" aria-hidden="true">
        <path v-if="!playing" d="M8 5v14l11-7z" />
        <path v-else d="M7 5h4v14H7zM13 5h4v14h-4z" />
      </svg>
      <span v-if="src">{{ playing ? 'Stop' : `Hear ${speaker ?? 'it'} say it` }}</span>
      <span v-else>{{ playing ? 'Stop' : 'Read quote aloud' }}</span>
    </button>
    <span v-if="src" class="receipt__track" aria-hidden="true">
      <span class="receipt__fill" :style="{ width: `${Math.round(progress * 100)}%` }" />
    </span>
    <span v-else class="receipt__note">No recording in demo data</span>
  </div>
</template>

<style scoped>
.receipt {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.receipt__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: var(--space-1) var(--space-4) var(--space-1) var(--space-3);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-pill);
  background: var(--color-accent-soft);
  color: var(--color-share-doctor-fg);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  white-space: nowrap;
}

.receipt__icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.receipt__track {
  flex: 1;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-alt);
  overflow: hidden;
}

.receipt__fill {
  display: block;
  height: 100%;
  background: var(--color-accent);
  transition: width var(--duration-fast) linear;
}

.receipt__note {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>

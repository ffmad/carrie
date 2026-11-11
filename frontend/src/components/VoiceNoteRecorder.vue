<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { recorderSupported, startRecording, type ActiveRecording, type Recording } from '../lib/recorder'

/** Record a voice note, listen back, then send. Carrie plays the real recording, never a paraphrase. */
defineProps<{ toName: string }>()
const emit = defineEmits<{ send: [payload: { recording: Recording; transcript: string }] }>()

const state = ref<'idle' | 'recording' | 'review'>('idle')
const seconds = ref(0)
const transcript = ref('')
const previewUrl = ref<string | null>(null)
const problem = ref<string | null>(null)

let active: ActiveRecording | null = null
let recording: Recording | null = null
let timer: ReturnType<typeof setInterval> | undefined

async function start() {
  problem.value = null
  try {
    active = await startRecording()
  } catch {
    problem.value = 'Carrie needs microphone access to record your voice note.'
    return
  }
  seconds.value = 0
  timer = setInterval(() => seconds.value++, 1000)
  state.value = 'recording'
}

async function stop() {
  clearInterval(timer)
  if (!active) return
  recording = await active.stop()
  active = null
  previewUrl.value = URL.createObjectURL(recording.blob)
  state.value = 'review'
}

function discard() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  recording = null
  transcript.value = ''
  state.value = 'idle'
}

function send() {
  if (!recording) return
  emit('send', { recording, transcript: transcript.value })
  discard()
}

onBeforeUnmount(() => {
  clearInterval(timer)
  active?.cancel()
})
</script>

<template>
  <div class="recorder">
    <p v-if="!recorderSupported" class="muted small">Recording is not supported in this browser.</p>

    <template v-else-if="state === 'idle'">
      <button type="button" class="btn btn--primary btn--block" @click="start">Record a voice note for {{ toName }}</button>
    </template>

    <template v-else-if="state === 'recording'">
      <p class="recorder__live" role="status"><span class="recorder__pulse" /> Recording… {{ seconds }}s</p>
      <button type="button" class="btn btn--danger btn--block" @click="stop">Stop</button>
    </template>

    <template v-else>
      <audio v-if="previewUrl" class="recorder__preview" :src="previewUrl" controls />
      <input v-model="transcript" class="input" type="text" placeholder="What did you say? (optional caption)" />
      <div class="row">
        <button type="button" class="btn btn--ghost" @click="discard">Discard</button>
        <button type="button" class="btn btn--primary recorder__send" @click="send">Send to {{ toName }}</button>
      </div>
    </template>

    <p v-if="problem" class="recorder__problem small" role="alert">{{ problem }}</p>
  </div>
</template>

<style scoped>
.recorder {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.recorder__live {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--weight-medium);
}

.recorder__pulse {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  animation: recorder-pulse 1s ease-in-out infinite alternate;
}

.recorder__preview {
  width: 100%;
}

.recorder__send {
  flex: 1;
}

.recorder__problem {
  color: var(--color-danger);
}

@keyframes recorder-pulse {
  to {
    opacity: 0.3;
  }
}
</style>

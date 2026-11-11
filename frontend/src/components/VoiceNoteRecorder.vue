<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { recorderSupported, startRecording, type ActiveRecording, type Recording } from '../lib/recorder'

/**
 * Record a voice note, listen back, then send. Carrie plays the real recording, never a paraphrase.
 * With `autostart` it begins recording as soon as it appears (the microphone button in a composer);
 * it then emits `close` when the person backs out or has sent.
 */
const props = defineProps<{ toName: string; autostart?: boolean }>()
const emit = defineEmits<{ send: [payload: { recording: Recording; transcript: string }]; close: [] }>()

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
    problem.value = 'Carrie needs your microphone to record this. Allow it in the browser and try again.'
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
  clearInterval(timer)
  active?.cancel()
  active = null
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  recording = null
  transcript.value = ''
  state.value = 'idle'
  emit('close')
}

function send() {
  if (!recording) return
  emit('send', { recording, transcript: transcript.value })
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  recording = null
  transcript.value = ''
  state.value = 'idle'
  emit('close')
}

onMounted(() => {
  if (props.autostart && recorderSupported) void start()
})

onBeforeUnmount(() => {
  clearInterval(timer)
  active?.cancel()
})
</script>

<template>
  <div class="recorder">
    <template v-if="!recorderSupported">
      <p class="muted small">This browser cannot record. Try Chrome or Safari.</p>
      <button v-if="autostart" type="button" class="btn btn--ghost" @click="emit('close')">Close</button>
    </template>

    <template v-else-if="state === 'idle'">
      <div class="row">
        <button v-if="autostart" type="button" class="btn btn--ghost" @click="emit('close')">Cancel</button>
        <button type="button" class="btn btn--primary recorder__grow" @click="start">Record a message for {{ toName }}</button>
      </div>
    </template>

    <template v-else-if="state === 'recording'">
      <div class="row">
        <p class="recorder__live recorder__grow" role="status">
          <span class="recorder__pulse" /> Recording for {{ toName }}… {{ seconds }}s
        </p>
        <button type="button" class="btn btn--ghost" @click="discard">Cancel</button>
        <button type="button" class="btn btn--danger" @click="stop">Stop</button>
      </div>
    </template>

    <template v-else>
      <audio v-if="previewUrl" class="recorder__preview" :src="previewUrl" controls />
      <input v-model="transcript" class="input" type="text" placeholder="What did you say? (optional)" @keydown.enter="send" />
      <div class="row">
        <button type="button" class="btn btn--ghost" @click="discard">Discard</button>
        <button type="button" class="btn btn--primary recorder__grow" @click="send">Send to {{ toName }}</button>
      </div>
    </template>

    <p v-if="problem" class="recorder__problem small" role="alert">{{ problem }}</p>
  </div>
</template>

<style scoped>
.recorder {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recorder__grow {
  flex: 1;
  min-width: 0;
}

.recorder__live {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--weight-medium);
}

.recorder__pulse {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  animation: recorder-pulse 1s ease-in-out infinite alternate;
}

.recorder__preview {
  width: 100%;
  height: 40px;
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

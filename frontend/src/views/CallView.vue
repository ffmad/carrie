<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import CaptionStream from '../components/CaptionStream.vue'
import CarrieAvatar from '../components/CarrieAvatar.vue'
import ConsentPrompt from '../components/ConsentPrompt.vue'
import FactCard from '../components/FactCard.vue'
import { demoElderLines } from '../lib/demoData'
import { recorderSupported, startRecording, type ActiveRecording } from '../lib/recorder'
import { recognitionSupported, startCaptions, stopSpeaking, type Captioner } from '../lib/speech'
import { useCallStore } from '../stores/call'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import type { ShareDecision } from '../types'

/** The elder's side: Carrie, live captions and a few big, simple controls. */
const call = useCallStore()
const circle = useCircleStore()
const facts = useFactsStore()

const listening = ref(false)
const typed = ref('')
let captioner: Captioner | null = null
let recording: ActiveRecording | null = null

const busy = computed(() => call.thinking || call.carrie === 'speaking')
const status = computed(() => {
  if (call.phase === 'ringing') return 'Carrie is calling…'
  if (call.phase === 'ended') return 'Call ended'
  if (!call.inCall) return 'Carrie, your AI helper'
  if (call.thinking) return 'Carrie is thinking…'
  if (listening.value) return 'Carrie is listening'
  if (call.carrie === 'speaking') return 'Carrie is speaking'
  return 'Your turn to speak'
})
const avatarState = computed(() => (listening.value ? 'listening' : call.carrie))
const askedFact = computed(() => (call.pendingConsent?.factId ? facts.byId(call.pendingConsent.factId) : null))
const nextDemoLine = computed(() => demoElderLines[call.elderTurns] ?? null)

async function startListening() {
  stopSpeaking()
  listening.value = true
  call.interim = ''
  captioner = startCaptions((text) => (call.interim = text))
  try {
    recording = recorderSupported ? await startRecording() : null
  } catch {
    recording = null // No microphone permission: captions still work, there is just no receipt clip.
  }
}

async function stopListening() {
  listening.value = false
  const [heard, clip] = await Promise.all([captioner?.stop() ?? call.interim, recording?.stop() ?? null])
  captioner = null
  recording = null
  await call.hearElder(heard || call.interim, clip)
}

async function sendTyped(text = typed.value) {
  typed.value = ''
  await call.hearElder(text)
}

const answerConsent = (decision: ShareDecision) => call.answerConsent(decision)

function endCall() {
  captioner?.cancel()
  recording?.cancel()
  captioner = null
  recording = null
  listening.value = false
  call.hangUp()
}

onBeforeUnmount(() => {
  if (call.inCall || call.phase === 'ringing') endCall()
})
</script>

<template>
  <section class="call">
    <header class="call__stage">
      <CarrieAvatar :state="avatarState" :size="call.inCall ? 112 : 168" />
      <p class="call__status" role="status">{{ status }}</p>
    </header>

    <!-- Before the call -->
    <div v-if="call.phase === 'idle'" class="call__panel">
      <p class="muted call__blurb">
        Carrie phones {{ circle.elder.name }} for a short check-in. She always says she is an AI, and asks before sharing anything.
      </p>
      <button type="button" class="btn btn--primary btn--big btn--block" @click="call.ring()">Start Carrie's call</button>
    </div>

    <div v-else-if="call.phase === 'ringing'" class="call__panel">
      <button type="button" class="btn btn--accent btn--big btn--block" @click="call.answer()">Answer</button>
      <button type="button" class="btn btn--ghost btn--block" @click="endCall">Not now</button>
    </div>

    <!-- During the call -->
    <template v-else-if="call.inCall">
      <CaptionStream class="call__captions" :utterances="call.utterances" :interim="call.interim" :elder-name="circle.elder.name" />

      <div class="call__panel">
        <p v-if="call.error" class="call__error small" role="alert">{{ call.error }}</p>

        <ConsentPrompt
          v-if="call.phase === 'consent' && call.pendingConsent"
          :question="call.pendingConsent.question"
          :audience="call.pendingConsent.audience"
          :statement="askedFact?.statement"
          :disabled="busy || listening"
          @answer="answerConsent"
        />

        <button
          v-if="recognitionSupported"
          type="button"
          class="btn btn--big btn--block"
          :class="listening ? 'btn--danger' : 'btn--primary'"
          :disabled="busy && !listening"
          @click="listening ? stopListening() : startListening()"
        >
          {{ listening ? "I'm done talking" : 'Tap to speak' }}
        </button>

        <details class="call__typed" :open="!recognitionSupported">
          <summary class="small muted">Type instead</summary>
          <form class="row" @submit.prevent="sendTyped()">
            <input v-model="typed" class="input" type="text" :placeholder="`What ${circle.elder.name} says…`" :disabled="busy" />
            <button type="submit" class="btn" :disabled="busy || !typed.trim()">Send</button>
          </form>
          <button v-if="nextDemoLine" type="button" class="btn btn--ghost btn--block small call__demo" :disabled="busy" @click="sendTyped(nextDemoLine)">
            Demo line: “{{ nextDemoLine }}”
          </button>
        </details>

        <button type="button" class="btn btn--ghost btn--block" @click="endCall">End call</button>
      </div>
    </template>

    <!-- After the call -->
    <div v-else class="call__panel call__after">
      <p class="muted">
        {{ call.callFacts.length ? 'Here is what Carrie noted, in your own words.' : 'Carrie did not note anything this time.' }}
      </p>
      <FactCard v-for="fact in call.callFacts" :key="fact.id" :fact="fact" />
      <button type="button" class="btn btn--primary btn--block" @click="call.ring()">Call again</button>
      <RouterLink to="/family" class="btn btn--ghost btn--block">See what the family sees</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.call {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 100%;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.call__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.call__status {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
}

.call__captions {
  flex: 1 1 160px;
  min-height: 120px;
}

.call__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: auto;
}

.call__after {
  margin-top: 0;
}

.call__blurb {
  text-align: center;
}

.call__error {
  color: var(--color-danger);
  text-align: center;
}

.call__typed {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.call__typed summary {
  padding: var(--space-1) 0;
  text-align: center;
  cursor: pointer;
}

.call__demo {
  margin-top: var(--space-2);
  min-height: 0;
  border-style: dashed;
  text-align: left;
}
</style>

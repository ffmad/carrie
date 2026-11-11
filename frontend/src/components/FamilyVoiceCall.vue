<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getHealth } from '../lib/api'
import { formatDay } from '../lib/format'
import { createLiveCall } from '../lib/liveCall'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import CarrieAvatar from './CarrieAvatar.vue'

/**
 * A family member talks to Carrie by voice ("How was Mum this week?").
 * Carrie is given only what Rose shared with this one person, and answers from nothing else.
 */
const props = defineProps<{ her: string }>()
const emit = defineEmits<{ close: [] }>()

const circle = useCircleStore()
const facts = useFactsStore()
const live = createLiveCall()

const carrieLine = ref('')
const myLine = ref('')
const carrieSpeaking = ref(false)
/** The backend has no live voice (no OpenAI key on this machine). */
const voiceOff = ref(false)

const avatar = computed(() => {
  if (voiceOff.value) return 'idle'
  if (live.state.value === 'connecting') return 'thinking'
  return carrieSpeaking.value ? 'speaking' : 'listening'
})
const status = computed(() => {
  if (voiceOff.value) return "Carrie's voice line is not switched on here. You can still type to her."
  if (live.error.value) return live.error.value
  if (live.state.value === 'connecting') return 'Getting Carrie…'
  if (live.state.value === 'live') return carrieSpeaking.value ? 'Carrie is talking' : 'Carrie is listening'
  return 'Call ended'
})

live.onTranscript((t) => {
  if (t.speaker === 'carrie') {
    carrieLine.value = t.text
    carrieSpeaking.value = !t.final
  } else {
    myLine.value = t.text
  }
})

onMounted(async () => {
  const health = await getHealth().catch(() => null)
  if (!health?.live) return (voiceOff.value = true)
  const viewer = circle.viewer
  try {
    await live.start({
      audience: 'family',
      familyMember: viewer.name,
      // Per person, not "family": Leo's Carrie does not know what Rose told only Mia.
      sharedFacts: facts.sharedWith(viewer.id).map((f) => `${formatDay(f.createdAt)}: ${f.statement}. She said: "${f.quote}"`),
    })
  } catch {
    // live.error already holds the reason; the screen shows it.
  }
})

async function hangUp() {
  await live.hangUp()
  emit('close')
}

onBeforeUnmount(() => void live.hangUp())
</script>

<template>
  <section class="voice" aria-label="Talking with Carrie">
    <p class="voice__title">Talking with Carrie about {{ props.her }}</p>
    <CarrieAvatar :state="avatar" :size="168" />
    <p class="voice__status" :class="{ 'voice__status--error': live.error.value || voiceOff }" role="status">{{ status }}</p>

    <div class="voice__lines">
      <p v-if="myLine" class="voice__mine">{{ myLine }}</p>
      <p v-if="carrieLine" class="voice__carrie">{{ carrieLine }}</p>
      <p v-if="!myLine && !carrieLine && !live.error.value && !voiceOff" class="muted small">
        Carrie only knows what {{ circle.elder.name }} said she could tell you.
      </p>
    </div>

    <button type="button" class="btn btn--danger btn--big btn--block" @click="hangUp">
      {{ live.state.value === 'live' || live.state.value === 'connecting' ? 'Hang up' : 'Close' }}
    </button>
  </section>
</template>

<style scoped>
.voice {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4) var(--space-4);
  background: var(--color-bg);
  text-align: center;
}

.voice__title {
  font-weight: var(--weight-bold);
  font-size: var(--text-lg);
}

.voice__status {
  color: var(--color-primary);
  font-weight: var(--weight-medium);
}

.voice__status--error {
  color: var(--color-danger);
}

.voice__lines {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  text-align: left;
}

.voice__mine,
.voice__carrie {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-lg);
}

.voice__mine {
  align-self: flex-end;
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}

.voice__carrie {
  align-self: flex-start;
  background: var(--color-surface);
}
</style>

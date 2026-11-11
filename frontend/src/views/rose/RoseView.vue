<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import CaptionStream from '../../components/CaptionStream.vue'
import CarrieAvatar from '../../components/CarrieAvatar.vue'
import ConsentPrompt from '../../components/ConsentPrompt.vue'
import { demoElderLines } from '../../lib/demoData'
import { usePolling } from '../../lib/poll'
import { recorderSupported, startRecording, type ActiveRecording } from '../../lib/recorder'
import { recognitionSupported, startCaptions, stopSpeaking, type Captioner } from '../../lib/speech'
import { useCallStore } from '../../stores/call'
import { useCircleStore } from '../../stores/circle'
import { useRequestsStore } from '../../stores/requests'
import { useSettingsStore } from '../../stores/settings'
import { useVoiceNotesStore } from '../../stores/voiceNotes'
import type { Fact } from '../../types'

/**
 * Rose's phone: Carrie resting, Carrie calling, the call itself, and what Carrie will pass on.
 * No menu and nothing to learn: she taps the dove, or answers when it rings, and talks.
 */
const call = useCallStore()
const circle = useCircleStore()
const requests = useRequestsStore()
const settings = useSettingsStore()
const voiceNotes = useVoiceNotesStore()

/* The clock: the greeting and the call timer. */
const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 1000)
const clock = computed(() => {
  const started = call.call?.startedAt ? Date.parse(call.call.startedAt) : now.value
  const s = Math.max(0, Math.floor((now.value - started) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
const greeting = computed(() => {
  const hour = new Date(now.value).getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${circle.elder.name}`
})

/* Resting: what is waiting for her. */
const namesById = computed(() => Object.fromEntries(circle.people.map((p) => [p.id, p.name])))
const joinNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')

const waitingNotes = computed(() => voiceNotes.pendingFor(circle.elder.id))
const waitingFrom = computed(() => {
  const senders = [...new Set(waitingNotes.value.map((n) => n.fromId))].map((id) => circle.byId(id)).filter((p) => p !== null)
  if (!waitingNotes.value.length) return null
  return {
    people: senders,
    title: `${joinNames(senders.map((p) => p.name)) || 'Your family'} sent you ${waitingNotes.value.length > 1 ? 'messages' : 'a message'}`,
  }
})

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })
const appointment = computed(() => {
  const iso = settings.settings?.nextAppointment
  if (!iso) return null
  const date = new Date(iso)
  const doctor = circle.byId(settings.settings.doctorId) ?? circle.doctor
  if (Number.isNaN(date.getTime())) return { doctor: doctor?.name ?? 'your doctor', when: iso }
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(date) - startOfDay(new Date(now.value))) / 86_400_000)
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : dayFormat.format(date)
  return { doctor: doctor?.name ?? 'your doctor', when: `${day} at ${timeFormat.format(date)}` }
})

/* Starting and answering. `start()` passes through "ringing" for a moment; keep showing the dove meanwhile. */
const starting = ref(false)
async function startTalking() {
  if (starting.value || call.phase !== 'idle') return
  starting.value = true
  try {
    await call.start()
  } finally {
    starting.value = false
  }
}
async function answer() {
  if (starting.value) return
  starting.value = true
  try {
    await call.answer()
  } finally {
    starting.value = false
  }
}
watch(
  () => call.phase,
  (phase) => {
    if (phase !== 'ringing') starting.value = false
  },
)
const stage = computed<'rest' | 'ringing' | 'call' | 'after'>(() => {
  if (call.inCall) return 'call'
  if (call.phase === 'ended') return 'after'
  if (call.phase === 'ringing' && !starting.value) return 'ringing'
  return 'rest'
})

/* "Check in now" from the family makes this phone ring. */
const rungFor = new Set<string>()
watch(
  () => [call.phase, requests.pending('checkin').map((q) => q.id).join()] as const,
  () => {
    const waiting = requests.pending('checkin').filter((q) => !rungFor.has(q.id))
    if (!waiting.length || call.phase === 'ended') return // After a call, wait until she is back to resting.
    if (call.phase === 'idle') call.ring()
    // Already ringing or on the phone: Carrie is with her, so the check-in is happening.
    for (const request of waiting) {
      rungFor.add(request.id)
      void Promise.resolve(requests.markDone(request.id, call.call?.id ?? null)).catch(() => undefined)
    }
  },
  { immediate: true },
)

/* Carrie rings at the agreed time, once a day, while this phone has the app open. */
const RANG_KEY = 'carrie.rang'
usePolling(() => {
  const now = new Date()
  const today = now.toDateString()
  if (call.phase !== 'idle' || now.toTimeString().slice(0, 5) !== settings.settings.callTime.slice(0, 5)) return
  try {
    if (localStorage.getItem(RANG_KEY) === today) return
    localStorage.setItem(RANG_KEY, today)
  } catch {
    // Private mode: she may get a second ring within the same minute.
  }
  call.ring()
}, 10_000)

/* In the call. Tap-to-speak and typing are for calls that are not live; a live call needs no hands. */
const listening = ref(false)
const typed = ref('')
let captioner: Captioner | null = null
let recording: ActiveRecording | null = null

const busy = computed(() => call.thinking || call.carrie === 'speaking')
const avatarState = computed(() => {
  if (call.playingNote) return 'playing'
  if (listening.value) return 'listening'
  if (call.thinking) return 'thinking'
  if (call.phase === 'consent' && call.carrie !== 'speaking') return 'asking'
  return call.carrie
})
const showConsent = computed(() => call.phase === 'consent' && !!call.pendingConsent && !call.liveMode)
const askedNames = computed(() =>
  (call.pendingConsent?.personIds ?? []).map((id) => circle.byId(id)?.name).filter((name): name is string => !!name),
)
const noteVoice = computed(() => {
  const note = call.playingNote
  if (!note) return null
  const name = circle.byId(note.fromId)?.name
  return name ? `${name}'s voice` : 'A message for you'
})
const hint = computed(() => {
  if (call.thinking) return 'Carrie is thinking…'
  if (listening.value) return 'Carrie is listening'
  if (call.carrie === 'speaking') return 'Carrie is talking'
  if (call.liveMode) return call.carrie === 'listening' ? 'Carrie is listening' : 'Just a moment…'
  if (showConsent.value) return recognitionSupported ? 'Tell Carrie, or tap an answer' : 'Tap an answer'
  return recognitionSupported ? 'Your turn. Tap to speak.' : 'Your turn'
})
const doveSize = computed(() => (showConsent.value ? 104 : call.liveMode ? 200 : 148))
const nextDemoLine = computed(() => demoElderLines[call.elderTurns] ?? null)

/**
 * The last things Carrie caught, newest last. Each shows who it is for once Rose has said yes.
 * Two on a live call; one when the speak and type controls already take that room from the captions.
 */
const sharedNames = (fact: Fact) => (fact.sharedWith ?? []).map((id) => circle.byId(id)?.name).filter((name): name is string => !!name)
const chips = computed(() =>
  [...call.callFacts]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(call.liveMode ? -2 : -1)
    .map((fact) => {
      const names = sharedNames(fact)
      return {
        id: fact.id,
        text: fact.statement,
        tag: names.length ? `For ${joinNames(names)}` : fact.consent === 'declined' ? 'Just between us' : '',
        shared: names.length > 0,
      }
    }),
)

async function startListening() {
  stopSpeaking()
  listening.value = true
  call.interim = ''
  captioner = startCaptions((text) => (call.interim = text))
  try {
    recording = recorderSupported ? await startRecording() : null
  } catch {
    recording = null // No microphone permission: captions still work, there is just no clip to play back.
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

const answerConsent = (decision: { family?: boolean; doctor?: boolean }) => call.answerConsent(decision)

function dropMicrophone() {
  captioner?.cancel()
  recording?.cancel()
  captioner = null
  recording = null
  listening.value = false
}

function hangUp() {
  dropMicrophone()
  call.hangUp()
}

/* After the call: what goes to whom. */
const passOn = computed(() => {
  const facts = call.callFacts
  const people = [...circle.family, ...(circle.doctor ? [circle.doctor] : [])]
  const groups = people
    .map((person) => ({
      key: person.id,
      title: `To ${person.name}`,
      color: person.avatarColor,
      facts: facts.filter((f) => (f.sharedWith ?? []).includes(person.id)),
    }))
    .filter((group) => group.facts.length)
  const betweenUs = facts.filter((f) => !(f.sharedWith ?? []).length)
  if (betweenUs.length) groups.push({ key: 'between-us', title: 'Just between us', color: 'var(--color-share-private-fg)', facts: betweenUs })
  return groups
})

onBeforeUnmount(() => {
  clearInterval(ticker)
  dropMicrophone()
  if (call.inCall) call.hangUp()
  else if (call.phase === 'ringing') call.reset()
})
</script>

<template>
  <section class="screen rose" :class="`rose--${stage}`">
    <!-- Resting: the dove, and what is waiting -->
    <div v-if="stage === 'rest'" class="screen__scroll rest">
      <h1 class="rest__greeting">{{ greeting }}</h1>

      <button type="button" class="rest__dove" :disabled="starting" aria-label="Talk with Carrie" @click="startTalking">
        <span class="rest__halo" aria-hidden="true" />
        <CarrieAvatar :state="starting ? 'listening' : 'idle'" :size="228" />
      </button>
      <p class="rest__tap" role="status">{{ starting ? 'Just a moment…' : 'Tap me and talk' }}</p>

      <div class="rest__cards">
        <button v-if="waitingFrom" type="button" class="tile tile--message" :disabled="starting" @click="startTalking">
          <span class="tile__badge tile__badge--play" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <span class="tile__text">
            <strong>{{ waitingFrom.title }}</strong>
            <span>Tap to hear it</span>
          </span>
        </button>

        <div v-if="appointment" class="tile">
          <span class="tile__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z" />
            </svg>
          </span>
          <span class="tile__text">
            <strong>{{ appointment.when }}</strong>
            <span>Your visit with {{ appointment.doctor }}</span>
          </span>
        </div>
      </div>

      <RouterLink to="/rose/shared" class="rest__quiet">What I've shared</RouterLink>
    </div>

    <!-- Incoming: Carrie is calling -->
    <div v-else-if="stage === 'ringing'" class="ring">
      <div class="ring__who">
        <h1 class="ring__title">Carrie is calling</h1>
        <p class="ring__sub">Your AI helper would like a chat</p>
      </div>
      <div class="ring__dove">
        <CarrieAvatar state="waving" :size="236" />
      </div>
      <div class="ring__actions">
        <button type="button" class="btn btn--accent btn--big btn--block ring__answer" :disabled="starting" @click="answer">
          <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z" />
          </svg>
          Answer
        </button>
        <button type="button" class="btn btn--big btn--block" @click="call.reset()">Not now</button>
      </div>
    </div>

    <!-- In the call -->
    <template v-else-if="stage === 'call'">
      <header class="oncall__top">
        <p class="oncall__status">
          <span class="oncall__live" aria-hidden="true" />
          On the phone with Carrie · <span class="oncall__clock">{{ clock }}</span>
        </p>
        <CarrieAvatar :state="avatarState" :size="doveSize" />
        <p v-if="noteVoice" class="oncall__voice" role="status">
          <span class="oncall__bars" aria-hidden="true"><i /><i /><i /><i /></span>
          {{ noteVoice }}
        </p>
        <p v-else class="oncall__hint" role="status">{{ hint }}</p>
      </header>

      <CaptionStream class="oncall__captions" :utterances="call.utterances" :interim="call.interim" :names="namesById" />

      <TransitionGroup v-if="!showConsent" tag="ul" name="chip" class="oncall__chips" aria-label="What Carrie will remember">
        <li v-for="chip in chips" :key="chip.id" class="chip" :class="{ 'chip--shared': chip.shared }">
          <svg viewBox="0 0 24 24" class="chip__tick" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
          <span class="chip__text">
            {{ chip.text }}
            <strong v-if="chip.tag" class="chip__tag">{{ chip.tag }}</strong>
          </span>
        </li>
      </TransitionGroup>

      <footer class="oncall__controls">
        <p v-if="call.error" class="oncall__error" role="alert">{{ call.error }}</p>

        <!-- On a live call Rose answers out loud, like any phone call: nothing to press but the hang-up. -->
        <template v-if="!call.liveMode">
          <ConsentPrompt
            v-if="showConsent && call.pendingConsent"
            :question="call.pendingConsent.question"
            :audience="call.pendingConsent.audience"
            :names="askedNames"
            :also-name="(call.pendingConsent.audience === 'doctor' ? settings.mainContact?.name : circle.doctor?.name) ?? undefined"
            :disabled="busy || listening"
            @answer="answerConsent"
          />

          <div class="oncall__row">
            <button
              v-if="recognitionSupported"
              type="button"
              class="btn btn--big oncall__speak"
              :class="listening ? 'btn--accent' : 'btn--primary'"
              :disabled="busy && !listening"
              @click="listening ? stopListening() : startListening()"
            >
              <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.3-3a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 6 6.72V21h2v-3.28A7 7 0 0 0 19 11h-1.7z" />
              </svg>
              {{ listening ? "I'm done talking" : 'Tap to speak' }}
            </button>
            <button type="button" class="btn btn--danger btn--big oncall__hangup" :class="{ 'oncall__hangup--wide': !recognitionSupported }" @click="hangUp">
              <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1a1 1 0 0 1-.56.9c-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.41-.01L.29 13.08a1 1 0 0 1 0-1.41A16.94 16.94 0 0 1 12 7c4.54 0 8.66 1.78 11.71 4.67a1 1 0 0 1 0 1.42l-2.48 2.48a1 1 0 0 1-1.41 0c-.79-.73-1.69-1.36-2.67-1.85a1 1 0 0 1-.56-.9v-3.1A15.1 15.1 0 0 0 12 9z" />
              </svg>
              Hang up
            </button>
          </div>

          <details class="oncall__typed" :open="!recognitionSupported">
            <summary>Type instead</summary>
            <form class="oncall__form" @submit.prevent="sendTyped()">
              <input v-model="typed" class="input oncall__input" type="text" :placeholder="`What ${circle.elder.name} says…`" :disabled="busy" />
              <button type="submit" class="btn oncall__send" :disabled="busy || !typed.trim()">Send</button>
            </form>
            <button v-if="nextDemoLine" type="button" class="btn btn--ghost btn--block oncall__demo" :disabled="busy" @click="sendTyped(nextDemoLine)">
              Demo line: “{{ nextDemoLine }}”
            </button>
          </details>
        </template>

        <button v-else type="button" class="btn btn--danger btn--big btn--block oncall__hangup oncall__hangup--live" @click="hangUp">
          <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1a1 1 0 0 1-.56.9c-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.41-.01L.29 13.08a1 1 0 0 1 0-1.41A16.94 16.94 0 0 1 12 7c4.54 0 8.66 1.78 11.71 4.67a1 1 0 0 1 0 1.42l-2.48 2.48a1 1 0 0 1-1.41 0c-.79-.73-1.69-1.36-2.67-1.85a1 1 0 0 1-.56-.9v-3.1A15.1 15.1 0 0 0 12 9z" />
          </svg>
          Hang up
        </button>
      </footer>
    </template>

    <!-- After the call: what goes to whom -->
    <template v-else>
      <div class="screen__scroll after">
        <CarrieAvatar :state="passOn.length ? 'sending' : 'keeping'" :size="124" />
        <h1 class="after__title">{{ passOn.length ? "Here's what I'll pass on" : 'Lovely talking with you' }}</h1>
        <p v-if="call.error" class="oncall__error" role="alert">{{ call.error }}</p>
        <p v-if="!passOn.length" class="after__none">I have nothing to pass on this time.</p>

        <section v-for="group in passOn" :key="group.key" class="after__group">
          <h2 class="after__to">
            <span class="after__dot" :style="{ background: group.color }" aria-hidden="true" />
            {{ group.title }}
          </h2>
          <ul class="after__list">
            <li v-for="fact in group.facts" :key="fact.id" class="after__item">{{ fact.statement }}</li>
          </ul>
        </section>
      </div>
      <footer class="after__foot">
        <button type="button" class="btn btn--primary btn--big btn--block" @click="call.reset()">Thank you, Carrie</button>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.rose {
  gap: 0;
  padding: 0;
  font-size: var(--text-lg);
  background: linear-gradient(to bottom, var(--color-surface), var(--color-bg) 46%);
}

.icon {
  flex: none;
  width: 28px;
  height: 28px;
  fill: currentColor;
}

/* Resting */
.rest {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-5) var(--space-5);
  text-align: center;
}

.rest__greeting {
  font-size: var(--text-2xl);
}

.rest__dove {
  position: relative;
  display: grid;
  place-items: center;
  margin-top: var(--space-2);
  padding: var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  transition: transform var(--duration-fast) var(--ease);
}

.rest__dove:active {
  transform: scale(0.97);
}

.rest__halo {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  animation: halo 3.2s ease-in-out infinite;
}

.rest__tap {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  color: var(--color-primary);
}

.rest__cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  margin-top: var(--space-2);
}

.tile {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  min-height: 84px;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: var(--text-lg);
  line-height: 1.25;
  text-align: left;
}

.tile--message {
  border: 2px solid var(--color-accent);
  background: var(--color-accent-soft);
}

.tile__badge {
  display: grid;
  flex: none;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.tile__badge--play {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.tile__badge svg {
  width: 28px;
  height: 28px;
  fill: currentColor;
}

.tile__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tile__text strong {
  font-weight: var(--weight-bold);
}

.rest__quiet {
  display: inline-flex;
  align-items: center;
  min-height: 56px;
  margin-top: auto;
  padding: 0 var(--space-5);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* Incoming */
.ring {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-height: 0;
  padding: var(--space-10) var(--space-5) var(--space-6);
  text-align: center;
}

.ring__title {
  font-size: var(--text-2xl);
}

.ring__sub {
  margin-top: var(--space-2);
  font-size: var(--text-lg);
  color: var(--color-text-muted);
}

.ring__dove {
  animation: ring-shake 1.6s var(--ease) infinite;
}

.ring__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

.ring__answer {
  min-height: 76px;
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  animation: answer-pulse 1.6s ease-in-out infinite;
}

/* In the call */
.oncall__top {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4) 0;
  text-align: center;
}

.oncall__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
}

.oncall__live {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  animation: live-dot 1.4s ease-in-out infinite;
}

.oncall__clock {
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-bold);
}

.oncall__hint,
.oncall__voice {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--color-primary);
}

.oncall__voice {
  padding: var(--space-1) var(--space-5);
  border-radius: var(--radius-pill);
  background: var(--color-accent-soft);
  color: var(--color-share-family-fg);
}

.oncall__bars {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
}

.oncall__bars i {
  width: 4px;
  height: 100%;
  border-radius: var(--radius-pill);
  background: currentColor;
  animation: bars 0.9s ease-in-out infinite;
}

.oncall__bars i:nth-child(2) {
  animation-delay: 0.15s;
}

.oncall__bars i:nth-child(3) {
  animation-delay: 0.3s;
}

.oncall__bars i:nth-child(4) {
  animation-delay: 0.45s;
}

.oncall__captions {
  flex: 1 1 0;
  margin: 0 var(--space-4);
}

.oncall__chips {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4) 0;
}

.chip {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-4) var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: 1.25;
}

.chip--shared {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.chip__tick {
  flex: none;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  fill: var(--color-primary);
}

.chip__tag {
  display: block;
  font-weight: var(--weight-bold);
  color: var(--color-share-family-fg);
}

.chip:not(.chip--shared) .chip__tag {
  color: var(--color-share-private-fg);
}

.chip-enter-active,
.chip-leave-active,
.chip-move {
  transition:
    opacity var(--duration-slow) var(--ease),
    transform var(--duration-slow) var(--ease);
}

.chip-enter-from {
  opacity: 0;
  transform: translateY(var(--space-4)) scale(0.94);
}

.chip-leave-to {
  opacity: 0;
}

.chip-leave-active {
  position: absolute;
  visibility: hidden;
}

.oncall__controls {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-5);
}

.oncall__error {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  color: var(--color-danger);
  text-align: center;
}

.oncall__row {
  display: flex;
  gap: var(--space-3);
}

.oncall__speak {
  flex: 1;
  padding-inline: var(--space-4);
}

.oncall__hangup {
  flex: none;
  padding-inline: var(--space-5);
}

.oncall__hangup--wide {
  flex: 1;
}

.oncall__hangup--live {
  min-height: 76px;
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
}

.oncall__typed summary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  font-size: var(--text-lg);
  color: var(--color-text-muted);
  text-decoration: underline;
  text-underline-offset: 4px;
  list-style: none;
  cursor: pointer;
}

.oncall__typed summary::-webkit-details-marker {
  display: none;
}

.oncall__form {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.oncall__input,
.oncall__send {
  min-height: 56px;
  font-size: var(--text-lg);
}

/* For whoever is presenting, not for Rose: the next line of the scripted demo. */
.oncall__demo {
  margin-top: var(--space-2);
  min-height: 56px;
  border-style: dashed;
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  text-align: left;
}

/* After the call */
.after {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-5) var(--space-4);
}

.after__title {
  font-size: var(--text-xl);
  text-align: center;
}

.after__none {
  font-size: var(--text-lg);
  text-align: center;
}

.after__group {
  width: 100%;
}

.after__to {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  font-size: var(--text-lg);
}

.after__dot {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-pill);
}

.after__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.after__item {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: 1.3;
}

.after__foot {
  flex: none;
  padding: var(--space-3) var(--space-4) var(--space-5);
}

@keyframes halo {
  50% {
    transform: scale(1.04);
  }
}

@keyframes ring-shake {
  0%,
  40%,
  100% {
    transform: rotate(0);
  }
  8%,
  24% {
    transform: rotate(-4deg);
  }
  16%,
  32% {
    transform: rotate(4deg);
  }
}

@keyframes answer-pulse {
  50% {
    transform: scale(1.03);
  }
}

@keyframes live-dot {
  50% {
    opacity: 0.35;
  }
}

@keyframes bars {
  0%,
  100% {
    transform: scaleY(0.35);
  }
  50% {
    transform: scaleY(1);
  }
}
</style>

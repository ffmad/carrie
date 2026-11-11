<script lang="ts">
import { reactive } from 'vue'

/** Questions put to Carrie in this sitting, per person, kept while moving between tabs. */
interface Asked {
  id: string
  at: string
  question: string
  passedOn: boolean
}
const askedBy = reactive<Record<string, Asked[]>>({})
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CarrieAvatar from '../../components/CarrieAvatar.vue'
import FamilyVoiceCall from '../../components/FamilyVoiceCall.vue'
import FactCard from '../../components/FactCard.vue'
import ReceiptPlayer from '../../components/ReceiptPlayer.vue'
import VoiceNoteRecorder from '../../components/VoiceNoteRecorder.vue'
import { answer } from '../../lib/answer'
import { formatDay } from '../../lib/format'
import type { Recording } from '../../lib/recorder'
import { clipUrl } from '../../lib/supabase'
import { useCallsStore } from '../../stores/calls'
import { useCircleStore } from '../../stores/circle'
import { useFactsStore } from '../../stores/facts'
import { useRequestsStore } from '../../stores/requests'
import { useSettingsStore } from '../../stores/settings'
import { useVoiceNotesStore } from '../../stores/voiceNotes'
import type { CareRequest, Fact, VoiceNote } from '../../types'

/**
 * The conversation with Carrie, built from data: what she passed on after each call,
 * the viewer's recordings and requests, and Rose's answers. Only what Rose shared
 * with this person ever appears here.
 */
const circle = useCircleStore()
const calls = useCallsStore()
const facts = useFactsStore()
const voiceNotes = useVoiceNotesStore()
const requests = useRequestsStore()
const settings = useSettingsStore()

const viewer = computed(() => circle.viewer)
const elder = computed(() => circle.elder)
const her = computed(() => (/grand/i.test(viewer.value.relation) ? 'Grandma' : 'Mum'))
const callTime = computed(() => (settings.settings?.callTime ?? '10:00').slice(0, 5))

/** Everything this person may see, and nothing else. */
const mine = computed<Fact[]>(() => facts.sharedWith(viewer.value.id))

const timeFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('en', { weekday: 'long' })

/** "this morning", "yesterday afternoon", "on Tuesday". */
function when(iso: string): string {
  const date = new Date(iso)
  const day = formatDay(iso)
  const part = date.getHours() < 12 ? 'morning' : date.getHours() < 18 ? 'afternoon' : 'evening'
  if (day === 'Today') return `this ${part}`
  if (day === 'Yesterday') return `yesterday ${part}`
  return `on ${day}`
}

/** "today's", "yesterday's", "Tuesday's". */
function callDay(iso: string): string {
  const day = formatDay(iso)
  if (day === 'Today') return "today's"
  if (day === 'Yesterday') return "yesterday's"
  return `${weekdayFormat.format(new Date(iso))}'s`
}

interface Entry {
  key: string
  at: string
  side: 'carrie' | 'me'
  text?: string
  label?: string
  facts?: Fact[]
  note?: VoiceNote
  noteSpeaker?: string
  status?: string
  /** Carrie offers to put this question to Rose on the next call. */
  offer?: Asked
}

function requestReply(request: CareRequest): string {
  if (request.kind === 'checkin') {
    const talked = calls.ended.some((call) => call.startedAt > request.createdAt)
    return talked ? `I rang her and we talked.` : 'Calling her now.'
  }
  const verb = request.kind === 'ask' ? 'ask' : 'tell'
  if (request.status === 'pending') return `I'll ${verb} her on the next call at ${callTime.value}.`
  const handled = request.handledCallId ? calls.byId(request.handledCallId) : null
  const past = request.kind === 'ask' ? 'asked' : 'told'
  return handled ? `I ${past} her on ${callDay(handled.startedAt)} call.` : `I ${past} her.`
}

const entries = computed<Entry[]>(() => {
  const me = viewer.value
  const out: Entry[] = []

  for (const call of calls.ended) {
    const shared = mine.value
      .filter((fact) => fact.callId === call.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    out.push({
      key: `call-${call.id}`,
      at: call.endedAt ?? call.startedAt,
      side: 'carrie',
      text: shared.length
        ? `I spoke with ${her.value} ${when(call.startedAt)}, at ${timeFormat.format(new Date(call.startedAt))}. She said I could tell you this.`
        : `I spoke with ${her.value} ${when(call.startedAt)}, at ${timeFormat.format(new Date(call.startedAt))}. Nothing to pass on to you from that one.`,
      facts: shared,
    })
  }

  for (const note of voiceNotes.involving(me.id)) {
    if (note.fromId === me.id) {
      out.push({
        key: `note-${note.id}`,
        at: note.createdAt,
        side: 'me',
        label: `Your message for ${her.value}`,
        note,
        noteSpeaker: 'yourself',
        status: note.deliveredAt ? `Played to her · ${formatDay(note.deliveredAt)}` : 'Carrie plays it on the next call',
      })
    } else if (note.toId === me.id) {
      const from = circle.byId(note.fromId)
      const fromHer = note.fromId === elder.value.id
      out.push({
        key: `note-${note.id}`,
        at: note.createdAt,
        side: 'carrie',
        text: fromHer
          ? note.inReplyTo
            ? 'She answered you. Here she is.'
            : `${her.value} recorded this for you.`
          : `${from?.name ?? 'Someone'} left you this.`,
        note,
        noteSpeaker: fromHer ? elder.value.name : (from?.name ?? 'them'),
      })
    }
  }

  for (const request of requests.from(me.id)) {
    out.push({
      key: `request-${request.id}`,
      at: request.createdAt,
      side: 'me',
      label: request.kind === 'ask' ? `Ask ${her.value}` : request.kind === 'tell' ? `Tell ${her.value}` : undefined,
      text: request.kind === 'checkin' ? `Can you check in on ${her.value} now?` : request.text,
    })
    out.push({ key: `request-${request.id}-reply`, at: request.createdAt, side: 'carrie', text: requestReply(request) })
  }

  for (const asked of askedBy[me.id] ?? []) {
    // Matched again each time, so something Rose takes back disappears from here too.
    const found = answer(asked.question, mine.value).slice(0, 3)
    out.push({ key: `asked-${asked.id}`, at: asked.at, side: 'me', text: asked.question })
    out.push({
      key: `asked-${asked.id}-reply`,
      at: asked.at,
      side: 'carrie',
      text: found.length
        ? found.length === 1
          ? 'She told me this.'
          : 'Here is what she told me.'
        : asked.passedOn
          ? "She hasn't mentioned that to me."
          : "She hasn't mentioned that to me. Shall I ask her?",
      facts: found,
      offer: !found.length && !asked.passedOn ? asked : undefined,
    })
  }

  // Oldest first; entries made together keep the order they were added in.
  return out
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.at.localeCompare(b.entry.at) || a.index - b.index)
    .map(({ entry }) => entry)
})

/** A quiet day line wherever the day changes. */
const rows = computed(() =>
  entries.value.map((entry, index) => {
    const previous = entries.value[index - 1]
    const day = formatDay(entry.at)
    return {
      entry,
      day: !previous || formatDay(previous.at) !== day ? day : null,
      // Show the dove once per run of Carrie's bubbles, as chat apps do.
      showDove: entry.side === 'carrie' && (!previous || previous.side !== 'carrie' || formatDay(previous.at) !== day),
    }
  }),
)

/* Scrolling: newest at the bottom, on open and whenever something arrives. */
const scroller = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
/** True while the reader is at the bottom, so late layout (fonts, cards) keeps them there. */
let pinned = true
let observer: ResizeObserver | null = null

function toNewest(smooth = false) {
  const el = scroller.value
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}
function scrollToNewest(smooth = false) {
  pinned = true
  void nextTick(() => toNewest(smooth))
}
let lastTop = 0
function onScroll() {
  const el = scroller.value
  if (!el) return
  // Only the reader scrolling up lets go of the bottom; our own scrolling never does.
  if (el.scrollHeight - el.clientHeight - el.scrollTop < 80) pinned = true
  else if (el.scrollTop < lastTop - 2) pinned = false
  lastTop = el.scrollTop
}

/** While the conversation is still loading in, jump; glide only for what arrives later. */
let settled = false
let settleTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  scrollToNewest()
  settleTimer = setTimeout(() => (settled = true), 1500)
  if (typeof ResizeObserver !== 'undefined' && list.value && scroller.value) {
    observer = new ResizeObserver(() => {
      if (pinned) toNewest()
    })
    observer.observe(list.value)
    observer.observe(scroller.value)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(settleTimer)
})
watch(
  () => entries.value.map((entry) => `${entry.key}:${entry.facts?.length ?? 0}`).join('|'),
  () => scrollToNewest(settled),
)

/* Composer */
type Mode = 'carrie' | 'ask' | 'tell'
const mode = ref<Mode>('carrie')
const draft = ref('')
const recording = ref(false)
const busy = ref(false)
const problem = ref<string | null>(null)

const modes = computed<{ key: Mode; label: string }[]>(() => [
  { key: 'carrie', label: 'Ask Carrie' },
  { key: 'ask', label: 'Ask her' },
  { key: 'tell', label: 'Tell her' },
])

const placeholder = computed(() =>
  mode.value === 'carrie'
    ? `How is ${her.value} sleeping?`
    : mode.value === 'ask'
      ? `What should Carrie ask ${her.value}?`
      : `What should Carrie tell ${her.value}?`,
)

async function addRequest(kind: 'ask' | 'tell' | 'checkin', text?: string) {
  problem.value = null
  busy.value = true
  try {
    await requests.add({ fromId: viewer.value.id, kind, text })
  } catch {
    problem.value = 'That did not go through. Please try again.'
  } finally {
    busy.value = false
  }
}

async function submit() {
  const text = draft.value.trim()
  if (!text || busy.value) return
  draft.value = ''
  if (mode.value === 'carrie') {
    const questions = (askedBy[viewer.value.id] ??= [])
    questions.push({ id: crypto.randomUUID(), at: new Date().toISOString(), question: text, passedOn: false })
    return
  }
  await addRequest(mode.value, text)
}

async function passOn(asked: Asked) {
  asked.passedOn = true
  await addRequest('ask', asked.question)
}

const checkingIn = computed(() => requests.pending('checkin').some((request) => request.fromId === viewer.value.id))

/* Talking to Carrie by voice: she is given only what Rose shared with this person. */
const talking = ref(false)

function checkIn() {
  if (checkingIn.value || busy.value) return
  void addRequest('checkin')
}

async function sendNote(payload: { recording: Recording; transcript: string }) {
  problem.value = null
  try {
    await voiceNotes.send({ fromId: viewer.value.id, toId: elder.value.id, ...payload })
  } catch {
    problem.value = 'Your recording did not send. Please try again.'
  }
}
</script>

<template>
  <div class="chat">
    <FamilyVoiceCall v-if="talking" :her="her" @close="talking = false" />
    <div ref="scroller" class="screen__scroll chat__scroll" @scroll.passive="onScroll">
      <div ref="list" class="chat__list">
      <div class="chat__intro">
        <CarrieAvatar :size="88" />
        <p class="chat__intro-title">Carrie, with {{ elder.name }} every day</p>
        <p class="muted small">
          I'm an AI helper. I only pass on what {{ her }} says I can, and you can always hear her say it.
        </p>
      </div>

      <template v-for="row in rows" :key="row.entry.key">
        <p v-if="row.day" class="chat__day">{{ row.day }}</p>

        <div v-if="row.entry.side === 'carrie'" class="line line--carrie">
          <span class="line__dove">
            <CarrieAvatar v-if="row.showDove" :size="36" />
          </span>
          <div class="line__body">
            <div class="bubble bubble--carrie">
              <p>{{ row.entry.text }}</p>
              <ReceiptPlayer
                v-if="row.entry.note"
                class="bubble__player"
                :src="clipUrl(row.entry.note.audioPath)"
                :quote="row.entry.note.transcript ?? ''"
                :speaker="row.entry.noteSpeaker"
              />
              <p v-if="row.entry.note?.transcript" class="bubble__words">“{{ row.entry.note.transcript }}”</p>
              <button
                v-if="row.entry.offer"
                type="button"
                class="btn btn--primary bubble__action"
                :disabled="busy"
                @click="passOn(row.entry.offer)"
              >
                Yes, ask her
              </button>
            </div>
            <FactCard
              v-for="fact in row.entry.facts"
              :key="fact.id"
              :fact="fact"
              :show-share="false"
              :show-meta="false"
              class="line__card"
            />
          </div>
        </div>

        <div v-else class="line line--me">
          <div class="bubble bubble--me">
            <p v-if="row.entry.label" class="bubble__label">{{ row.entry.label }}</p>
            <p v-if="row.entry.text">{{ row.entry.text }}</p>
            <template v-if="row.entry.note">
              <p v-if="row.entry.note.transcript" class="bubble__words">“{{ row.entry.note.transcript }}”</p>
              <ReceiptPlayer
                class="bubble__player"
                :src="clipUrl(row.entry.note.audioPath)"
                :quote="row.entry.note.transcript ?? ''"
                :speaker="row.entry.noteSpeaker"
              />
            </template>
          </div>
          <p v-if="row.entry.status" class="line__status">{{ row.entry.status }}</p>
        </div>
      </template>

      <p v-if="!entries.length" class="chat__empty muted">
        Nothing yet. After Carrie's next call with {{ her }}, what she agrees to share with you shows up here.
      </p>
      </div>
    </div>

    <div class="composer">
      <p v-if="problem" class="composer__problem small" role="alert">{{ problem }}</p>

      <VoiceNoteRecorder v-if="recording" :to-name="her" autostart @send="sendNote" @close="recording = false" />

      <template v-else>
        <div class="composer__top">
          <div class="chips" role="tablist" aria-label="Who is this for">
            <button
              v-for="option in modes"
              :key="option.key"
              type="button"
              role="tab"
              class="chip"
              :class="{ 'chip--on': mode === option.key }"
              :aria-selected="mode === option.key"
              @click="mode = option.key"
            >
              {{ option.label }}
            </button>
          </div>
          <button type="button" class="checkin" @click="talking = true">Talk</button>
          <button type="button" class="checkin" :disabled="checkingIn || busy" @click="checkIn">
            <svg viewBox="0 0 24 24" class="checkin__icon" aria-hidden="true">
              <path d="M6.600 3h3l1.500 4.500-2 1.500a12 12 0 0 0 5.900 5.900l1.500-2 4.500 1.500v3a2 2 0 0 1-2.200 2A16.500 16.500 0 0 1 4.600 5.200 2 2 0 0 1 6.600 3z" />
            </svg>
            {{ checkingIn ? 'Calling…' : 'Check in now' }}
          </button>
        </div>

        <form class="composer__row" @submit.prevent="submit">
          <input v-model="draft" class="input composer__input" type="text" :placeholder="placeholder" :aria-label="placeholder" enterkeyhint="send" />
          <button
            v-if="!draft.trim()"
            type="button"
            class="round round--mic"
            :aria-label="`Record a message for ${her}`"
            @click="recording = true"
          >
            <svg viewBox="0 0 24 24" class="round__icon" aria-hidden="true">
              <path d="M12 15a3.500 3.500 0 0 0 3.500-3.500v-5a3.500 3.500 0 0 0-7 0v5A3.500 3.500 0 0 0 12 15zm6-3.500a6 6 0 0 1-12 0H4.500a7.500 7.500 0 0 0 6.700 7.400V21.500h1.600v-2.600a7.500 7.500 0 0 0 6.700-7.400z" />
            </svg>
          </button>
          <button v-else type="submit" class="round round--send" aria-label="Send" :disabled="busy">
            <svg viewBox="0 0 24 24" class="round__icon" aria-hidden="true"><path d="M4 20.500 21 12 4 3.500v6.600l10 1.900-10 1.900z" /></svg>
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chat__scroll {
  padding: var(--space-4) var(--space-3);
}

.chat__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chat__intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-6) var(--space-3);
  text-align: center;
}

.chat__intro-title {
  font-weight: var(--weight-bold);
}

.chat__day {
  align-self: center;
  margin-top: var(--space-3);
  padding: 2px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-surface-alt);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-text-muted);
}

.chat__empty {
  padding: var(--space-6);
  text-align: center;
}

.line {
  display: flex;
  gap: var(--space-2);
  animation: line-in var(--duration-slow) var(--ease);
}

.line--carrie {
  align-items: flex-start;
  padding-right: var(--space-6);
}

.line--me {
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  padding-left: var(--space-10);
}

.line__dove {
  flex: none;
  width: 36px;
  height: 36px;
}

.line__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.line__card {
  align-self: stretch;
  padding: var(--space-3);
}

.line__status {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.bubble {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  overflow-wrap: anywhere;
}

.bubble--carrie {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top-left-radius: var(--space-1);
}

.bubble--me {
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  border-bottom-right-radius: var(--space-1);
}

.bubble__label {
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.8;
}

.bubble__words {
  font-style: italic;
  font-size: var(--text-sm);
}

.bubble--carrie .bubble__words {
  color: var(--color-text-muted);
}

.bubble__action {
  align-self: flex-start;
  min-height: 40px;
}

/* The player sits on a light pill so it reads on the blue bubble too. */
.bubble--me .bubble__player {
  padding: var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
}

.composer {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3) var(--space-3);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.composer__problem {
  color: var(--color-danger);
}

.composer__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.chips {
  display: flex;
  gap: var(--space-1);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.chip {
  flex: none;
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  white-space: nowrap;
  transition:
    background var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.chip--on {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.checkin {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-pill);
  background: var(--color-accent-soft);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  color: var(--color-share-family-fg);
  white-space: nowrap;
}

.checkin:disabled {
  opacity: 0.6;
  cursor: default;
}

.checkin__icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

@media (max-width: 380px) {
  .checkin__icon {
    display: none;
  }
}

.composer__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.composer__input {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-pill);
  background: var(--color-bg);
}

.round {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--tap-min);
  height: var(--tap-min);
  border: 0;
  border-radius: var(--radius-pill);
  transition: transform var(--duration-fast) var(--ease);
}

.round:active {
  transform: scale(0.94);
}

.round--mic {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.round--send {
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}

.round__icon {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

@keyframes line-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

.chat {
  position: relative;
}

/* Room for the mode chips and the two calls to Carrie on a narrow phone. */
.composer__top {
  flex-wrap: wrap;
  row-gap: var(--space-2);
}
</style>

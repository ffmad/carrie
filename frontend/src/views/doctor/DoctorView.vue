<script setup lang="ts">
import { computed, onMounted } from 'vue'
import CarrieAvatar from '../../components/CarrieAvatar.vue'
import CarrieLogo from '../../components/CarrieLogo.vue'
import DoctorFactRow from '../../components/DoctorFactRow.vue'
import DoctorRequestBox from '../../components/DoctorRequestBox.vue'
import { CATEGORY_LABELS } from '../../lib/format'
import { useCallsStore } from '../../stores/calls'
import { useCircleStore } from '../../stores/circle'
import { useFactsStore } from '../../stores/facts'
import { useSettingsStore } from '../../stores/settings'
import type { Call, Fact, FactCategory } from '../../types'

/**
 * Dr. Chen's page: one screen to read before the appointment, built only from
 * the facts the patient agreed to share with the doctor.
 */
const circle = useCircleStore()
const facts = useFactsStore()
const calls = useCallsStore()
const settings = useSettingsStore()

onMounted(() => circle.viewAs('dr-chen'))

const patient = computed(() => circle.elder)
const age = computed(() => patient.value.relation.match(/\d{2,3}/)?.[0] ?? null)

/** Only what was shared with this doctor, newest first. */
const shared = computed<Fact[]>(() => (circle.doctor ? facts.sharedWith(circle.doctor.id) : []))

/* Dates */
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => shortDate.format(new Date(iso))
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

const appointment = computed(() => {
  const value = settings.settings.nextAppointment
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  // A date without a time ("2026-11-12") has no hour worth showing.
  return value.length <= 10 ? longDate.format(date) : `${longDate.format(date)}, ${clock.format(date)}`
})

const lastCall = computed(() => (calls.latest ? day(calls.latest.startedAt) : null))

const coverage = computed(() => {
  const items = shared.value
  if (!items.length) return null
  const callCount = new Set(items.map((fact) => fact.callId)).size
  const newest = day(items[0]!.createdAt)
  const oldest = day(items[items.length - 1]!.createdAt)
  const span = newest === oldest ? newest : `${oldest} to ${newest}`
  return `${items.length} ${items.length === 1 ? 'item' : 'items'} from ${callCount} ${callCount === 1 ? 'call' : 'calls'}, ${span}`
})

/* "Since the last visit": health and medication first; repeats of the same thing are grouped. */
const ORDER: FactCategory[] = ['health', 'medication', 'daily', 'mood', 'social', 'request']

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'around', 'been', 'before', 'being', 'does', 'feels', 'felt', 'from', 'gets', 'have',
  'having', 'into', 'just', 'like', 'more', 'much', 'over', 'said', 'says', 'since', 'some', 'still', 'than', 'that',
  'them', 'then', 'they', 'this', 'very', 'want', 'wants', 'were', 'when', 'will', 'with', 'would',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'today', 'yesterday', 'tomorrow',
  'morning', 'afternoon', 'evening', 'evenings', 'night', 'nights', 'week', 'weeks', 'days',
])

/** Rough stem, so "hurts", "hurting" and "hurt" count as the same word. */
const stem = (word: string) => {
  const cut = word.replace(/(ing|ed|es|s)$/, '')
  return (cut.length >= 3 ? cut : word).replace(/(.)\1$/, '$1')
}

function keyWords(fact: Fact): Set<string> {
  const words = fact.statement.toLowerCase().match(/[a-z]{4,}/g) ?? []
  return new Set(words.filter((word) => !STOP_WORDS.has(word)).map(stem))
}

/** Facts of one category that share a key word end up in the same group. Input is newest first. */
function groupRepeats(items: Fact[]): Fact[][] {
  const groups: { words: Set<string>; facts: Fact[] }[] = []
  for (const fact of items) {
    const words = keyWords(fact)
    const matches = groups.filter((group) => [...words].some((word) => group.words.has(word)))
    const home = matches[0]
    if (!home) {
      groups.push({ words, facts: [fact] })
      continue
    }
    home.facts.push(fact)
    words.forEach((word) => home.words.add(word))
    for (const other of matches.slice(1)) {
      home.facts.push(...other.facts)
      other.words.forEach((word) => home.words.add(word))
      groups.splice(groups.indexOf(other), 1)
    }
  }
  return groups.map((group) => group.facts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

const sections = computed(() =>
  ORDER.map((category) => {
    const items = shared.value.filter((fact) => fact.category === category)
    return {
      category,
      count: items.length,
      groups: groupRepeats(items).map((group) => ({
        id: group[0]!.id,
        facts: group,
        // Oldest first reads as a timeline: "4 Nov, 8 Nov, 10 Nov".
        dates: [...group].reverse().map((fact) => day(fact.createdAt)).join(', '),
      })),
    }
  }).filter((section) => section.count > 0),
)

/* 14-day strip: self-reported missed doses, by the day she mentioned them. */
const MISSED = /\b(miss(ed|es|ing)?|skip(ped|s|ping)?|forg[oe]t(s|ting)?|did ?n[o']t take|not taken|ran out)\b/i

type DayState = 'missed' | 'noted' | 'clear' | 'nocall'

const strip = computed(() => {
  const medication = shared.value.filter((fact) => fact.category === 'medication')
  const callDays = new Set(calls.calls.map((call: Call) => dayKey(new Date(call.startedAt))))
  const today = new Date()
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (13 - index))
    const key = dayKey(date)
    const onDay = medication.filter((fact) => dayKey(new Date(fact.createdAt)) === key)
    const state: DayState = onDay.some((fact) => MISSED.test(`${fact.statement} ${fact.quote}`))
      ? 'missed'
      : onDay.length
        ? 'noted'
        : callDays.has(key)
          ? 'clear'
          : 'nocall'
    const label = {
      missed: 'missed dose reported',
      noted: 'medication mentioned, no missed dose',
      clear: 'call, no missed dose shared',
      nocall: 'no call',
    }[state]
    return { key, number: date.getDate(), state, title: `${shortDate.format(date)}: ${label}` }
  })
})

const missedDays = computed(() => strip.value.filter((entry) => entry.state === 'missed').length)
const hasNoted = computed(() => strip.value.some((entry) => entry.state === 'noted'))
</script>

<template>
  <section class="screen doctor">
    <header class="doctor__bar">
      <span class="doctor__brand">
        <CarrieAvatar state="idle" :size="30" />
        <CarrieLogo :size="16" />
      </span>
      <span class="eyebrow">Pre-visit summary</span>
    </header>

    <div class="screen__scroll doctor__scroll">
      <header class="doctor__patient">
        <h1 class="doctor__name">
          {{ patient.name }}<span v-if="age" class="doctor__age">, {{ age }}</span>
        </h1>
        <dl class="doctor__meta">
          <div>
            <dt>Appointment</dt>
            <dd>{{ appointment }}</dd>
          </div>
          <div v-if="circle.doctor">
            <dt>For</dt>
            <dd>{{ circle.doctor.name }}</dd>
          </div>
          <div v-if="lastCall">
            <dt>Last call</dt>
            <dd>{{ lastCall }}</dd>
          </div>
        </dl>
        <p class="doctor__notice">
          Self-reported by {{ patient.name }} on phone calls with Carrie, an AI helper. Contains only what she agreed to
          share with her doctor. Not a medical record.
        </p>
      </header>

      <section class="doctor__section" aria-labelledby="doctor-since">
        <div class="doctor__heading">
          <h2 id="doctor-since">Since the last visit</h2>
          <p v-if="coverage" class="doctor__sub">{{ coverage }}</p>
        </div>

        <p v-if="!sections.length" class="doctor__empty">
          {{ patient.name }} has not agreed to share anything with her doctor yet.
        </p>

        <section v-for="section in sections" :key="section.category" class="doctor__category">
          <h3 class="doctor__category-title">
            <span>{{ CATEGORY_LABELS[section.category] }}</span>
            <span class="doctor__count">{{ section.count }}</span>
          </h3>
          <div v-for="group in section.groups" :key="group.id" class="doctor__group">
            <p v-if="group.facts.length > 1" class="doctor__repeat">
              Reported {{ group.facts.length }} times: {{ group.dates }}
            </p>
            <DoctorFactRow
              v-for="fact in group.facts"
              :key="fact.id"
              :fact="fact"
              :src="facts.receiptUrl(fact)"
              :speaker="patient.name"
            />
          </div>
        </section>
      </section>

      <section class="doctor__section" aria-labelledby="doctor-doses">
        <div class="doctor__heading">
          <h2 id="doctor-doses">Missed doses, last 14 days</h2>
          <p class="doctor__sub">
            {{
              missedDays
                ? `Self-reported on ${missedDays} of 14 days. Marked on the day she mentioned it, which can be later than the missed dose.`
                : 'None reported to the doctor. Self-reported; days without a call carry no information.'
            }}
          </p>
        </div>
        <div class="doctor__group doctor__doses">
          <ul class="doctor__strip">
            <li
              v-for="entry in strip"
              :key="entry.key"
              class="doctor__day"
              :class="`doctor__day--${entry.state}`"
              :title="entry.title"
              :aria-label="entry.title"
            >
              <span class="doctor__dot" aria-hidden="true" />
              <span class="doctor__daynum" aria-hidden="true">{{ entry.number }}</span>
            </li>
          </ul>
          <ul class="doctor__legend">
            <li class="doctor__day--missed"><span class="doctor__dot" aria-hidden="true" />Missed dose reported</li>
            <li v-if="hasNoted" class="doctor__day--noted">
              <span class="doctor__dot" aria-hidden="true" />Medication mentioned
            </li>
            <li class="doctor__day--clear"><span class="doctor__dot" aria-hidden="true" />Call, none shared</li>
            <li class="doctor__day--nocall"><span class="doctor__dot" aria-hidden="true" />No call</li>
          </ul>
        </div>
      </section>

      <DoctorRequestBox
        class="doctor__section"
        kind="ask"
        title="Ask Carrie to check something"
        :hint="`Carrie asks ${patient.name} on the next call. The answer appears here only if she agrees to share it.`"
        placeholder="e.g. Is the knee pain worse at night?"
        action="Send to Carrie"
      />

      <DoctorRequestBox
        class="doctor__section"
        kind="tell"
        :title="`After the visit: what should ${patient.name} remember?`"
        hint="Carrie repeats this to her on the next call, in plain words."
        placeholder="e.g. Take the new tablet with breakfast."
        action="Send to Carrie"
      />

      <p class="doctor__foot">Carrie reports what was said. She does not assess, diagnose or advise.</p>
    </div>
  </section>
</template>

<style scoped>
/* The page fills the phone; the bar stays put and the rest scrolls. */
.doctor {
  gap: 0;
  padding: 0;
}

.doctor__bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.doctor__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.doctor__scroll {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-8);
}

/* Patient header */
.doctor__patient {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.doctor__age {
  font-weight: var(--weight-normal);
  color: var(--color-text-muted);
}

.doctor__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-5);
  margin: 0;
}

.doctor__meta dt {
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.doctor__meta dd {
  margin: 0;
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
}

.doctor__notice {
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--color-share-doctor-fg);
  border-radius: var(--radius-sm);
  background: var(--color-share-doctor-bg);
  color: var(--color-share-doctor-fg);
  font-size: var(--text-sm);
  line-height: 1.35;
}

/* Sections */
.doctor__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.doctor__heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.doctor__heading h2 {
  font-size: var(--text-md);
}

.doctor__sub,
.doctor__empty,
.doctor__foot {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.35;
}

.doctor__foot {
  font-size: var(--text-xs);
}

.doctor__category {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.doctor__category-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.doctor__count {
  min-width: 1.25rem;
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--color-surface-alt);
  color: var(--color-text);
  text-align: center;
  letter-spacing: 0;
}

.doctor__group {
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.doctor__repeat {
  margin: 0 calc(var(--space-3) * -1);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: var(--color-surface-alt);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
}

/* 14-day strip */
.doctor__doses {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
}

.doctor__strip {
  display: grid;
  grid-template-columns: repeat(14, 1fr);
}

.doctor__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.doctor__dot {
  flex: none;
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}

.doctor__day--missed .doctor__dot {
  border-color: var(--color-danger);
  background: var(--color-danger);
}

.doctor__day--noted .doctor__dot {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.doctor__day--clear .doctor__dot {
  border-color: var(--color-text-muted);
}

.doctor__day--nocall .doctor__dot {
  width: 6px;
  height: 6px;
  margin: 3px;
  border: 0;
  background: var(--color-border);
}

.doctor__daynum {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.doctor__day--missed .doctor__daynum {
  font-weight: var(--weight-bold);
  color: var(--color-danger);
}

.doctor__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.doctor__legend li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
</style>

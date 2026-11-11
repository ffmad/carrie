<script setup lang="ts">
import { computed, ref } from 'vue'
import { initialOf } from '../../lib/format'
import { useCircleStore } from '../../stores/circle'
import { useSettingsStore } from '../../stores/settings'

/** Who is around Rose, when Carrie calls, what she checks on, and how sharing works. */
const circle = useCircleStore()
const settings = useSettingsStore()

const viewer = computed(() => circle.viewer)
const elder = computed(() => circle.elder)
const care = computed(() => settings.settings)
const canEdit = computed(() => settings.isMainContact(viewer.value.id))
const mainContact = computed(() => settings.mainContact)

const people = computed(() => {
  const main = mainContact.value?.id
  const all = [elder.value, ...circle.family, ...(circle.doctor ? [circle.doctor] : [])]
  return all.map((person) => ({
    person,
    tags: [...(person.id === viewer.value.id ? ['You'] : []), ...(person.id === main ? ['Main contact'] : [])],
  }))
})

/* When Carrie calls */
const callTime = computed(() => (care.value?.callTime ?? '10:00').slice(0, 5))
function setCallTime(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value) void settings.update({ callTime: value })
}

/* What she checks on */
const checks = computed(() => care.value?.checks ?? [])
const newCheck = ref('')
function addCheck() {
  const value = newCheck.value.trim()
  newCheck.value = ''
  if (!value || checks.value.some((check) => check.toLowerCase() === value.toLowerCase())) return
  void settings.update({ checks: [...checks.value, value] })
}
function removeCheck(check: string) {
  void settings.update({ checks: checks.value.filter((item) => item !== check) })
}

/* The doctor */
const appointmentFormat = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const appointment = computed(() => {
  const value = care.value?.nextAppointment
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : appointmentFormat.format(date)
})

const copied = ref(false)
const doctorLink = computed(() => `${window.location.origin}/doctor`)
async function copyDoctorLink() {
  try {
    await navigator.clipboard.writeText(doctorLink.value)
  } catch {
    // No clipboard here (older browser, or not a secure page): the link is shown below instead.
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2500)
}
</script>

<template>
  <div class="circle">
    <div class="screen__scroll circle__scroll">
      <header>
        <h1>{{ elder.name }}'s circle</h1>
        <p class="muted small">The people Carrie carries messages between.</p>
      </header>

      <section class="card circle__card" aria-labelledby="circle-people">
        <h2 id="circle-people" class="circle__title">Who is in it</h2>
        <ul class="people">
          <li v-for="{ person, tags } in people" :key="person.id" class="people__row">
            <span class="people__avatar" :style="{ background: person.avatarColor }" aria-hidden="true">{{ initialOf(person.name) }}</span>
            <span class="people__text">
              <span class="people__name">{{ person.name }}</span>
              <span class="muted small">{{ person.relation }}</span>
            </span>
            <span v-for="tag in tags" :key="tag" class="people__tag" :class="{ 'people__tag--you': tag === 'You' }">{{ tag }}</span>
          </li>
        </ul>
      </section>

      <section class="card circle__card" aria-labelledby="circle-when">
        <h2 id="circle-when" class="circle__title">When Carrie calls</h2>
        <div class="circle__line">
          <p>
            Every day at <strong>{{ callTime }}</strong>
          </p>
          <input
            v-if="canEdit"
            class="input circle__time"
            type="time"
            :value="callTime"
            aria-label="Change the time Carrie calls"
            @change="setCallTime"
          />
        </div>
        <p class="muted small">{{ elder.name }} can also tap the dove and talk whenever she likes.</p>
      </section>

      <section class="card circle__card" aria-labelledby="circle-checks">
        <h2 id="circle-checks" class="circle__title">What she gently checks on</h2>
        <ul class="checks">
          <li v-for="check in checks" :key="check" class="checks__chip">
            {{ check }}
            <button v-if="canEdit" type="button" class="checks__remove" :aria-label="`Stop checking on ${check}`" @click="removeCheck(check)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 5.600 5 5 5-5L18.400 7l-5 5 5 5-1.400 1.400-5-5-5 5L5.600 17l5-5-5-5z" /></svg>
            </button>
          </li>
          <li v-if="!checks.length" class="muted small">Nothing in particular yet.</li>
        </ul>
        <form v-if="canEdit" class="circle__line" @submit.prevent="addCheck">
          <input v-model="newCheck" class="input" type="text" placeholder="Add something, like appetite" aria-label="Add something for Carrie to check on" />
          <button type="submit" class="btn btn--primary" :disabled="!newCheck.trim()">Add</button>
        </form>
        <p v-else class="muted small">{{ mainContact?.name ?? 'The main contact' }} looks after the call time and this list.</p>
      </section>

      <section class="card circle__card" aria-labelledby="circle-doctor">
        <h2 id="circle-doctor" class="circle__title">The doctor</h2>
        <div v-if="circle.doctor" class="people__row">
          <span class="people__avatar" :style="{ background: circle.doctor.avatarColor }" aria-hidden="true">{{ initialOf(circle.doctor.name) }}</span>
          <span class="people__text">
            <span class="people__name">{{ circle.doctor.name }}</span>
            <span class="muted small">{{ appointment ? `Next appointment: ${appointment}` : 'No appointment set yet' }}</span>
          </span>
        </div>
        <button type="button" class="btn btn--block" @click="copyDoctorLink">
          {{ copied ? 'Link copied' : "Copy the doctor's link" }}
        </button>
        <p class="muted small circle__link">{{ copied ? doctorLink : `The doctor's page only shows what ${elder.name} agreed to share with the doctor.` }}</p>
      </section>

      <section class="card circle__card circle__rules" aria-labelledby="circle-rules">
        <h2 id="circle-rules" class="circle__title">How sharing works</h2>
        <p>
          Everyday news goes to the family: what {{ elder.name }} cooked, who she saw, how she is feeling. Carrie asks
          {{ elder.name }} before sharing anything about her health, one person at a time, and keeps to herself whatever
          {{ elder.name }} says to keep. {{ elder.name }} can take anything back whenever she likes.
        </p>
        <p>
          One exception: if {{ elder.name }} mentions a fall, chest pain or sounds confused, Carrie tells her she is letting
          {{ mainContact?.name ?? 'the main contact' }} know, and does.
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.circle {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.circle__scroll {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: var(--space-8);
}

.circle__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.circle__title {
  font-size: var(--text-md);
}

.circle__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.circle__time {
  width: auto;
  flex: none;
}

.circle__link {
  overflow-wrap: anywhere;
}

.circle__rules {
  background: var(--color-primary-soft);
  border-color: var(--color-primary-soft);
  box-shadow: none;
}

.people {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.people__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.people__avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  color: var(--color-person-contrast);
  font-weight: var(--weight-bold);
}

.people__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.people__name {
  font-weight: var(--weight-bold);
}

.people__tag {
  flex: none;
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-accent-soft);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-share-family-fg);
}

.people__tag--you {
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.checks__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-share-doctor-fg);
}

.checks__remove {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-right: calc(-1 * var(--space-2));
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  color: inherit;
}

.checks__remove svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
</style>

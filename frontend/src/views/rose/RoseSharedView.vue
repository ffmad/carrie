<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCircleStore } from '../../stores/circle'
import { useFactsStore } from '../../stores/facts'
import type { Fact, Person } from '../../types'

/** Everything Carrie has kept, by who knows it, in Rose's own words. She can take any of it back. */
const circle = useCircleStore()
const facts = useFactsStore()

const people = computed(() => [...circle.family, ...(circle.doctor ? [circle.doctor] : [])])
const groups = computed(() =>
  people.value.map((person) => ({ person, facts: facts.sharedWith(person.id) })).filter((group) => group.facts.length),
)
const betweenUs = computed(() => facts.newestFirst.filter((fact) => !(fact.sharedWith ?? []).length))

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
/** "You said this yesterday", "You said this on Tuesday, November 10". */
function saidWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  return `You said this ${days <= 0 ? 'today' : days === 1 ? 'yesterday' : `on ${dayFormat.format(date)}`}`
}

/** One extra tap before anything is taken back, so a slip of the finger changes nothing. */
const asking = ref<string | null>(null)
const working = ref(false)
const keyOf = (fact: Fact, person: Person) => `${fact.id}:${person.id}`

async function takeBack(fact: Fact, person: Person) {
  if (working.value) return
  working.value = true
  try {
    await facts.revoke(fact.id, person.id)
  } finally {
    working.value = false
    asking.value = null
  }
}
</script>

<template>
  <section class="screen shared">
    <header class="shared__top">
      <RouterLink to="/rose" class="btn shared__back">
        <svg viewBox="0 0 24 24" class="shared__arrow" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" /></svg>
        Back
      </RouterLink>
      <h1 class="shared__title">What I've shared</h1>
    </header>

    <div class="screen__scroll shared__scroll">
      <p class="shared__lead">Your family hears your everyday news. For anything about your health, Carrie asks you first. You can take anything back.</p>

      <section v-for="group in groups" :key="group.person.id" class="shared__group">
        <h2 class="shared__who">
          <span class="shared__dot" :style="{ background: group.person.avatarColor }" aria-hidden="true" />
          {{ group.person.name }} knows
        </h2>

        <article v-for="fact in group.facts" :key="fact.id" class="shared__item">
          <blockquote class="shared__quote">“{{ fact.quote || fact.statement }}”</blockquote>
          <p v-if="saidWhen(fact.createdAt)" class="shared__when">{{ saidWhen(fact.createdAt) }}</p>

          <button v-if="asking !== keyOf(fact, group.person)" type="button" class="btn btn--block shared__btn" @click="asking = keyOf(fact, group.person)">
            Take it back
          </button>
          <div v-else class="shared__sure">
            <p class="shared__sure-q">Stop telling {{ group.person.name }} this?</p>
            <button type="button" class="btn btn--danger btn--block shared__btn" :disabled="working" @click="takeBack(fact, group.person)">
              Yes, take it back
            </button>
            <button type="button" class="btn btn--block shared__btn" :disabled="working" @click="asking = null">No, leave it</button>
          </div>
        </article>
      </section>

      <section v-if="betweenUs.length" class="shared__group">
        <h2 class="shared__who">
          <span class="shared__dot shared__dot--private" aria-hidden="true" />
          Just between us
        </h2>
        <p class="shared__note">Carrie has told nobody about these.</p>
        <article v-for="fact in betweenUs" :key="fact.id" class="shared__item shared__item--private">
          <blockquote class="shared__quote">“{{ fact.quote || fact.statement }}”</blockquote>
        </article>
      </section>

      <p v-if="!groups.length && !betweenUs.length" class="shared__empty">Nothing yet. When you talk with Carrie, what you tell her shows up here.</p>
    </div>
  </section>
</template>

<style scoped>
.shared {
  gap: 0;
  padding: 0;
  font-size: var(--text-lg);
}

.shared__top {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.shared__back {
  min-height: 56px;
  padding-inline: var(--space-4) var(--space-5);
  font-size: var(--text-lg);
}

.shared__arrow {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.shared__title {
  font-size: var(--text-2xl);
}

.shared__scroll {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-bottom: var(--space-8);
}

.shared__lead,
.shared__note,
.shared__empty {
  font-size: var(--text-lg);
  line-height: 1.35;
}

.shared__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.shared__who {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xl);
}

.shared__dot {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-pill);
}

.shared__dot--private {
  background: var(--color-share-private-fg);
}

.shared__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.shared__item--private {
  background: var(--color-share-private-bg);
  box-shadow: none;
}

.shared__quote {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: 1.35;
}

.shared__when {
  font-size: var(--text-lg);
  color: var(--color-text-muted);
}

.shared__btn {
  min-height: 56px;
  font-size: var(--text-lg);
}

.shared__sure {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.shared__sure-q {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
}
</style>

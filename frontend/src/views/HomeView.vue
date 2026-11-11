<script setup lang="ts">
import { useRouter } from 'vue-router'
import CarrieAvatar from '../components/CarrieAvatar.vue'
import { initialOf } from '../lib/format'
import { homeRouteFor, useCircleStore, VIEWER_KEYS, type ViewerKey } from '../stores/circle'

/** Demo entry point: pick whose side of Carrie you want to see. */
const circle = useCircleStore()
const router = useRouter()

const HINTS: Record<ViewerKey, string> = {
  rose: "Take Carrie's call",
  mia: 'See what Mum chose to share',
  leo: 'Send Grandma a voice note',
  'dr-chen': 'Open the appointment brief',
}

function enter(key: ViewerKey) {
  circle.viewAs(key)
  void router.push(homeRouteFor(key))
}
</script>

<template>
  <section class="screen home">
    <CarrieAvatar state="idle" :size="132" />
    <div class="home__intro">
      <h1 class="home__title">Carrie</h1>
      <p class="muted">
        An AI helper who calls {{ circle.elder.name }}, and carries what she chooses to share to her family and her doctor.
      </p>
    </div>

    <div class="stack home__roles">
      <p class="eyebrow">View the demo as</p>
      <button v-for="key in VIEWER_KEYS" :key="key" type="button" class="card home__role" @click="enter(key)">
        <span class="home__avatar" :style="{ background: circle.personFor(key).avatarColor }">
          {{ initialOf(circle.personFor(key).name) }}
        </span>
        <span class="home__who">
          <strong>{{ circle.personFor(key).name }}</strong>
          <span class="muted small">{{ circle.personFor(key).relation }} · {{ HINTS[key] }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.home {
  align-items: center;
  padding-top: var(--space-10);
  text-align: center;
}

.home__intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 32ch;
}

.home__title {
  font-size: var(--text-2xl);
  color: var(--color-primary);
}

.home__roles {
  width: 100%;
  text-align: left;
}

.home__role {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: var(--tap-big);
  text-align: left;
}

.home__avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-pill);
  color: var(--color-person-contrast);
  font-weight: var(--weight-bold);
}

.home__who {
  display: flex;
  flex-direction: column;
}
</style>

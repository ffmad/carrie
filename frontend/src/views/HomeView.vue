<script setup lang="ts">
import { useRouter } from 'vue-router'
import CarrieAvatar from '../components/CarrieAvatar.vue'
import CarrieLogo from '../components/CarrieLogo.vue'
import { initialOf } from '../lib/format'
import { homeRouteFor, useCircleStore, VIEWER_KEYS, type ViewerKey } from '../stores/circle'

/** Stands in for sign-in: pick whose phone this is. Each person gets their own Carrie. */
const circle = useCircleStore()
const router = useRouter()

const HINTS: Record<ViewerKey, string> = {
  rose: 'Talks with Carrie',
  mia: 'Hears what Mum chose to tell her',
  leo: 'Sends Grandma his voice',
  'dr-chen': 'Reads the brief before the visit',
}

function enter(key: ViewerKey) {
  circle.viewAs(key)
  void router.push(homeRouteFor(key))
}
</script>

<template>
  <section class="screen">
    <div class="screen__scroll home">
    <CarrieAvatar state="idle" :size="132" />
    <div class="home__intro">
      <CarrieLogo :size="40" />
      <p class="muted">
        An AI helper who talks with {{ circle.elder.name }}, and carries what she chooses to share to her family and her doctor.
      </p>
    </div>

    <div class="stack home__roles">
      <p class="eyebrow">Whose phone is this?</p>
      <button v-for="key in VIEWER_KEYS" :key="key" type="button" class="card home__role" @click="enter(key)">
        <span class="home__avatar" :style="{ background: circle.personFor(key).avatarColor }">
          {{ initialOf(circle.personFor(key).name) }}
        </span>
        <span class="home__who">
          <strong>{{ circle.personFor(key).name }}</strong>
          <span class="muted small">{{ circle.personFor(key).relation }} · {{ HINTS[key] }}</span>
        </span>
      </button>
      <p class="muted small home__note">No sign-in yet: this screen stands in for it.</p>
    </div>
    </div>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  padding-top: var(--space-8);
  text-align: center;
}

.home__note {
  text-align: center;
}

.home__intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  max-width: 32ch;
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

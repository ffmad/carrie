<script setup lang="ts">
import { useRouter } from 'vue-router'
import { initialOf } from '../lib/format'
import { homeRouteFor, useCircleStore, VIEWER_KEYS, type ViewerKey } from '../stores/circle'

/** Demo control: switch who you are viewing the app as, and jump to that person's screen. */
const circle = useCircleStore()
const router = useRouter()

function choose(key: ViewerKey) {
  circle.viewAs(key)
  void router.push(homeRouteFor(key))
}
</script>

<template>
  <nav class="roles" aria-label="View as">
    <button
      v-for="key in VIEWER_KEYS"
      :key="key"
      type="button"
      class="roles__item"
      :class="{ 'roles__item--active': circle.viewerKey === key }"
      :aria-pressed="circle.viewerKey === key"
      :title="`View as ${circle.personFor(key).name}`"
      @click="choose(key)"
    >
      <span class="roles__dot" :style="{ background: circle.personFor(key).avatarColor }">
        {{ initialOf(circle.personFor(key).name) }}
      </span>
      <span v-if="circle.viewerKey === key" class="roles__name">{{ circle.personFor(key).name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.roles {
  display: flex;
  gap: var(--space-1);
}

.roles__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.roles__item--active {
  padding-right: var(--space-3);
  border-color: var(--color-border);
  background: var(--color-surface-alt);
}

.roles__dot {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  color: var(--color-person-contrast);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
}
</style>

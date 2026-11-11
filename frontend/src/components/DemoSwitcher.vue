<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { homeRouteFor, useCircleStore, VIEWER_KEYS } from '../stores/circle'

/**
 * Desktop only, outside the phone: jump between the four people's phones while recording a demo.
 * It is not part of the app; on a real phone it is hidden.
 */
const circle = useCircleStore()
</script>

<template>
  <nav class="demo" aria-label="Demo: switch whose phone this is">
    <span class="demo__label">Whose phone</span>
    <RouterLink
      v-for="key in VIEWER_KEYS"
      :key="key"
      :to="homeRouteFor(key)"
      class="demo__link"
      :class="{ 'demo__link--on': circle.viewerKey === key }"
    >
      {{ circle.personFor(key).name }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.demo {
  display: none;
}

@media (min-width: 900px) and (min-height: 500px) {
  .demo {
    position: fixed;
    top: var(--space-4);
    left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
    font-size: var(--text-sm);
  }

  .demo__label {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  .demo__link {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    color: var(--color-text);
    font-weight: var(--weight-medium);
  }

  .demo__link--on {
    background: var(--color-primary);
    color: var(--color-primary-contrast);
  }
}
</style>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import CarrieLogo from '../../components/CarrieLogo.vue'
import { initialOf } from '../../lib/format'
import { useCircleStore } from '../../stores/circle'

/** The family app: whose phone this is comes from the address, then three tabs. */
const route = useRoute()
const circle = useCircleStore()

const who = computed<'mia' | 'leo'>(() => (route.params.who === 'leo' ? 'leo' : 'mia'))
watch(who, (key) => circle.viewAs(key), { immediate: true })

const viewer = computed(() => circle.viewer)
/** A daughter says "Mum", a grandson says "Grandma". */
const herLabel = computed(() => (/grand/i.test(viewer.value.relation) ? 'Grandma' : 'Mum'))
const base = computed(() => `/family/${who.value}`)
</script>

<template>
  <div class="screen family">
    <header class="family__bar">
      <RouterLink to="/" class="family__brand" aria-label="Carrie, back to the start">
        <CarrieLogo :size="22" />
      </RouterLink>
      <span class="family__me">
        <span class="family__name">{{ viewer.name }}</span>
        <span class="family__avatar" :style="{ background: viewer.avatarColor }" aria-hidden="true">{{ initialOf(viewer.name) }}</span>
      </span>
    </header>

    <RouterView />

    <nav class="tabs" aria-label="Sections">
      <RouterLink :to="`${base}/carrie`" class="tabs__tab" active-class="tabs__tab--on">
        <svg viewBox="0 0 24 24" class="tabs__icon" aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.4 3.7A.6.6 0 0 1 5.6 19v-3A2.5 2.5 0 0 1 4 13.5z" />
        </svg>
        <span>Carrie</span>
      </RouterLink>
      <RouterLink :to="`${base}/her`" class="tabs__tab" active-class="tabs__tab--on">
        <svg viewBox="0 0 24 24" class="tabs__icon" aria-hidden="true">
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 8.8 6c1.3 0 2.5.6 3.2 1.6A4 4 0 0 1 15.2 6a4.3 4.3 0 0 1 4.3 4.3c0 5.6-7.5 10.2-7.5 10.2z" />
        </svg>
        <span>{{ herLabel }}</span>
      </RouterLink>
      <RouterLink :to="`${base}/circle`" class="tabs__tab" active-class="tabs__tab--on">
        <svg viewBox="0 0 24 24" class="tabs__icon" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="3.2" />
          <circle cx="16.5" cy="9.5" r="2.6" />
          <path d="M2.5 19c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3zM15.8 19c0-1.7-.6-3.1-1.6-4.2.7-.3 1.500-.5 2.3-.5 2.800 0 5 1.800 5 4.700z" />
        </svg>
        <span>Circle</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.family {
  padding: 0;
  gap: 0;
}

.family__bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.family__brand {
  display: inline-flex;
  align-items: center;
  color: var(--color-primary);
}

.family__me {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.family__name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

.family__avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  color: var(--color-person-contrast);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
}

.tabs {
  flex: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: var(--space-1) var(--space-2) max(var(--space-2), env(safe-area-inset-bottom));
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.tabs__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: var(--tap-min);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-text-muted);
  transition: color var(--duration-fast) var(--ease);
}

.tabs__icon {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.tabs__tab--on {
  color: var(--color-primary);
}
</style>

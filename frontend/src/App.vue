<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import PhoneFrame from './components/PhoneFrame.vue'
import RoleSwitcher from './components/RoleSwitcher.vue'
import { useCircleStore } from './stores/circle'
import { useFactsStore } from './stores/facts'
import { useVoiceNotesStore } from './stores/voiceNotes'

const route = useRoute()

// Stores start on demo data and swap to Supabase rows when it is configured and reachable.
onMounted(() => {
  void useCircleStore().load()
  void useFactsStore().load()
  void useVoiceNotesStore().load()
})
</script>

<template>
  <PhoneFrame>
    <header v-if="route.name !== 'home'" class="app-bar">
      <RouterLink to="/" class="app-bar__brand" aria-label="Carrie home">Carrie</RouterLink>
      <RoleSwitcher />
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </PhoneFrame>
</template>

<style scoped>
.app-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app-bar__brand {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--color-primary);
}

.app-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useCircleStore } from '../stores/circle'
import type { Fact } from '../types'

/** Who knows this, by name. Sharing is per person, so each person gets their own pill. */
const props = defineProps<{ fact: Pick<Fact, 'sharedWith' | 'consent'> }>()

const circle = useCircleStore()

const badges = computed(() => {
  const ids = props.fact.sharedWith ?? []
  if (!ids.length) {
    return props.fact.consent === 'pending'
      ? [{ key: 'pending', kind: 'pending', label: 'Not asked yet' }]
      : [{ key: 'private', kind: 'private', label: 'Just between us' }]
  }
  return ids.flatMap((id) => {
    const person = circle.byId(id)
    if (!person) return []
    return [
      {
        key: id,
        kind: person.role === 'doctor' ? 'doctor' : 'family',
        label: id === circle.viewer.id ? 'You' : person.name,
      },
    ]
  })
})
</script>

<template>
  <span class="share" aria-label="Who knows this">
    <span v-for="badge in badges" :key="badge.key" class="share__badge" :class="`share__badge--${badge.kind}`">
      {{ badge.label }}
    </span>
  </span>
</template>

<style scoped>
.share {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.share__badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  white-space: nowrap;
}

.share__badge--private {
  background: var(--color-share-private-bg);
  color: var(--color-share-private-fg);
}

.share__badge--family {
  background: var(--color-share-family-bg);
  color: var(--color-share-family-fg);
}

.share__badge--doctor {
  background: var(--color-share-doctor-bg);
  color: var(--color-share-doctor-fg);
}

.share__badge--pending {
  background: var(--color-share-pending-bg);
  color: var(--color-share-pending-fg);
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { Fact } from '../types'

/** Who a fact is shared with: private, family, doctor (independently), or not asked yet. */
const props = defineProps<{ fact: Pick<Fact, 'shareFamily' | 'shareDoctor' | 'consent'> }>()

const badges = computed(() => {
  const { shareFamily, shareDoctor, consent } = props.fact
  if (!shareFamily && !shareDoctor) {
    return consent === 'pending'
      ? [{ kind: 'pending', label: 'Not asked yet' }]
      : [{ kind: 'private', label: 'Private' }]
  }
  return [
    ...(shareFamily ? [{ kind: 'family', label: 'Family' }] : []),
    ...(shareDoctor ? [{ kind: 'doctor', label: 'Doctor' }] : []),
  ]
})
</script>

<template>
  <span class="share">
    <span v-for="badge in badges" :key="badge.kind" class="share__badge" :class="`share__badge--${badge.kind}`">
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

<script setup lang="ts">
import { computed } from 'vue'

/**
 * "Can I share this?" Carrie asks before passing anything on. Rose can answer out
 * loud, or tap. Her family and her doctor are separate answers.
 */
type Audience = 'family' | 'doctor'
interface Decision {
  family?: boolean
  doctor?: boolean
}

const props = defineProps<{
  question: string
  audience: Audience
  /** First names of the people a yes would tell ("Mia"), when Carrie named them. */
  names?: string[]
  /** The one other person she could add: her main contact when Carrie asked about the doctor, and the other way round. */
  alsoName?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ answer: [decision: Decision] }>()

const who = computed(() => {
  const names = props.names?.filter(Boolean) ?? []
  if (names.length) return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  return props.audience === 'doctor' ? 'my doctor' : 'my family'
})

const yes = () => emit('answer', props.audience === 'doctor' ? { doctor: true } : { family: true })
</script>

<template>
  <section class="ask" aria-label="Carrie is asking before she passes this on">
    <p class="ask__label">Carrie is asking</p>
    <p class="ask__question">{{ question }}</p>
    <div class="ask__choices">
      <button type="button" class="btn btn--accent btn--block ask__choice" :disabled="disabled" @click="yes">Yes, tell {{ who }}</button>
      <button type="button" class="btn btn--block ask__choice" :disabled="disabled" @click="emit('answer', { family: true, doctor: true })">
        Yes, and tell {{ alsoName ?? (audience === 'doctor' ? 'my family' : 'my doctor') }} too
      </button>
      <button type="button" class="btn btn--block ask__choice" :disabled="disabled" @click="emit('answer', { family: false, doctor: false })">
        No, keep it between us
      </button>
    </div>
  </section>
</template>

<style scoped>
.ask {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 2px solid var(--color-share-pending-fg);
  border-radius: var(--radius-lg);
  background: var(--color-share-pending-bg);
  box-shadow: var(--shadow-card);
  animation: ask-in var(--duration-slow) var(--ease);
}

.ask__label {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--color-share-pending-fg);
}

.ask__question {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  line-height: 1.3;
}

.ask__choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.ask__choice {
  min-height: 56px;
  font-size: var(--text-lg);
  line-height: 1.2;
}

@keyframes ask-in {
  from {
    opacity: 0;
    transform: translateY(var(--space-4));
  }
}
</style>

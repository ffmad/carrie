<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCallsStore } from '../stores/calls'
import { useCircleStore } from '../stores/circle'
import { useRequestsStore } from '../stores/requests'
import type { CareRequest } from '../types'

/**
 * One of the doctor's two boxes: something for Carrie to ask on the next call
 * ('ask'), or something the patient should remember after the visit ('tell').
 * Lists what the doctor already sent of that kind, with its status.
 */
const props = defineProps<{
  kind: 'ask' | 'tell'
  title: string
  hint: string
  placeholder: string
  action: string
}>()

const circle = useCircleStore()
const requests = useRequestsStore()
const calls = useCallsStore()

const text = ref('')
const sending = ref(false)
const failed = ref(false)
const fieldId = `doctor-request-${props.kind}`

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const day = (iso: string) => shortDate.format(new Date(iso))

/** What the doctor already sent of this kind, newest first. */
const sent = computed<CareRequest[]>(() => {
  const doctor = circle.doctor
  if (!doctor) return []
  return requests
    .from(doctor.id)
    .filter((request: CareRequest) => request.kind === props.kind)
    .sort((a: CareRequest, b: CareRequest) => b.createdAt.localeCompare(a.createdAt))
})

function status(request: CareRequest): string {
  if (request.status === 'pending') {
    return props.kind === 'ask' ? 'Carrie will ask on the next call' : 'Carrie will tell her on the next call'
  }
  const verb = props.kind === 'ask' ? 'Asked' : `Told ${circle.elder.name}`
  const call = request.handledCallId ? calls.byId(request.handledCallId) : null
  return call ? `${verb} on ${day(call.startedAt)}` : verb
}

async function submit() {
  const value = text.value.trim()
  const doctor = circle.doctor
  if (!value || !doctor || sending.value) return
  sending.value = true
  failed.value = false
  try {
    await requests.add({ fromId: doctor.id, kind: props.kind, text: value })
    text.value = ''
  } catch {
    failed.value = true
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="request-box" :aria-labelledby="`${fieldId}-title`">
    <h2 :id="`${fieldId}-title`" class="request-box__title">{{ title }}</h2>
    <p class="request-box__hint">{{ hint }}</p>

    <form class="request-box__form" @submit.prevent="submit">
      <textarea
        :id="fieldId"
        v-model="text"
        class="input request-box__input"
        rows="2"
        :placeholder="placeholder"
        :aria-labelledby="`${fieldId}-title`"
        @keydown.enter.meta.prevent="submit"
        @keydown.enter.ctrl.prevent="submit"
      />
      <div class="request-box__actions">
        <p v-if="failed" class="request-box__error" role="alert">Not sent. Please try again.</p>
        <button type="submit" class="btn btn--primary request-box__send" :disabled="!text.trim() || sending || !circle.doctor">
          {{ sending ? 'Sending' : action }}
        </button>
      </div>
    </form>

    <ul v-if="sent.length" class="request-box__list">
      <li v-for="request in sent" :key="request.id" class="request-box__item">
        <p class="request-box__text">{{ request.text }}</p>
        <p class="request-box__status" :class="`request-box__status--${request.status}`">
          <span class="request-box__mark" aria-hidden="true" />
          <span>{{ status(request) }}</span>
          <span class="request-box__sent">Sent {{ day(request.createdAt) }}</span>
        </p>
      </li>
    </ul>
    <p v-else class="request-box__none">Nothing sent yet.</p>
  </section>
</template>

<style scoped>
.request-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.request-box__title {
  font-size: var(--text-md);
}

.request-box__hint,
.request-box__none {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.request-box__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.request-box__input {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  line-height: 1.35;
  resize: vertical;
}

.request-box__input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.75;
}

.request-box__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

.request-box__send {
  min-height: 40px;
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.request-box__error {
  margin-right: auto;
  font-size: var(--text-sm);
  color: var(--color-danger);
}

.request-box__list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.request-box__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
}

.request-box__item + .request-box__item {
  border-top: 1px solid var(--color-border);
}

.request-box__text {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.request-box__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.request-box__mark {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  border: 2px solid var(--color-primary);
}

.request-box__status--done .request-box__mark {
  background: var(--color-primary);
}

.request-box__status--done {
  color: var(--color-text);
}

.request-box__sent {
  margin-left: auto;
  white-space: nowrap;
  color: var(--color-text-muted);
}
</style>

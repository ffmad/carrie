<script setup lang="ts">
import { computed } from 'vue'
import FactCard from '../components/FactCard.vue'
import ReceiptPlayer from '../components/ReceiptPlayer.vue'
import VoiceNoteRecorder from '../components/VoiceNoteRecorder.vue'
import { formatDay } from '../lib/format'
import type { Recording } from '../lib/recorder'
import { clipUrl } from '../lib/supabase'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import { useVoiceNotesStore } from '../stores/voiceNotes'

/** The family's side: what the elder chose to share, with receipts, and a voice note back. */
const circle = useCircleStore()
const facts = useFactsStore()
const voiceNotes = useVoiceNotesStore()

const sender = computed(() => (circle.viewer.role === 'family' ? circle.viewer : (circle.family[0] ?? circle.viewer)))
const notesToElder = computed(() => voiceNotes.newestFirst.filter((n) => n.toId === circle.elder.id))

function sendNote(payload: { recording: Recording; transcript: string }) {
  void voiceNotes.send({ fromId: sender.value.id, toId: circle.elder.id, ...payload })
}
</script>

<template>
  <section class="screen">
    <header class="stack">
      <p class="eyebrow">{{ sender.name }} · {{ sender.relation }}</p>
      <h1>{{ circle.elder.name }} this week</h1>
      <p class="muted">Only what {{ circle.elder.name }} agreed to share with family. Tap play to hear her say it.</p>
    </header>

    <section class="card stack" aria-labelledby="note-title">
      <h2 id="note-title">Say something back</h2>
      <p class="muted small">Carrie plays your real voice to {{ circle.elder.name }} on her next call. She never paraphrases you.</p>
      <VoiceNoteRecorder :to-name="circle.elder.name" @send="sendNote" />
      <ul v-if="notesToElder.length" class="stack notes">
        <li v-for="note in notesToElder" :key="note.id" class="notes__item">
          <p class="small">
            <strong>{{ circle.byId(note.fromId)?.name ?? 'Family' }}</strong>
            <span class="muted"> · {{ formatDay(note.createdAt) }} · {{ note.deliveredAt ? `Played to ${circle.elder.name}` : 'Waiting for the next call' }}</span>
          </p>
          <p v-if="note.transcript" class="muted small">“{{ note.transcript }}”</p>
          <ReceiptPlayer :src="clipUrl(note.audioPath)" :quote="note.transcript ?? ''" :speaker="circle.byId(note.fromId)?.name" />
        </li>
      </ul>
    </section>

    <section class="stack" aria-labelledby="feed-title">
      <h2 id="feed-title">Shared with family</h2>
      <p v-if="!facts.sharedWithFamily.length" class="muted">Nothing shared yet. {{ circle.elder.name }} decides what Carrie passes on.</p>
      <FactCard v-for="fact in facts.sharedWithFamily" :key="fact.id" :fact="fact" />
    </section>
  </section>
</template>

<style scoped>
.notes {
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.notes__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>

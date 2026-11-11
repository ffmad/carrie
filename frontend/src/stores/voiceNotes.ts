import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { demoVoiceNotes } from '../lib/demoData'
import type { Recording } from '../lib/recorder'
import { fetchRows, fromVoiceNote, patchRow, saveRow, supabase, toVoiceNote, uploadClip } from '../lib/supabase'
import type { VoiceNote } from '../types'

/** Real recordings Carrie carries: from the family to the elder, and the elder's spoken answers back. */
export const useVoiceNotesStore = defineStore('voiceNotes', () => {
  // Demo data straight away when Supabase is not configured; otherwise wait for load().
  const notes = ref<VoiceNote[]>(supabase ? [] : demoVoiceNotes)
  const source = ref<'demo' | 'supabase'>('demo')
  const loaded = ref(!supabase)

  const newestFirst = computed(() => [...notes.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  const pendingFor = (personId: string): VoiceNote[] =>
    notes.value.filter((n) => n.toId === personId && !n.deliveredAt)
  /** Everything sent by or to this person, oldest first. */
  const involving = (personId: string): VoiceNote[] =>
    notes.value
      .filter((n) => n.fromId === personId || n.toId === personId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  async function load() {
    const rows = await fetchRows('voice_notes')
    if (rows?.length) {
      const local = notes.value.filter((n) => !rows.some((row) => row.id === n.id))
      notes.value = [...rows.map(toVoiceNote), ...local]
      source.value = 'supabase'
    } else if (!notes.value.length) {
      notes.value = demoVoiceNotes
    }
    loaded.value = true
  }

  async function send(input: {
    fromId: string
    toId: string
    recording: Recording
    transcript?: string | null
    replyToFactId?: string | null
    inReplyTo?: string | null
  }): Promise<VoiceNote> {
    const id = crypto.randomUUID()
    const audioPath = await uploadClip(`voice-notes/${id}.${input.recording.extension}`, input.recording.blob)
    const note: VoiceNote = {
      id,
      fromId: input.fromId,
      toId: input.toId,
      audioPath,
      transcript: input.transcript?.trim() || null,
      replyToFactId: input.replyToFactId ?? null,
      inReplyTo: input.inReplyTo ?? null,
      deliveredCallId: null,
      deliveredAt: null,
      createdAt: new Date().toISOString(),
    }
    notes.value = [...notes.value, note]
    // A blob: URL only plays in this tab, so there is nothing useful to persist.
    if (!audioPath.startsWith('blob:')) await saveRow('voice_notes', fromVoiceNote(note))
    return note
  }

  /**
   * The elder's answer to a family note, said during a call. Her clip is already stored
   * (it is the receipt of that utterance), so nothing is uploaded again.
   */
  async function addReply(input: { fromId: string; toId: string; audioPath: string | null; transcript: string; inReplyTo: string; callId: string }) {
    const now = new Date().toISOString()
    const note: VoiceNote = {
      id: crypto.randomUUID(),
      fromId: input.fromId,
      toId: input.toId,
      audioPath: input.audioPath ?? '',
      transcript: input.transcript,
      replyToFactId: null,
      inReplyTo: input.inReplyTo,
      // Nothing to carry: the family hears it in the app.
      deliveredCallId: input.callId,
      deliveredAt: now,
      createdAt: now,
    }
    notes.value = [...notes.value, note]
    await saveRow('voice_notes', { ...fromVoiceNote(note), audio_path: note.audioPath.startsWith('blob:') ? null : note.audioPath || null })
    return note
  }

  async function markDelivered(id: string, callId: string) {
    const note = notes.value.find((n) => n.id === id)
    if (!note) return
    note.deliveredCallId = callId
    note.deliveredAt = new Date().toISOString()
    await patchRow('voice_notes', id, { delivered_call_id: callId, delivered_at: note.deliveredAt })
  }

  return { notes, source, loaded, newestFirst, pendingFor, involving, load, send, addReply, markDelivered }
})

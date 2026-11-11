import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Call, Fact, Person, Utterance, VoiceNote } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Null when the env vars are not set: stores then run on the bundled demo data. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export const CLIPS_BUCKET = 'clips'

export type TableName = 'people' | 'calls' | 'utterances' | 'facts' | 'voice_notes'
// Untyped rows until lib/database.types.ts is generated from the real schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

/** All rows of a table, oldest first. Null when Supabase is not configured or the request fails. */
export async function fetchRows(table: TableName, orderBy = 'created_at'): Promise<Row[] | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: true })
    if (error) throw error
    return data
  } catch (error) {
    console.warn(`[supabase] could not load ${table}, using demo data`, error)
    return null
  }
}

/**
 * Writes run one at a time, in the order they were requested, so a row always
 * lands after the rows it references (call -> utterance -> fact).
 */
let writeQueue: Promise<unknown> = Promise.resolve()
function enqueue(write: () => PromiseLike<{ error: { message: string } | null }>, what: string): Promise<boolean> {
  const result = writeQueue.then(async () => {
    try {
      const { error } = await write()
      if (error) console.warn(`[supabase] could not ${what}`, error.message)
      return !error
    } catch (error) {
      console.warn(`[supabase] could not ${what}`, error)
      return false
    }
  })
  writeQueue = result
  return result
}

/** Best-effort upsert: local state stays the source of truth for the session if it fails. */
export async function saveRow(table: TableName, row: Row): Promise<boolean> {
  const client = supabase
  if (!client) return false
  return enqueue(() => client.from(table).upsert(row), `save to ${table}`)
}

export async function patchRow(table: TableName, id: string, patch: Row): Promise<boolean> {
  const client = supabase
  if (!client) return false
  return enqueue(() => client.from(table).update(patch).eq('id', id), `update ${table}`)
}

/** Playable URL for a stored clip path. Null when there is nothing to play. */
export function clipUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(blob:|https?:|data:|\/)/.test(path)) return path
  if (!supabase) return null
  return supabase.storage.from(CLIPS_BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Stores a recorded clip and returns what to keep in `audio_path`: the bucket
 * path when the upload worked, otherwise a blob: URL that plays for this session.
 */
export async function uploadClip(path: string, blob: Blob): Promise<string> {
  if (supabase) {
    const { error } = await supabase.storage
      .from(CLIPS_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'audio/webm' })
    if (!error) return path
    console.warn('[supabase] clip upload failed, keeping it local', error.message)
  }
  return URL.createObjectURL(blob)
}

/* Row -> domain */
export const toPerson = (r: Row): Person => ({
  id: r.id,
  role: r.role,
  name: r.name,
  relation: r.relation ?? '',
  avatarColor: r.avatar_color ?? 'var(--color-primary)',
  createdAt: r.created_at,
})

export const toUtterance = (r: Row): Utterance => ({
  id: r.id,
  callId: r.call_id,
  speaker: r.speaker,
  speakerId: r.speaker_id ?? null,
  text: r.text,
  audioPath: r.audio_path ?? null,
  position: r.position ?? 0,
  createdAt: r.created_at,
})

export const toFact = (r: Row): Fact => ({
  id: r.id,
  callId: r.call_id,
  elderId: r.elder_id,
  utteranceId: r.utterance_id ?? null,
  category: r.category,
  statement: r.statement,
  quote: r.quote,
  shareFamily: Boolean(r.share_family),
  shareDoctor: Boolean(r.share_doctor),
  consent: r.consent ?? 'pending',
  createdAt: r.created_at,
})

export const toVoiceNote = (r: Row): VoiceNote => ({
  id: r.id,
  fromId: r.from_id,
  toId: r.to_id,
  audioPath: r.audio_path ?? '',
  transcript: r.transcript ?? null,
  replyToFactId: r.reply_to_fact_id ?? null,
  deliveredCallId: r.delivered_call_id ?? null,
  deliveredAt: r.delivered_at ?? null,
  createdAt: r.created_at,
})

/* Domain -> row */
export const fromCall = (c: Call): Row => ({
  id: c.id,
  elder_id: c.elderId,
  started_at: c.startedAt,
  ended_at: c.endedAt,
  summary: c.summary,
})

export const fromUtterance = (u: Utterance): Row => ({
  id: u.id,
  call_id: u.callId,
  speaker: u.speaker,
  speaker_id: u.speakerId,
  text: u.text,
  // blob: URLs only live in this tab; never persist them.
  audio_path: u.audioPath?.startsWith('blob:') ? null : u.audioPath,
  position: u.position,
  created_at: u.createdAt,
})

export const fromFact = (f: Fact): Row => ({
  id: f.id,
  call_id: f.callId,
  elder_id: f.elderId,
  utterance_id: f.utteranceId,
  category: f.category,
  statement: f.statement,
  quote: f.quote,
  share_family: f.shareFamily,
  share_doctor: f.shareDoctor,
  consent: f.consent,
  created_at: f.createdAt,
})

export const fromVoiceNote = (v: VoiceNote): Row => ({
  id: v.id,
  from_id: v.fromId,
  to_id: v.toId,
  audio_path: v.audioPath,
  transcript: v.transcript,
  reply_to_fact_id: v.replyToFactId,
  delivered_call_id: v.deliveredCallId,
  delivered_at: v.deliveredAt,
  created_at: v.createdAt,
})

import { ref, shallowRef } from 'vue'

/**
 * Carrie on GPT-Live 1, as one self-contained call engine with no UI.
 *
 * GPT-Live listens and speaks itself (full duplex, WebRTC). This file:
 *  - connects the microphone and exposes Carrie's voice (`remoteStream`, or the built-in `audio` element),
 *  - reports both sides' words via `onTranscript`: partials while they talk, `final: true` once a pause
 *    of TURN_GAP_MS ends the turn. Times are ms from session start, as GPT-Live reports them,
 *  - keeps the whole microphone recording as 16 kHz WAV, so receipts can be cut by transcript time
 *    (`cutClip`, or `stopRecording()` for the full file),
 *  - lets the app steer Carrie mid-call (`ask`, `tell`) with `session.instructions.append`. This is the
 *    pattern OpenAI's Live docs describe: read the live transcript, append an instruction when needed.
 *
 * Usage:
 *   const live = createLiveCall()
 *   live.onTranscript((t) => ...)
 *   await live.start({ pendingVoiceNotes, earlierFacts })   // POST /api/live/session
 *   live.ask('May I tell Dr. Chen about your knee?')
 *   const clip = live.cutClip(t.startMs, t.endMs)            // receipt for one of Rose's turns
 *   await live.hangUp()
 */

export type LiveState = 'idle' | 'connecting' | 'live' | 'closed' | 'error'

export interface LiveTranscript {
  speaker: 'elder' | 'carrie'
  /** For a partial, the turn's text so far; for a final, the whole turn. */
  text: string
  startMs: number
  endMs: number
  final: boolean
}

export interface LiveStartOptions {
  pendingVoiceNotes?: { from: string; transcript: string }[]
  /** Short statements from earlier calls. Omit and the backend reads them from Carrie's memory (GBrain). */
  earlierFacts?: string[]
  /** Who Carrie is talking to. Default 'elder' (Rose). See the backend's /api/live/session. */
  audience?: 'elder' | 'family'
  /** For audience 'family': who is calling, and the facts Rose agreed to share with family. */
  familyMember?: string
  sharedFacts?: string[]
}

export interface MicRecording {
  blob: Blob
  sampleRate: number
  /** Transcript time 0 is this many ms into the recording. Clip [startMs, endMs] = [startMs + offsetMs, endMs + offsetMs]. */
  offsetMs: number
}

const TURN_GAP_MS = 1000
const CLIP_RATE = 16000
const CLIP_PAD_MS = 250

interface Delta { delta: string; start_ms: number; end_ms: number }

export function createLiveCall() {
  const state = ref<LiveState>('idle')
  const error = ref<string | null>(null)
  const remoteStream = shallowRef<MediaStream | null>(null)
  const audio = typeof Audio !== 'undefined' ? new Audio() : null
  if (audio) audio.autoplay = true

  const listeners = new Set<(t: LiveTranscript) => void>()
  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  let mic: MediaStream | null = null
  let ctx: AudioContext | null = null
  let pcm: Int16Array[] = []
  let pcmSamples = 0
  let t0 = 0 // performance.now() at session.started
  let micT0 = 0 // performance.now() when mic capture began
  let closed: (() => void) | null = null
  const turns = {
    elder: { text: '', start: 0, end: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined },
    carrie: { text: '', start: 0, end: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined },
  }

  const emit = (t: LiveTranscript) => listeners.forEach((cb) => cb(t))

  function onDelta(speaker: 'elder' | 'carrie', d: Delta) {
    const turn = turns[speaker]
    if (!turn.text) turn.start = d.start_ms
    turn.text += d.delta
    turn.end = d.end_ms
    emit({ speaker, text: turn.text.trim(), startMs: turn.start, endMs: turn.end, final: false })
    clearTimeout(turn.timer)
    turn.timer = setTimeout(() => flush(speaker), TURN_GAP_MS)
  }

  function flush(speaker: 'elder' | 'carrie') {
    const turn = turns[speaker]
    clearTimeout(turn.timer)
    const text = turn.text.trim()
    const t = { speaker, text, startMs: turn.start, endMs: turn.end, final: true }
    turn.text = ''
    if (text) emit(t)
  }

  function onEvent(event: { type: string; error?: { message?: string } } & Partial<Delta>) {
    if (event.type === 'session.started') { t0 = performance.now(); state.value = 'live' }
    else if (event.type === 'session.input_transcript.delta') onDelta('elder', event as Delta)
    else if (event.type === 'session.output_transcript.delta') onDelta('carrie', event as Delta)
    else if (event.type === 'session.closed') { closed?.(); state.value = 'closed' }
    else if (event.type === 'error') { console.error('[liveCall]', event); error.value = event.error?.message ?? 'Live call error' }
  }

  function captureMic(stream: MediaStream) {
    ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const node = ctx.createScriptProcessor(4096, 1, 1)
    const step = ctx.sampleRate / CLIP_RATE
    micT0 = performance.now()
    node.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const out = new Int16Array(Math.floor(input.length / step))
      for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, input[Math.floor(i * step)])) * 0x7fff
      pcm.push(out)
      pcmSamples += out.length
    }
    source.connect(node)
    node.connect(ctx.destination) // a ScriptProcessor only runs while connected; it outputs silence
  }

  function samples(): Int16Array {
    const all = new Int16Array(pcmSamples)
    let o = 0
    for (const chunk of pcm) { all.set(chunk, o); o += chunk.length }
    return all
  }

  const offsetMs = () => (t0 ? t0 - micT0 : 0)

  async function start(options: LiveStartOptions = {}) {
    if (state.value === 'connecting' || state.value === 'live') return
    state.value = 'connecting'
    error.value = null
    pcm = []
    pcmSamples = 0
    t0 = 0
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      captureMic(mic)
      pc = new RTCPeerConnection()
      pc.ontrack = (e) => {
        remoteStream.value = e.streams[0] ?? null
        if (audio) audio.srcObject = remoteStream.value
      }
      mic.getTracks().forEach((track) => pc!.addTrack(track, mic!))
      dc = pc.createDataChannel('oai-events') // must exist before createOffer
      dc.onmessage = (e) => onEvent(JSON.parse(e.data))

      await pc.setLocalDescription(await pc.createOffer())
      await new Promise<void>((resolve) => {
        if (pc!.iceGatheringState === 'complete') return resolve()
        pc!.addEventListener('icegatheringstatechange', () => pc?.iceGatheringState === 'complete' && resolve())
        setTimeout(resolve, 10_000)
      })
      const res = await fetch('/api/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: pc.localDescription!.sdp, ...options }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Could not start the call (${res.status})`)
      await pc.setRemoteDescription({ type: 'answer', sdp: body.sdp })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      state.value = 'error'
      release()
      throw cause
    }
  }

  function instruct(content: string) {
    if (dc?.readyState !== 'open') return false
    dc.send(JSON.stringify({ type: 'session.instructions.append', event_id: crypto.randomUUID(), delegation_id: null, content }))
    return true
  }

  /** Have Carrie ask Rose a question out loud once she finishes her current thought (e.g. a sharing question). */
  const ask = (question: string) =>
    instruct(`As soon as Rose finishes her current thought, ask her this in your own warm words: "${question}" Ask only this, then listen.`)

  /** Tell Carrie something that just happened, e.g. "Leo's voice note has just finished playing." */
  const tell = (what: string) => instruct(what)

  /** Rose's audio for transcript times [startMs, endMs], padded slightly, as a WAV Blob. */
  function cutClip(startMs: number, endMs: number): Blob | null {
    if (!pcmSamples) return null
    const from = Math.max(0, Math.floor(((startMs + offsetMs() - CLIP_PAD_MS) / 1000) * CLIP_RATE))
    const to = Math.min(pcmSamples, Math.ceil(((endMs + offsetMs() + CLIP_PAD_MS) / 1000) * CLIP_RATE))
    return to > from ? wavBlob(samples().subarray(from, to), CLIP_RATE) : null
  }

  /** The whole microphone recording so far (keeps recording until hangUp). */
  function stopRecording(): MicRecording {
    return { blob: wavBlob(samples(), CLIP_RATE), sampleRate: CLIP_RATE, offsetMs: offsetMs() }
  }

  async function hangUp() {
    flush('elder')
    flush('carrie')
    if (dc?.readyState === 'open') {
      dc.send(JSON.stringify({ type: 'session.close' }))
      await Promise.race([new Promise<void>((r) => (closed = r)), new Promise((r) => setTimeout(r, 3000))])
    }
    release()
    if (state.value !== 'error') state.value = 'closed'
  }

  function release() {
    mic?.getTracks().forEach((t) => t.stop())
    void ctx?.close().catch(() => {})
    pc?.close()
    if (audio) audio.srcObject = null
    pc = dc = mic = ctx = null
    remoteStream.value = null
  }

  function onTranscript(cb: (t: LiveTranscript) => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  return { state, error, remoteStream, audio, start, hangUp, ask, tell, onTranscript, cutClip, stopRecording }
}

export type LiveCall = ReturnType<typeof createLiveCall>

function wavBlob(samples: Int16Array, rate: number): Blob {
  const h = new DataView(new ArrayBuffer(44))
  const tag = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)))
  tag(0, 'RIFF'); h.setUint32(4, 36 + samples.length * 2, true); tag(8, 'WAVE')
  tag(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true)
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true)
  tag(36, 'data'); h.setUint32(40, samples.length * 2, true)
  return new Blob([h.buffer, samples.slice().buffer], { type: 'audio/wav' })
}

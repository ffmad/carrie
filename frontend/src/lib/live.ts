import type { Recording } from './recorder'

/**
 * A GPT-Live 1 call over WebRTC. Carrie listens and speaks herself; this file only:
 *  - connects the microphone and plays Carrie's voice,
 *  - turns timed transcript pieces into whole turns (a pause of TURN_GAP_MS ends a turn),
 *  - keeps the microphone audio so each of Rose's turns gets its own clip (the receipt),
 *  - lets the app tell Carrie something mid-call (a sharing question to ask, a voice note that finished).
 */
const TURN_GAP_MS = 1000
const CLIP_RATE = 16000
const CLIP_PAD_MS = 250

interface Delta { delta: string; start_ms: number; end_ms: number }

export interface LiveCallHandlers {
  onStarted?(): void
  /** Rose's words so far in the current turn (for live captions). */
  onElderPartial?(text: string): void
  /** Rose finished a turn: her words and the clip of her saying them. */
  onElderTurn?(text: string, clip: Recording | null): void
  onCarrieSpeaking?(speaking: boolean, textSoFar: string): void
  onCarrieTurn?(text: string): void
  onClosed?(): void
  onError?(message: string): void
}

export interface LiveCallOptions {
  pendingVoiceNotes?: { from: string; transcript: string }[]
  earlierFacts?: string[]
}

export class LiveCall {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private mic: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private player: HTMLAudioElement | null = null
  private pcm: Int16Array[] = []
  private pcmSamples = 0
  /** performance.now() when session.started arrived; transcript times count from there. */
  private t0 = 0
  /** performance.now() when mic capture began, to line clips up with transcript times. */
  private micT0 = 0
  private elder = { text: '', start: 0, end: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 }
  private carrie = { text: '', timer: 0 as ReturnType<typeof setTimeout> | 0 }
  private closedResolve: (() => void) | null = null

  constructor(private handlers: LiveCallHandlers) {}

  async start(options: LiveCallOptions = {}, mic?: MediaStream) {
    // The caller may hand over a microphone it already opened, so it is asked for only once.
    this.mic = mic ?? (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }))
    this.captureMic(this.mic)

    const pc = (this.pc = new RTCPeerConnection())
    this.player = new Audio()
    this.player.autoplay = true
    pc.ontrack = (event) => { if (this.player) this.player.srcObject = event.streams[0] ?? null }
    this.mic.getTracks().forEach((track) => pc.addTrack(track, this.mic!))

    const dc = (this.dc = pc.createDataChannel('oai-events'))
    dc.onmessage = (event) => this.onEvent(JSON.parse(event.data))

    await pc.setLocalDescription(await pc.createOffer())
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve()
      const done = () => pc.iceGatheringState === 'complete' && resolve()
      pc.addEventListener('icegatheringstatechange', done)
      setTimeout(resolve, 10_000)
    })

    const response = await fetch('/api/live/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp: pc.localDescription!.sdp, ...options }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? `Could not start the call (${response.status})`)
    await pc.setRemoteDescription({ type: 'answer', sdp: body.sdp })
  }

  /** Tell Carrie something she should act on, e.g. "ask Rose: may I tell Dr. Chen about your knee?" */
  instruct(content: string) {
    if (this.dc?.readyState !== 'open') return
    this.dc.send(JSON.stringify({ type: 'session.instructions.append', event_id: crypto.randomUUID(), delegation_id: null, content }))
  }

  /** Hang up politely: ask the session to close, wait briefly for session.closed, then release everything. */
  async close() {
    this.flushElder()
    this.flushCarrie()
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify({ type: 'session.close' }))
      await Promise.race([new Promise<void>((r) => (this.closedResolve = r)), new Promise((r) => setTimeout(r, 3000))])
    }
    this.release()
  }

  private release() {
    this.mic?.getTracks().forEach((t) => t.stop())
    void this.audioCtx?.close().catch(() => {})
    this.pc?.close()
    if (this.player) this.player.srcObject = null
    this.pc = this.dc = this.mic = this.audioCtx = this.player = null
  }

  private onEvent(event: { type: string } & Partial<Delta> & { error?: { message?: string } }) {
    switch (event.type) {
      case 'session.started':
        this.t0 = performance.now()
        // GPT-Live waits for the caller unless told to speak (found on the first real call, see liveCall.ts).
        this.dc?.send(JSON.stringify({ type: 'session.commentary.append', event_id: crypto.randomUUID(), delegation_id: null,
          content: 'Rose has just picked up the phone. Greet her now: say you are Carrie, an AI helper, and ask how she has been.' }))
        this.handlers.onStarted?.()
        break
      case 'session.input_transcript.delta':
        this.onElderDelta(event as Delta)
        break
      case 'session.output_transcript.delta':
        this.onCarrieDelta(event as Delta)
        break
      case 'session.closed':
        this.closedResolve?.()
        this.handlers.onClosed?.()
        break
      case 'error':
        console.error('[live]', event)
        this.handlers.onError?.(event.error?.message ?? 'Live call error')
        break
    }
  }

  private onElderDelta(d: Delta) {
    if (!this.elder.text) this.elder.start = d.start_ms
    this.elder.text += d.delta
    this.elder.end = d.end_ms
    this.handlers.onElderPartial?.(this.elder.text.trim())
    clearTimeout(this.elder.timer)
    this.elder.timer = setTimeout(() => this.flushElder(), TURN_GAP_MS)
  }

  private flushElder() {
    clearTimeout(this.elder.timer)
    const text = this.elder.text.trim()
    const { start, end } = this.elder
    this.elder = { text: '', start: 0, end: 0, timer: 0 }
    if (text) this.handlers.onElderTurn?.(text, this.clip(start, end))
  }

  private onCarrieDelta(d: Delta) {
    this.carrie.text += d.delta
    this.handlers.onCarrieSpeaking?.(true, this.carrie.text.trim())
    clearTimeout(this.carrie.timer)
    this.carrie.timer = setTimeout(() => this.flushCarrie(), TURN_GAP_MS)
  }

  private flushCarrie() {
    clearTimeout(this.carrie.timer)
    const text = this.carrie.text.trim()
    this.carrie = { text: '', timer: 0 }
    this.handlers.onCarrieSpeaking?.(false, '')
    if (text) this.handlers.onCarrieTurn?.(text)
  }

  /** Keep the microphone as 16 kHz PCM so any stretch of it can become a WAV clip. */
  private captureMic(stream: MediaStream) {
    const ctx = (this.audioCtx = new AudioContext())
    const source = ctx.createMediaStreamSource(stream)
    const node = ctx.createScriptProcessor(4096, 1, 1)
    const step = ctx.sampleRate / CLIP_RATE
    this.micT0 = performance.now()
    node.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const out = new Int16Array(Math.floor(input.length / step))
      for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, input[Math.floor(i * step)])) * 0x7fff
      this.pcm.push(out)
      this.pcmSamples += out.length
    }
    source.connect(node)
    node.connect(ctx.destination) // a ScriptProcessor only runs while connected; it outputs silence
  }

  private clip(startMs: number, endMs: number): Recording | null {
    if (!this.pcmSamples || !this.t0) return null
    const offset = this.t0 - this.micT0 // transcript time 0 = this many ms into our mic capture
    const from = Math.max(0, Math.floor(((startMs + offset - CLIP_PAD_MS) / 1000) * CLIP_RATE))
    const to = Math.min(this.pcmSamples, Math.ceil(((endMs + offset + CLIP_PAD_MS) / 1000) * CLIP_RATE))
    if (to <= from) return null
    const all = new Int16Array(this.pcmSamples)
    let o = 0
    for (const chunk of this.pcm) { all.set(chunk, o); o += chunk.length }
    const blob = wavBlob(all.subarray(from, to), CLIP_RATE)
    return { blob, durationMs: Math.round(((to - from) / CLIP_RATE) * 1000), mimeType: 'audio/wav', extension: 'wav' }
  }
}

function wavBlob(samples: Int16Array, rate: number): Blob {
  const header = new DataView(new ArrayBuffer(44))
  const tag = (o: number, s: string) => [...s].forEach((c, i) => header.setUint8(o + i, c.charCodeAt(0)))
  tag(0, 'RIFF'); header.setUint32(4, 36 + samples.length * 2, true); tag(8, 'WAVE')
  tag(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true)
  header.setUint32(24, rate, true); header.setUint32(28, rate * 2, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true)
  tag(36, 'data'); header.setUint32(40, samples.length * 2, true)
  return new Blob([header.buffer, samples.slice().buffer], { type: 'audio/wav' })
}

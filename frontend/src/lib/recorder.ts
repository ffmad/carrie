/** MediaRecorder helper: start -> stop gives a Blob (webm, or mp4 on Safari) and its duration. */
export interface Recording {
  blob: Blob
  durationMs: number
  mimeType: string
  extension: 'webm' | 'mp4'
}

export interface ActiveRecording {
  stop(): Promise<Recording>
  cancel(): void
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

export const recorderSupported =
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia)

function pickMimeType(): string {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

/** Asks for the microphone and starts recording. Rejects if unsupported or permission is denied. */
export async function startRecording(): Promise<ActiveRecording> {
  if (!recorderSupported) throw new Error('Recording is not supported in this browser')
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  const startedAt = performance.now()
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  const release = () => stream.getTracks().forEach((track) => track.stop())

  return {
    stop: () =>
      new Promise<Recording>((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            release()
            const type = recorder.mimeType || mimeType || 'audio/webm'
            resolve({
              blob: new Blob(chunks, { type }),
              durationMs: Math.round(performance.now() - startedAt),
              mimeType: type,
              extension: type.includes('mp4') ? 'mp4' : 'webm',
            })
          },
          { once: true },
        )
        if (recorder.state === 'inactive') recorder.dispatchEvent(new Event('stop'))
        else recorder.stop()
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      release()
    },
  }
}

/** Plays a clip to the end. Resolves (never rejects) so call flows cannot get stuck on a bad clip. */
export function playAudio(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url)
    audio.addEventListener('ended', () => resolve(), { once: true })
    audio.addEventListener('error', () => resolve(), { once: true })
    audio.play().catch(() => resolve())
  })
}

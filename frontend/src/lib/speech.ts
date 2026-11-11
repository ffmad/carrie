/**
 * Browser speech, feature-detected:
 *  - SpeechRecognition turns what the elder says into live captions.
 *  - speechSynthesis is Carrie's (clearly synthetic) voice.
 * Both degrade quietly: without recognition the UI falls back to typing,
 * without synthesis `speak` just waits roughly as long as the line would take.
 */
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const recognitionSupported = recognitionCtor() !== null
export const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

export interface Captioner {
  /** Stops listening and resolves with everything heard. */
  stop(): Promise<string>
  cancel(): void
}

/** Starts live captioning. `onInterim` receives the running transcript as the elder speaks. */
export function startCaptions(onInterim: (text: string) => void, lang = 'en-US'): Captioner | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = lang
  recognition.continuous = true
  recognition.interimResults = true

  let finalText = ''
  let interimText = ''
  let ended = false
  let onEnded: (() => void) | null = null

  recognition.onresult = (event) => {
    interimText = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (!result) continue
      if (result.isFinal) finalText += result[0].transcript + ' '
      else interimText += result[0].transcript
    }
    onInterim((finalText + interimText).trim())
  }
  recognition.onerror = () => {
    // 'no-speech' and 'aborted' are routine; onend always follows.
  }
  recognition.onend = () => {
    ended = true
    onEnded?.()
  }

  try {
    recognition.start()
  } catch {
    return null
  }

  const heard = () => (finalText + interimText).trim()

  return {
    stop: () =>
      new Promise<string>((resolve) => {
        if (ended) return resolve(heard())
        onEnded = () => resolve(heard())
        recognition.stop()
        // Some engines never fire onend after stop(); don't hang the call.
        setTimeout(() => resolve(heard()), 1500)
      }),
    cancel: () => recognition.abort(),
  }
}

/** Speaks a line in Carrie's voice and resolves when she has finished. */
export function speak(text: string): Promise<void> {
  const fallbackMs = Math.min(6000, 600 + text.length * 45)
  if (!synthesisSupported) return new Promise((resolve) => setTimeout(resolve, fallbackMs))

  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(guard)
      resolve()
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.1
    utterance.onend = finish
    utterance.onerror = finish
    // Guard: some browsers drop `onend` (or block audio before a user gesture).
    const guard = setTimeout(finish, fallbackMs + 12000)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking(): void {
  if (synthesisSupported) window.speechSynthesis.cancel()
}

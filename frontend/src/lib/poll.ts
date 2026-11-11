import { onMounted, onUnmounted } from 'vue'
import { useCallsStore } from '../stores/calls'
import { useCircleStore } from '../stores/circle'
import { useFactsStore } from '../stores/facts'
import { useRequestsStore } from '../stores/requests'
import { useSettingsStore } from '../stores/settings'
import { useVoiceNotesStore } from '../stores/voiceNotes'

/** Runs `fn` now and then every `ms` while the component is mounted. */
export function usePolling(fn: () => void | Promise<void>, ms = 3000) {
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    void fn()
    timer = setInterval(() => void fn(), ms)
  })
  onUnmounted(() => clearInterval(timer))
}

/**
 * Keeps every phone in step: what Rose says on hers shows up on Mia's a moment later.
 * Plain polling, so it works on any local Supabase without the realtime service.
 */
export function useLiveData(ms = 3000) {
  const circle = useCircleStore()
  const stores = [useCallsStore(), useFactsStore(), useVoiceNotesStore(), useRequestsStore(), useSettingsStore()]
  let first = true
  usePolling(async () => {
    if (first || !circle.people.length) await circle.load()
    first = false
    await Promise.all(stores.map((store) => store.load()))
  }, ms)
}

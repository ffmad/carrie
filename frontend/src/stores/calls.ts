import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { demoCalls } from '../lib/demoData'
import { fetchRows, supabase, toCall } from '../lib/supabase'
import type { Call } from '../types'

/** Every call Carrie has had with the elder, oldest first. The call in progress lives in stores/call.ts. */
export const useCallsStore = defineStore('calls', () => {
  const calls = ref<Call[]>(supabase ? [] : demoCalls)
  const loaded = ref(!supabase)

  const ended = computed(() => calls.value.filter((c) => c.endedAt))
  const latest = computed(() => ended.value[ended.value.length - 1] ?? null)
  const byId = (id: string | null): Call | null => calls.value.find((c) => c.id === id) ?? null

  async function load() {
    const rows = await fetchRows('calls', 'started_at')
    if (rows?.length) calls.value = rows.map(toCall)
    else if (!calls.value.length) calls.value = demoCalls
    loaded.value = true
  }

  return { calls, loaded, ended, latest, byId, load }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { demoRequests } from '../lib/demoData'
import { fetchRows, fromRequest, patchRow, saveRow, supabase, toRequest } from '../lib/supabase'
import type { CareRequest, RequestKind } from '../types'
import { useCircleStore } from './circle'

/**
 * What the family or the doctor give Carrie for the next call ("ask her…", "tell her…"),
 * and "check in now", which makes the elder's phone ring.
 */
export const useRequestsStore = defineStore('requests', () => {
  const circle = useCircleStore()
  const requests = ref<CareRequest[]>(supabase ? [] : demoRequests)
  const loaded = ref(!supabase)

  const pending = (kind?: RequestKind): CareRequest[] =>
    requests.value.filter((q) => q.status === 'pending' && (!kind || q.kind === kind))
  const from = (personId: string): CareRequest[] => requests.value.filter((q) => q.fromId === personId)

  async function load() {
    const rows = await fetchRows('requests')
    if (rows) {
      const local = requests.value.filter((q) => !rows.some((row) => row.id === q.id) && !demoRequests.includes(q))
      requests.value = [...rows.map(toRequest), ...local]
    }
    loaded.value = true
  }

  async function add(input: { fromId: string; kind: RequestKind; text?: string }): Promise<CareRequest> {
    const request: CareRequest = {
      id: crypto.randomUUID(),
      elderId: circle.elder.id,
      fromId: input.fromId,
      kind: input.kind,
      text: input.text?.trim() ?? '',
      status: 'pending',
      handledCallId: null,
      createdAt: new Date().toISOString(),
    }
    requests.value = [...requests.value, request]
    await saveRow('requests', fromRequest(request))
    return request
  }

  async function markDone(id: string, callId: string | null = null) {
    const request = requests.value.find((q) => q.id === id)
    if (!request || request.status === 'done') return
    request.status = 'done'
    request.handledCallId = callId
    await patchRow('requests', id, { status: 'done', handled_call_id: callId })
  }

  return { requests, loaded, pending, from, load, add, markDone }
})

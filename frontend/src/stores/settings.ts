import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { demoSettings } from '../lib/demoData'
import { fetchRows, patchRow, supabase, toSettings } from '../lib/supabase'
import type { CareSettings } from '../types'
import { useCircleStore } from './circle'

/** How Carrie looks after the elder: when she rings, what she checks on, who the main contact is. */
export const useSettingsStore = defineStore('settings', () => {
  const circle = useCircleStore()
  const settings = ref<CareSettings>(demoSettings)
  const loaded = ref(!supabase)

  const mainContact = computed(() => circle.byId(settings.value.mainContactId) ?? circle.family[0] ?? null)
  const isMainContact = (personId: string): boolean => mainContact.value?.id === personId

  async function load() {
    const rows = await fetchRows('care_settings', 'updated_at')
    if (rows?.length) settings.value = toSettings(rows[0]!)
    loaded.value = true
  }

  async function update(patch: Partial<Pick<CareSettings, 'callTime' | 'checks' | 'nextAppointment'>>) {
    settings.value = { ...settings.value, ...patch }
    await patchRow(
      'care_settings',
      settings.value.elderId,
      {
        ...(patch.callTime !== undefined && { call_time: patch.callTime }),
        ...(patch.checks !== undefined && { checks: patch.checks }),
        ...(patch.nextAppointment !== undefined && { next_appointment: patch.nextAppointment }),
        updated_at: new Date().toISOString(),
      },
      'elder_id',
    )
  }

  return { settings, loaded, mainContact, isMainContact, load, update }
})

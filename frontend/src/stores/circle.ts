import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { demoPeople } from '../lib/demoData'
import { fetchRows, supabase, toPerson } from '../lib/supabase'
import type { Person } from '../types'

/** The care circle (people) and who the app is currently being viewed as. */
export type ViewerKey = 'rose' | 'mia' | 'leo' | 'dr-chen'
export const VIEWER_KEYS: ViewerKey[] = ['rose', 'mia', 'leo', 'dr-chen']

const STORAGE_KEY = 'carrie.viewer'

/** "Dr. Chen" -> "dr-chen" */
export const personKey = (person: Person): string =>
  person.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const homeRouteFor = (key: ViewerKey): string =>
  key === 'rose' ? '/rose' : key === 'dr-chen' ? '/doctor' : `/family/${key}`

function storedViewer(): ViewerKey {
  try {
    const value = localStorage.getItem(STORAGE_KEY) as ViewerKey | null
    return value && VIEWER_KEYS.includes(value) ? value : 'rose'
  } catch {
    return 'rose'
  }
}

export const useCircleStore = defineStore('circle', () => {
  // Demo data straight away when Supabase is not configured; otherwise wait for load().
  const people = ref<Person[]>(supabase ? [] : demoPeople)
  const source = ref<'demo' | 'supabase'>('demo')
  const loaded = ref(!supabase)
  const viewerKey = ref<ViewerKey>(storedViewer())

  const elder = computed(() => people.value.find((p) => p.role === 'elder') ?? demoPeople[0]!)
  const family = computed(() => people.value.filter((p) => p.role === 'family'))
  const doctor = computed(() => people.value.find((p) => p.role === 'doctor') ?? null)

  function personFor(key: ViewerKey): Person {
    const byName = people.value.find((p) => personKey(p) === key)
    if (byName) return byName
    if (key === 'rose') return elder.value
    if (key === 'dr-chen') return doctor.value ?? elder.value
    return family.value[key === 'mia' ? 0 : 1] ?? family.value[0] ?? elder.value
  }

  const viewer = computed(() => personFor(viewerKey.value))
  const byId = (id: string | null): Person | null => people.value.find((p) => p.id === id) ?? null

  function viewAs(key: ViewerKey) {
    viewerKey.value = key
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      // Private mode: the choice just won't survive a reload.
    }
  }

  async function load() {
    const rows = await fetchRows('people')
    if (rows?.length) {
      people.value = rows.map(toPerson)
      source.value = 'supabase'
    } else {
      people.value = demoPeople
    }
    loaded.value = true
  }

  return { people, source, loaded, viewerKey, viewer, elder, family, doctor, personFor, byId, viewAs, load }
})

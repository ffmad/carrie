import type { Audience, FactCategory } from '../types'

export const CATEGORY_LABELS: Record<FactCategory, string> = {
  health: 'Health',
  medication: 'Medication',
  mood: 'Mood',
  daily: 'Daily life',
  social: 'Family and friends',
  request: 'Request',
}

export const AUDIENCE_LABELS: Record<Audience, string> = {
  family: 'my family',
  doctor: 'my doctor',
}

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' })

/** "Today", "Yesterday" or "Tuesday, Nov 10". */
export function formatDay(iso: string): string {
  const date = new Date(iso)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return dayFormat.format(date)
}

export const initialOf = (name: string): string => name.replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase()

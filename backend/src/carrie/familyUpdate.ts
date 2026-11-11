import OpenAI from 'openai'
import { env } from '../env'
import type { FamilyUpdateRequest, FamilyUpdateResponse } from './types'

const PROMPT = `You help a family stay close to Rose (78), who lives alone. Carrie, an AI, phones her daily. Below are ONLY the things Rose agreed to share with family, each with an id and a date.

Write two things for one family member:
1. "alerts": heads-ups on change worth noticing. Examples: the same symptom on 2 or more different days ("Dizzy when getting up, 2 days running"); something new and potentially serious (a fall, a new pain, not eating). At most 3. Skip routine, unchanged or happy things. Each points at the most recent fact it is about.
2. "nudge": a gentle reason to call Rose now, plus 2 or 3 things to talk about, so the call doesn't feel awkward. Prefer warm, personal things (her garden, a question she asked about them, something she's looking forward to) over symptoms. If she asked about this family member, lead with that.

Rules: use only what is in the facts. Never diagnose, never add advice, never invent. Plain, short, kind English. "text" fields are one short line. Every factId must be one of the ids given.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['alerts', 'nudge'],
  properties: {
    alerts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['factId', 'text'], properties: { factId: { type: 'string' }, text: { type: 'string' } } } },
    nudge: {
      type: 'object',
      additionalProperties: false,
      required: ['reason', 'talkAbout'],
      properties: {
        reason: { type: 'string' },
        talkAbout: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['factId', 'text'], properties: { factId: { type: 'string' }, text: { type: 'string' } } } },
      },
    },
  },
} as const

const DAY = 86_400_000

export async function familyUpdate(req: FamilyUpdateRequest): Promise<{ response: FamilyUpdateResponse; source: 'openai' | 'rules' }> {
  const now = req.now ? Date.parse(req.now) : Date.now()
  const daysSinceLastCall = req.member.lastSpokeWithElder ? Math.max(0, Math.floor((now - Date.parse(req.member.lastSpokeWithElder)) / DAY)) : null
  const recent = req.sharedFacts.filter((f) => now - Date.parse(f.createdAt) <= 14 * DAY).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (!recent.length) return { response: { alerts: [], nudge: null }, source: 'rules' }
  const ids = new Set(recent.map((f) => f.id))
  const valid = (list: { factId: string; text: string }[]) => list.filter((x) => ids.has(x.factId))

  if (env.openaiApiKey) {
    try {
      const facts = recent.map((f) => `- id=${f.id} | ${f.createdAt.slice(0, 10)} | ${f.category} | ${f.statement} | "${f.quote}"`).join('\n')
      const res = await new OpenAI({ apiKey: env.openaiApiKey, timeout: 20_000, maxRetries: 1 }).responses.create({
        model: env.factsModel,
        input: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: `Family member: ${req.member.name}${req.member.relation ? ` (${req.member.relation})` : ''}. Today: ${new Date(now).toISOString().slice(0, 10)}.${daysSinceLastCall !== null ? ` They last spoke with Rose ${daysSinceLastCall} days ago.` : ''}\n\nShared facts:\n${facts}` },
        ],
        text: { format: { type: 'json_schema', name: 'family_update', schema: SCHEMA as any, strict: true } },
      })
      const out = JSON.parse(res.output_text)
      return {
        response: { alerts: valid(out.alerts).slice(0, 3), nudge: { reason: out.nudge.reason, daysSinceLastCall, talkAbout: valid(out.nudge.talkAbout).slice(0, 3) } },
        source: 'openai',
      }
    } catch (error) {
      console.error(`[carrie] family update via OpenAI failed, using rules: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Rules fallback: health facts from the last 2 days are heads-ups; warm, recent things are talking points.
  const alerts = recent.filter((f) => f.category === 'health' && now - Date.parse(f.createdAt) <= 2 * DAY).slice(0, 3).map((f) => ({ factId: f.id, text: f.statement }))
  const warm = recent.filter((f) => ['social', 'mood', 'daily', 'request'].includes(f.category))
  const talkAbout = (warm.length ? warm : recent).slice(0, 3).map((f) => ({ factId: f.id, text: f.statement }))
  const reason = daysSinceLastCall !== null && daysSinceLastCall >= 3 ? `You last spoke with Rose ${daysSinceLastCall} days ago.` : 'Rose shared a few things this week.'
  return { response: { alerts, nudge: { reason, daysSinceLastCall, talkAbout } }, source: 'rules' }
}

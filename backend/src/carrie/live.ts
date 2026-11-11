import OpenAI from 'openai'
import { env } from '../env'
import { FACTS_PROMPT, livePrompt } from './prompt'
import { carrieTurn, keepVerbatimFacts } from './turn'
import { AUDIENCES, FACT_CATEGORIES, type FactsRequest, type FactsResponse, type LiveSessionRequest, type LiveSessionResponse } from './types'

let client: OpenAI | null = null
const openai = () => (client ??= new OpenAI({ apiKey: env.openaiApiKey ?? undefined, timeout: 20_000, maxRetries: 1 }))

/** Start a GPT-Live 1 call over WebRTC. The browser sent its offer; we return the answer. */
export async function startLiveSession(req: LiveSessionRequest): Promise<LiveSessionResponse> {
  const res = await openai().live.create(
    {
      session: {
        model: env.liveModel,
        instructions: livePrompt(req),
        audio: { output: { voice: env.liveVoice } },
      },
      transport: { type: 'webrtc', sdp: req.sdp },
    },
    { maxRetries: 0 },
  )
  return { sessionId: res.session.id, sdp: res.transport.sdp }
}

const FACTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['facts', 'consentQuestion'],
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'statement', 'quote'],
        properties: {
          category: { type: 'string', enum: [...FACT_CATEGORIES] },
          statement: { type: 'string' },
          quote: { type: 'string' },
        },
      },
    },
    consentQuestion: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['factIndex', 'audience', 'question'],
          properties: { factIndex: { type: 'integer' }, audience: { type: 'string', enum: [...AUDIENCES] }, question: { type: 'string' } },
        },
      ],
    },
  },
} as const

const SPEAKER = { elder: 'Rose', carrie: 'Carrie', family: 'Family voice note' } as const

async function openaiFacts(req: FactsRequest): Promise<FactsResponse> {
  const callSoFar = req.history.map((h) => `${SPEAKER[h.speaker]}: ${h.text}`).join('\n')
  const res = await openai().responses.create({
    model: env.factsModel,
    input: [
      { role: 'system', content: FACTS_PROMPT },
      { role: 'user', content: `<call_so_far>\n${callSoFar || '(none)'}\n</call_so_far>\n\n<rose_just_said>\n${req.elderText.trim()}\n</rose_just_said>` },
    ],
    text: { format: { type: 'json_schema', name: 'rose_facts', schema: FACTS_SCHEMA as any, strict: true } },
  })
  const parsed = JSON.parse(res.output_text)
  const { reply: _unused, ...rest } = keepVerbatimFacts({ reply: '', ...parsed }, req.elderText)
  return rest
}

export type FactsSource = 'openai' | 'claude' | 'script' | 'script-fallback' | 'openai-failed'

/** Facts from what Rose just said. OpenAI when its key is set, otherwise the existing turn path without its reply. */
export async function extractFacts(req: FactsRequest): Promise<{ response: FactsResponse; source: FactsSource }> {
  if (!req.elderText.trim()) return { response: { facts: [] }, source: env.openaiApiKey ? 'openai' : 'script' }
  if (env.openaiApiKey) {
    try {
      return { response: await openaiFacts(req), source: 'openai' }
    } catch (error) {
      console.error(`[carrie] OpenAI facts failed: ${error instanceof Error ? error.message : String(error)}`)
      return { response: { facts: [] }, source: 'openai-failed' }
    }
  }
  const { response, source } = await carrieTurn(req)
  const { reply: _unused, ...rest } = response
  return { response: rest, source }
}

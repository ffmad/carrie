import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { env } from '../env'
import { CARRIE_SYSTEM_PROMPT } from './prompt'
import { scriptedTurn } from './script'
import { AUDIENCES, FACT_CATEGORIES, type TurnRequest, type TurnResponse } from './types'

/** Structured output schema. `consentQuestion` is nullable (not optional) so the schema stays strict. */
const TurnOutput = z.object({
  reply: z.string(),
  facts: z.array(
    z.object({
      category: z.enum(FACT_CATEGORIES),
      statement: z.string(),
      quote: z.string(),
    }),
  ),
  consentQuestion: z
    .object({
      factIndex: z.number(),
      audience: z.enum(AUDIENCES),
      question: z.string(),
    })
    .nullable(),
})

/**
 * Claude Sonnet 5.5 rejects `thinking: disabled`; `between_tools` is its lowest setting (no extended
 * thinking, so max_tokens goes to the reply). Other models reject that value, so they keep their
 * default adaptive thinking at low effort.
 */
const FAST_THINKING: Anthropic.ThinkingConfigParam | null = env.carrieModel.startsWith('claude-sonnet-5-5')
  ? { type: 'between_tools' }
  : null

export type TurnSource = 'claude' | 'script' | 'script-fallback'

let client: Anthropic | null = null
function getClient(): Anthropic {
  // Short timeout and a single retry: this is a live phone call.
  client ??= new Anthropic({
    apiKey: env.anthropicApiKey ?? undefined,
    timeout: 20_000,
    maxRetries: 1,
    // Keys that are not scoped to a workspace must name one on every request.
    defaultHeaders: env.anthropicWorkspaceId ? { 'anthropic-workspace-id': env.anthropicWorkspaceId } : undefined,
  })
  return client
}

const SPEAKER_LABEL = { elder: 'Rose', carrie: 'Carrie', family: 'Family voice note' } as const

function buildUserMessage(req: TurnRequest): string {
  const transcript = req.history.map((h) => `${SPEAKER_LABEL[h.speaker]}: ${h.text}`).join('\n')
  const notes = (req.pendingVoiceNotes ?? []).map((n) => `- from ${n.from}`).join('\n')
  const parts = [
    `<call_so_far>\n${transcript || '(the call has just connected)'}\n</call_so_far>`,
    notes ? `<pending_voice_notes>\n${notes}\n</pending_voice_notes>` : '',
    req.elderText.trim()
      ? `<rose_just_said>\n${req.elderText.trim()}\n</rose_just_said>`
      : 'Rose has just picked up the phone. Give your opening line.',
  ]
  return parts.filter(Boolean).join('\n\n')
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Carrie never claims anything she can't play back: keep only facts quoted from the elder's own words. */
function keepVerbatimFacts(output: z.infer<typeof TurnOutput>, elderText: string): TurnResponse {
  const said = normalize(elderText)
  const kept: TurnResponse['facts'] = []
  let consentIndex = -1
  output.facts.forEach((fact, index) => {
    const quote = normalize(fact.quote)
    if (!quote || !said.includes(quote)) return
    if (output.consentQuestion?.factIndex === index) consentIndex = kept.length
    kept.push(fact)
  })
  const response: TurnResponse = { reply: output.reply, facts: kept }
  if (output.consentQuestion && consentIndex >= 0) {
    response.consentQuestion = { ...output.consentQuestion, factIndex: consentIndex }
  }
  return response
}

async function claudeTurn(req: TurnRequest): Promise<TurnResponse> {
  const response = await getClient().messages.parse({
    model: env.carrieModel,
    max_tokens: 4096,
    system: CARRIE_SYSTEM_PROMPT,
    // Latency matters on a phone call: low effort, and no extended thinking where the model allows it.
    ...(FAST_THINKING ? { thinking: FAST_THINKING } : {}),
    output_config: { effort: 'low', format: zodOutputFormat(TurnOutput) },
    messages: [{ role: 'user', content: buildUserMessage(req) }],
  })
  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined the turn (${response.stop_details?.category ?? 'no category'})`)
  }
  if (!response.parsed_output) {
    throw new Error(`Claude returned no parsable output (stop_reason: ${response.stop_reason})`)
  }
  return keepVerbatimFacts(response.parsed_output, req.elderText)
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'invalid ANTHROPIC_API_KEY'
  if (error instanceof Anthropic.RateLimitError) return 'rate limited'
  if (error instanceof Anthropic.APIConnectionError) return `connection problem: ${error.message}`
  if (error instanceof Anthropic.APIError) return `API error ${error.status}: ${error.message}`
  return error instanceof Error ? error.message : String(error)
}

/** One conversational turn. Uses Claude when a key is configured, the scripted call otherwise or on failure. */
export async function carrieTurn(req: TurnRequest): Promise<{ response: TurnResponse; source: TurnSource }> {
  if (!env.anthropicApiKey) return { response: scriptedTurn(req), source: 'script' }
  try {
    return { response: await claudeTurn(req), source: 'claude' }
  } catch (error) {
    console.error(`[carrie] Claude turn failed, using the script: ${describeError(error)}`)
    return { response: scriptedTurn(req), source: 'script-fallback' }
  }
}

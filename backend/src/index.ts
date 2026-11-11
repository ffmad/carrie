import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env'
import { carrieTurn } from './carrie/turn'
import { FactsRequestSchema, LiveSessionRequestSchema, TurnRequestSchema } from './carrie/types'
import { extractFacts, startLiveSession } from './carrie/live'
import { recall, remember } from './carrie/memory'

const app = new Hono()

app.use('/api/*', cors())

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'carrie-backend',
    carrie: env.anthropicApiKey ? 'claude' : 'script',
    model: env.anthropicApiKey ? env.carrieModel : null,
    live: env.openaiApiKey ? env.liveModel : null,
    facts: env.openaiApiKey ? env.factsModel : env.anthropicApiKey ? env.carrieModel : 'script',
    time: new Date().toISOString(),
  }),
)

app.post('/api/carrie/turn', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = TurnRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', issues: parsed.error.issues }, 400)
  }
  const { response, source } = await carrieTurn(parsed.data)
  c.header('x-carrie-source', source)
  return c.json(response)
})

/** GPT-Live 1 call: browser sends its WebRTC offer, gets the answer back. Audio then flows browser <-> OpenAI. */
app.post('/api/live/session', async (c) => {
  if (!env.openaiApiKey) return c.json({ error: 'OPENAI_API_KEY is not set in backend/.env' }, 503)
  const parsed = LiveSessionRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid request body', issues: parsed.error.issues }, 400)
  try {
    const req = parsed.data
    if (req.earlierFacts === undefined) req.earlierFacts = await recall()
    return c.json(await startLiveSession(req), 201)
  } catch (error) {
    console.error('[carrie] live session failed', error)
    return c.json({ error: error instanceof Error ? error.message : 'live session failed' }, 502)
  }
})

/** Facts from Rose's latest words, beside a live call. A TurnResponse without `reply`. */
app.post('/api/carrie/facts', async (c) => {
  const parsed = FactsRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid request body', issues: parsed.error.issues }, 400)
  const { response, source } = await extractFacts(parsed.data)
  // Save to GBrain memory without holding up the response.
  // One at a time: the local brain is a single PGLite database.
  if (response.facts.length) {
    const callId = parsed.data.callId
    void response.facts.reduce((prev, fact) => prev.then(() => remember(fact, callId)), Promise.resolve())
  }
  c.header('x-carrie-source', source)
  return c.json(response)
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((error, c) => {
  console.error('[carrie] unhandled error', error)
  return c.json({ error: 'Internal error' }, 500)
})

serve({ fetch: app.fetch, port: env.port }, (info) => {
  const mode = env.anthropicApiKey ? `Claude (${env.carrieModel})` : 'scripted fallback (no ANTHROPIC_API_KEY)'
  console.log(`Carrie backend on http://localhost:${info.port}, turns via ${mode}`)
})

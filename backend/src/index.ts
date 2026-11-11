import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env'
import { carrieTurn } from './carrie/turn'
import { TurnRequestSchema } from './carrie/types'

const app = new Hono()

app.use('/api/*', cors())

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'carrie-backend',
    carrie: env.anthropicApiKey ? 'claude' : 'script',
    model: env.anthropicApiKey ? env.carrieModel : null,
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

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((error, c) => {
  console.error('[carrie] unhandled error', error)
  return c.json({ error: 'Internal error' }, 500)
})

serve({ fetch: app.fetch, port: env.port }, (info) => {
  const mode = env.anthropicApiKey ? `Claude (${env.carrieModel})` : 'scripted fallback (no ANTHROPIC_API_KEY)'
  console.log(`Carrie backend on http://localhost:${info.port}, turns via ${mode}`)
})

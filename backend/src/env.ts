import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Load backend/.env if present. Real environment variables win over the file.
const envPath = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envPath)) process.loadEnvFile(envPath)

export const env = {
  port: Number(process.env.PORT ?? 3050),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  /** Only needed for API keys that are not tied to a single workspace. */
  anthropicWorkspaceId: process.env.ANTHROPIC_WORKSPACE_ID?.trim() || null,
  carrieModel: process.env.CARRIE_MODEL?.trim() || 'claude-sonnet-5-5',
  /** OpenAI: GPT-Live 1 runs the call; a text model pulls facts out beside it. */
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
  liveModel: process.env.LIVE_MODEL?.trim() || 'gpt-live-1',
  liveVoice: process.env.LIVE_VOICE?.trim() || 'marin',
  factsModel: process.env.FACTS_MODEL?.trim() || 'gpt-6-luna',
}

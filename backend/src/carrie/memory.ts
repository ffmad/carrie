import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ExtractedFact } from './types'

/**
 * Carrie's memory: GBrain (https://github.com/garrytan/gbrain), via its CLI.
 * Each fact is saved with its source (call id + Rose's exact words) and recalled into the next call.
 * If gbrain is missing or fails, memory is simply empty; it never breaks an endpoint.
 */

const BACKEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const BRAIN_HOME = resolve(BACKEND_DIR, '.brain')
const BUN_BIN = resolve(homedir(), '.bun/bin')
const ENTITY = 'rose'

let warned = false
function warnOnce(error: unknown) {
  if (warned) return
  warned = true
  console.warn(`[carrie] GBrain memory unavailable, continuing without it: ${error instanceof Error ? error.message : String(error)}`)
}

function gbrain(args: string[], timeoutMs = 15_000): Promise<string> {
  return new Promise((done, fail) => {
    const child = execFile(
      'gbrain',
      args,
      {
        env: { ...process.env, GBRAIN_HOME: BRAIN_HOME, PATH: `${BUN_BIN}:${process.env.PATH ?? ''}` },
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => (error ? fail(new Error(`${error.message} ${String(stderr).trim()}`.trim())) : done(String(stdout))),
    )
    // A gbrain command left waiting on stdin hangs forever.
    child.stdin?.end()
  })
}

/** Save one fact Rose said, with the call and her exact words as provenance. */
export async function remember(fact: ExtractedFact, callId?: string, when: Date = new Date()): Promise<void> {
  try {
    await gbrain([
      'remember',
      `[${fact.category}] ${fact.statement}`,
      '--entity', ENTITY,
      '--provenance', `${callId || 'call'} "${fact.quote}"`.slice(0, 500),
      '--content-origin', 'tool_output',
      '--valid-from', when.toISOString().slice(0, 10),
      '--json',
    ])
  } catch (error) {
    warnOnce(error)
  }
}

/** Facts about Rose from earlier calls, newest first, at most 30. */
export async function recall(): Promise<string[]> {
  try {
    const out = await gbrain(['recall', ENTITY, '--json'])
    const parsed = JSON.parse(out.slice(out.indexOf('{'))) as { facts?: { fact?: string; valid_from?: string | null; created_at?: string | null }[] }
    const time = (f: { valid_from?: string | null; created_at?: string | null }) => Date.parse(f.created_at ?? f.valid_from ?? '') || 0
    return (parsed.facts ?? [])
      .filter((f) => typeof f.fact === 'string' && f.fact.trim())
      .sort((a, b) => time(b) - time(a))
      .slice(0, 30)
      .map((f) => f.fact as string)
  } catch (error) {
    warnOnce(error)
    return []
  }
}

// Fill Carrie's memory (GBrain) with the same demo week as supabase/seed.sql, so what Carrie
// remembers on the call matches what Mia, Leo and Dr. Chen see. Run after `npm run memory:init`.
//   npm run memory:seed
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { remember, recall } from '../src/carrie/memory'
import type { ExtractedFact } from '../src/carrie/types'

const seed = readFileSync(fileURLToPath(new URL('../../supabase/seed.sql', import.meta.url)), 'utf8')
const block = seed.slice(seed.indexOf('insert into public.facts'), seed.indexOf(';\n', seed.indexOf('insert into public.facts')))
const row = /'(social|health|medication|mood|daily|request)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',[\s\S]*?now\(\) - interval '(\d+) days?'/g
let n = 0
for (const m of block.matchAll(row)) {
  const fact = { category: m[1], statement: m[2].replaceAll("''", "'"), quote: m[3].replaceAll("''", "'") } as ExtractedFact
  await remember(fact, `seed-call-${m[4]}d-ago`, new Date(Date.now() - Number(m[4]) * 86_400_000))
  n++
}
console.log(`seeded ${n} facts; Carrie now recalls:`)
for (const f of await recall()) console.log(' -', f)

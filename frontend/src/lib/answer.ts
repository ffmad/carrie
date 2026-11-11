import type { Fact, FactCategory } from '../types'

/**
 * "Ask Carrie": answers a family question at once from what Rose has already shared
 * with the person asking. Plain word matching, no network call. The caller passes
 * only the facts that person may see, so nothing private can leak through here.
 */

interface Topic {
  words: string[]
  /** Facts in this category get a small lift when the question is about the topic. */
  category?: FactCategory
}

const TOPICS: Topic[] = [
  {
    words: ['sleep', 'sleeping', 'slept', 'asleep', 'awake', 'wake', 'waking', 'woke', 'night', 'nights', 'tired', 'rest', 'rested', 'insomnia', 'nap', 'bed', '4am'],
  },
  {
    words: ['pill', 'pills', 'medication', 'medications', 'medicine', 'medicines', 'meds', 'tablet', 'tablets', 'dose', 'prescription', 'skipped'],
    category: 'medication',
  },
  {
    words: ['mood', 'feeling', 'feel', 'feels', 'felt', 'happy', 'sad', 'lonely', 'cheerful', 'spirits', 'upset', 'worried', 'anxious', 'laughed', 'laugh', 'miss', 'misses'],
    category: 'mood',
  },
  {
    words: ['pain', 'pains', 'hurt', 'hurts', 'hurting', 'ache', 'aches', 'aching', 'sore', 'knee', 'knees', 'hip', 'hips', 'stairs', 'fall', 'fell', 'dizzy'],
    category: 'health',
  },
  {
    words: ['eat', 'eating', 'ate', 'eaten', 'food', 'meal', 'meals', 'appetite', 'hungry', 'breakfast', 'lunch', 'dinner', 'supper', 'cook', 'cooking', 'cooked'],
  },
]

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'how', 'what', 'when',
  'why', 'who', 'she', 'her', 'hers', 'he', 'his', 'i', 'me', 'my', 'you', 'your', 'it', 'its', 'to', 'of', 'in', 'on', 'at',
  'for', 'with', 'about', 'and', 'or', 'any', 'anything', 'something', 'say', 'said', 'tell', 'told', 'mention', 'mentioned',
  'mum', 'mom', 'mother', 'grandma', 'gran', 'granny', 'rose', 'carrie', 'this', 'that', 'these', 'those', 'week', 'today',
  'lately', 'recently', 'still', 'again', 'much', 'well', 'so', 'not', 'no', 'yes', 'can', 'could', 'would', 'will', 'there',
  'up', 'out', 'get', 'got', 'getting', 'been', 'since', 'like', 'just', 'all', 'from', 'by', 'as', 'if', 'than', 'then',
  'ok', 'okay', 'alright', 'doing', 'going', 'new', 'news', 'things', 'everything', 'really', 'now',
])

/** Trims the common endings so "sleeping" meets "sleep" and "pills" meets "pill". */
function stem(word: string): string {
  let w = word
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  return w
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem)
}

const TOPIC_STEMS = TOPICS.map((topic) => new Set(topic.words.map(stem)))

const topicsIn = (stems: Set<string>): number[] =>
  TOPIC_STEMS.flatMap((topic, index) => ([...stems].some((s) => topic.has(s)) ? [index] : []))

/** The facts that answer the question, best first. Empty means "She hasn't mentioned that." */
export function answer(question: string, facts: Fact[]): Fact[] {
  const asked = new Set(words(question))
  // "How is she doing?" names no topic: the most recent things she shared are the answer.
  if (!asked.size) {
    return question.trim().length < 3 ? [] : [...facts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)
  }
  const askedTopics = topicsIn(asked)

  const scored = facts
    .map((fact) => {
      const said = new Set(words(`${fact.statement} ${fact.quote}`))
      const saidTopics = topicsIn(said)
      let score = 0
      for (const word of asked) if (said.has(word)) score += 3
      for (const topic of askedTopics) if (saidTopics.includes(topic)) score += 2
      // The category only breaks ties: on its own it would answer "her knee" with her sleep.
      if (score > 0 && askedTopics.some((topic) => TOPICS[topic]!.category === fact.category)) score += 1
      return { fact, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.fact.createdAt.localeCompare(a.fact.createdAt))

  // Keep the near misses out when something answers the question squarely.
  const best = scored[0]?.score ?? 0
  return scored.filter((entry) => entry.score * 2 >= best).map((entry) => entry.fact)
}

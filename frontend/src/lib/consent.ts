/**
 * Reading sharing answers out of a spoken call. Pure functions, so a real transcript can be
 * replayed against them (test/consent.replay.ts).
 *
 * The rule they protect: nothing is shared without a yes. A mumble, a "what?" or anything said
 * before Carrie has actually asked decides nothing.
 */
export interface ConsentPerson {
  id: string
  role: 'elder' | 'family' | 'doctor'
  name: string
  relation: string
}

export interface SpokenDecision {
  family?: boolean
  doctor?: boolean
}

const FAMILY_WORDS = /\b(daughter|family|mia|leo|grandson|son|kids|children)\b/
const DOCTOR_WORDS = /\b(doctor|dr|chen|physician|gp)\b/
const NEGATION = /\b(no|not|don't|dont|do not|never|nobody|rather not|private|between us)\b/
/** "Tell Leo to call me", "ask the doctor to ring": something to pass on, not a yes about what Carrie asked. */
const MESSAGE = /\b(tell|ask|remind)\s+(my\s+|the\s+|dr\.?\s+)?\w+\s+(to|that)\s+\w+/
const AFFIRM = /\b(yes|yeah|yep|yup|sure|ok|okay|of course|please do|go ahead|fine|all right|alright|you can|you may|tell (him|her|them|the|my|mia|leo|dr))\b/

/**
 * Reads an answer such as "tell the doctor, but not my daughter". Each clause that says yes or no
 * sets the audiences it names; a bare yes or no answers the audience that was asked about.
 * Returns an empty decision when she said neither: the question then stays open.
 */
export function interpretConsent(text: string, asked: 'family' | 'doctor'): SpokenDecision {
  const decision: SpokenDecision = {}
  let general: boolean | null = null
  for (const clause of text.toLowerCase().split(/,|;|\.|\?|!|\bbut\b|\band\b/)) {
    if (MESSAGE.test(clause)) continue // "tell my grandson to call me" is a message for him, not an answer
    const no = NEGATION.test(clause)
    if (!no && !AFFIRM.test(clause)) continue
    const family = FAMILY_WORDS.test(clause)
    const doctor = DOCTOR_WORDS.test(clause)
    if (family) decision.family = !no
    if (doctor) decision.doctor = !no
    if (!family && !doctor && general === null) general = !no
  }
  if (decision[asked] === undefined && general !== null) decision[asked] = general
  return decision
}

/**
 * A spoken answer to "Can I tell <these people>?", as the people to tell and the people to keep it from.
 * `answered` is false when she did not say yes or no about the person Carrie asked about: the
 * question then stays open. A yes never reaches someone she did not name.
 */
export function readAnswer(
  text: string,
  asked: { audience: 'family' | 'doctor'; personIds: string[] },
  people: ConsentPerson[],
): { allow: string[]; deny: string[]; answered: boolean } {
  const decision = interpretConsent(text, asked.audience)
  const family = people.filter((p) => p.role === 'family')
  const doctor = people.find((p) => p.role === 'doctor')
  const lower = text.toLowerCase()
  const allow: string[] = []
  const deny: string[] = []
  if (decision.family === false) deny.push(...family.map((p) => p.id))
  if (decision.family === true) {
    // Asked about family: the people Carrie named. Otherwise only relatives she names herself ("and my daughter too").
    const named = family.filter((p) => aliases(p).some((word) => new RegExp(`\\b${word}\\b`).test(lower)))
    allow.push(...(asked.audience === 'family' ? asked.personIds : named.map((p) => p.id)))
  }
  if (doctor && decision.doctor === false) deny.push(doctor.id)
  if (doctor && decision.doctor === true) allow.push(doctor.id)
  return { allow, deny, answered: decision[asked.audience] !== undefined }
}

/** "Mia", "Leo", "Chen" and "grandson", "daughter", "doctor": the words she or Carrie would use for someone. */
function aliases(person: ConsentPerson): string[] {
  const name = person.name.toLowerCase().replace(/^dr\.?\s*/, '')
  const relation = person.relation.toLowerCase().split(/[\s,]+/).filter((word) => /^(daughter|son|grandson|granddaughter|doctor|husband|wife|sister|brother|niece|nephew)$/.test(word))
  return [...new Set([name, ...relation])]
}

const lastQuestion = (text: string): string | null =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.includes('?'))
    .pop() ?? null

/** Has Carrie now asked the sharing question she was given? She is free to use her own words. */
export function asksAbout(carrieTurn: string, people: ConsentPerson[], audience: 'family' | 'doctor'): boolean {
  const question = lastQuestion(carrieTurn)?.toLowerCase()
  if (!question) return false
  const words = people.flatMap(aliases).concat(audience === 'doctor' ? ['doctor'] : ['family'])
  return words.some((word) => new RegExp(`\\b${word}\\b`).test(question))
}

/**
 * Carrie sometimes offers on her own to tell one more person ("Do you want me to share this with Mia too?").
 * Returns that person, so the app can wait for the answer instead of ignoring her promise.
 */
export function offersToTell(carrieTurn: string, people: ConsentPerson[]): ConsentPerson | null {
  const question = lastQuestion(carrieTurn)?.toLowerCase()
  if (!question) return null
  if (!/\b(tell|share|let\b.{0,20}\bknow|pass (it|this|that) on)\b/.test(question)) return null
  if (!/\b(this|that|it)\b/.test(question)) return null // about what was just discussed, not something new
  return people.find((p) => p.role !== 'elder' && aliases(p).some((word) => new RegExp(`\\b${word}\\b`).test(question))) ?? null
}

/**
 * People she speaks to through Carrie: "tell my grandson to call me next weekend".
 * Saying it is the yes for that person. "Don't tell Mia" addresses nobody.
 */
export function peopleAddressed(text: string, people: ConsentPerson[]): { person: ConsentPerson; index: number; phrase: string }[] {
  const lower = text.toLowerCase()
  const found: { person: ConsentPerson; index: number; phrase: string }[] = []
  for (const person of people) {
    if (person.role === 'elder') continue
    const match = new RegExp(`\\b(tell|ask|remind)\\s+(my\\s+|the\\s+|dr\\.?\\s+)?(${aliases(person).join('|')})\\b`).exec(lower)
    if (!match) continue
    if (/\b(don't|dont|do not|not|never)\s+$/.test(lower.slice(0, match.index))) continue
    found.push({ person, index: match.index, phrase: match[0] })
  }
  return found
}

/**
 * Of the facts taken from one thing she said, which go to a person she addressed in it: the ones
 * that are the message itself, or that follow it and are not about her health.
 */
export function factsFor(
  text: string,
  addressed: { index: number; phrase: string },
  facts: { id: string; quote: string; category: string }[],
): string[] {
  const lower = text.toLowerCase()
  return facts
    .filter((fact) => {
      const quote = fact.quote.toLowerCase()
      if (quote.includes(addressed.phrase)) return true
      const at = lower.indexOf(quote)
      return at >= addressed.index && fact.category !== 'health' && fact.category !== 'medication'
    })
    .map((fact) => fact.id)
}

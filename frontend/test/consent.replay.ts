/**
 * Replays the first real GPT-Live test call (Ash, 11 Nov) against the sharing logic, in the
 * order the call store applies it. Run: node test/consent.replay.ts
 *
 * What must hold:
 *  - nothing Rose mumbles before Carrie has asked can share anything;
 *  - "Yeah, sure, okay" after the question tells Dr. Chen, and only Dr. Chen;
 *  - Carrie's own "share this with Mia too?" followed by "Yeah, sure. Tell her." tells Mia;
 *  - "tell my grandson to call me next weekend" goes to Leo, and the knee does not.
 */
import assert from 'node:assert/strict'
import { asksAbout, factsFor, offersToTell, peopleAddressed, readAnswer, type ConsentPerson } from '../src/lib/consent.ts'

const people: ConsentPerson[] = [
  { id: 'rose', role: 'elder', name: 'Rose', relation: 'Grandma, 78' },
  { id: 'mia', role: 'family', name: 'Mia', relation: 'Daughter' },
  { id: 'leo', role: 'family', name: 'Leo', relation: 'Grandson' },
  { id: 'chen', role: 'doctor', name: 'Dr. Chen', relation: 'Family doctor' },
]
const byId = (id: string) => people.find((p) => p.id === id)!

type Fact = { id: string; category: string; quote: string; sharedWith: string[] }
const facts: Fact[] = []
let pending: { factId: string; audience: 'family' | 'doctor'; personIds: string[]; asked: boolean } | null = null
let lastAskedFactId: string | null = null

function share(factId: string, change: { allow: string[]; deny: string[] }) {
  const fact = facts.find((f) => f.id === factId)!
  fact.sharedWith = [...new Set([...fact.sharedWith, ...change.allow])].filter((id) => !change.deny.includes(id))
}

/** One thing Rose said, with what the facts step returned for it. */
function rose(text: string, extracted: Omit<Fact, 'sharedWith'>[] = [], question?: { factId: string; audience: 'family' | 'doctor'; person: string }) {
  if (pending?.asked) {
    const answer = readAnswer(text, pending, people)
    share(pending.factId, answer)
    if (answer.answered) pending = null
  }
  facts.push(...extracted.map((f) => ({ ...f, sharedWith: [] })))
  for (const addressed of peopleAddressed(text, people)) {
    for (const id of factsFor(text, addressed, extracted)) share(id, { allow: [addressed.person.id], deny: [] })
  }
  if (question && !pending) {
    pending = { factId: question.factId, audience: question.audience, personIds: [question.person], asked: false }
    lastAskedFactId = question.factId
  }
}

function carrie(text: string) {
  if (pending) {
    if (!pending.asked && asksAbout(text, pending.personIds.map(byId), pending.audience)) pending.asked = true
    return
  }
  const person = lastAskedFactId ? offersToTell(text, people) : null
  const fact = facts.find((f) => f.id === lastAskedFactId)
  if (person && fact && !fact.sharedWith.includes(person.id)) {
    pending = { factId: fact.id, audience: person.role === 'doctor' ? 'doctor' : 'family', personIds: [person.id], asked: true }
  }
}

const knee = () => facts.find((f) => f.id === 'knee')!.sharedWith

carrie("Hi Rose, this is Carrie, an AI helper. Just checking in to hear how you've been. How are you today?")
rose("I'm I'm okay, but my knee's been hurting", [{ id: 'knee', category: 'health', quote: "my knee's been hurting" }], {
  factId: 'knee',
  audience: 'doctor',
  person: 'chen',
})
carrie("Hmm. Okay. I'm sorry to hear that. How's it been feeling since that slip in the bathroom on Tuesday?")
assert.equal(pending?.asked, false, 'an unrelated question from Carrie is not the sharing question')

rose('Uh')
rose('. What? Yeah, I felt back Miranda')
rose('. But')
rose(', yeah, I mean, I felt backwards right now')
assert.deepEqual(knee(), [], 'nothing she says before Carrie asks shares anything')

carrie('Hmm. I hear you.')
carrie('Would it be all right if I told Dr. Chen your knee has been hurting?')
assert.equal(pending?.asked, true, 'Carrie has asked')

rose('Yeah, sure, okay')
assert.deepEqual(knee(), ['chen'], 'yes to the question tells Dr. Chen only')
assert.equal(pending, null)

carrie("Okay. Thanks for letting me. I'll pass that on to him and not to your family.")
rose('What? Uh, I thought you can tell my')
rose("family. It's okay")
assert.deepEqual(knee(), ['chen'], 'a remark outside a question changes nothing')

carrie(
  "Thanks, Rose. Just to be clear, I'll share with Dr. Chen, and if you'd like me to also tell your family, you can say so and I will. Do you want me to share this with Mia too?",
)
assert.deepEqual(pending?.personIds, ['mia'], "Carrie's own offer is about Mia")

rose(
  "Yeah, sure. Tell her. And tell my grandson to call me next weekend. Or I don't know. I just want some update for him",
  [
    { id: 'call-me', category: 'request', quote: 'tell my grandson to call me next weekend' },
    { id: 'update', category: 'request', quote: 'I just want some update for him' },
  ],
)
assert.deepEqual(knee().sort(), ['chen', 'mia'], 'yes to the offer tells Mia too, and not Leo')
assert.deepEqual(facts.find((f) => f.id === 'call-me')!.sharedWith, ['leo'], 'the message for her grandson goes to Leo')
assert.deepEqual(facts.find((f) => f.id === 'update')!.sharedWith, ['leo'])

// Things that must never share.
const ask = { audience: 'doctor' as const, personIds: ['chen'] }
for (const mumble of ['Uh', 'What?', 'Hmm', 'I felt backwards right now', 'Sorry, say that again']) {
  assert.deepEqual(readAnswer(mumble, ask, people), { allow: [], deny: [], answered: false }, `"${mumble}" is not an answer`)
}
assert.deepEqual(readAnswer("No, don't tell anyone", ask, people).allow, [])
assert.deepEqual(readAnswer("Yes, tell the doctor, but don't tell my daughter. She worries so.", ask, people), {
  allow: ['chen'],
  deny: ['mia', 'leo'],
  answered: true,
})
assert.deepEqual(readAnswer('Tell my grandson to call me next weekend', ask, people).allow, [], 'a message for Leo is not a yes about the knee')
assert.deepEqual(peopleAddressed("Don't tell Mia, she worries", people), [], '"don\'t tell Mia" addresses nobody')

console.log('replay ok:', facts.map((f) => `${f.id} -> ${f.sharedWith.join(', ') || 'nobody'}`).join(' | '))

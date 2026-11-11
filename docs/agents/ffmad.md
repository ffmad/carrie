# Quentin's Claude (ffmad)

Last updated: 11 Nov, 21:12 Taipei time.

## I own

- `frontend/` — the app, except the call engine (`src/lib/live.ts` and the live parts of `src/stores/call.ts` are aashcep's; tell me before changing the rest of that store)
- `supabase/` — schema, seed, config
- `design/` — the dove's source files (not pushed)
- root files (`package.json`, `CLAUDE.md`, `docs/app-spec.md`, `.claude/`)

## What changed tonight (read this if you pulled before 21:00)

- **The app is rebuilt around four people.** [docs/app-spec.md](../app-spec.md) says what each sees, the routes and the data layer. Old routes are gone: `/call` is now `/rose`, `/family` is `/family/mia` or `/family/leo`, `/doctor` stays.
- **Sharing is per person.** `facts.share_family` and `facts.share_doctor` are replaced by `facts.shared_with` (a list of person ids). New tables `requests` and `care_settings`. **Run `npm run db:reset` after pulling.**
- **The call store carries more into a call:** pending "ask her" and "tell her" requests from the family and the doctor are handed to Carrie (`session.instructions.append` on a live call, extra `pendingVoiceNotes` entries marked "Typed, not a recording" on the turn path), and Rose's answer to a family recording goes back to its sender when she addresses them ("Tell Leo…").
- **The dove is in:** tokens, Nunito, the three-pose avatar, icons.
- Your pull request #2 (GPT-Live call) is merged into `main`.

## Done

- Rose: resting screen (tap the dove to talk), incoming call, in-call screen, what Carrie will pass on, and "What I've shared" with take-back.
- Mia and Leo: the conversation with Carrie, the Mum / Grandma page, the Circle page.
- Dr. Chen: the pre-visit page, with questions for Carrie and after-visit notes.
- Every phone reloads the shared data every 3 seconds, so two browser windows stay in step.

- The Mum / Grandma page opens with your `family-update` card ("Carrie suggests: give Mum a call", heads-ups, things to talk about with receipts). It sends only what Rose shared with that one person.
- "Talk" in the family conversation starts a GPT-Live call with `audience: 'family'` through `liveCall.ts`, again with that person's facts only. Without an OpenAI key it says the voice line is off.
- `consentQuestion.person` and `urgent` from your facts step are used when present.
- If Rose says she fell, has chest pain, cannot breathe or passed out, Mia's phone shows it at once and Carrie tells Rose so.

## Not verified yet

- Anything with a microphone, and a real GPT-Live call.
- "Check in now" making Rose's phone ring across two devices.

## Known shortcuts

- "Ask Carrie" in the family conversation is word matching over what Rose shared with that person (`frontend/src/lib/answer.ts`). No model call.
- A spoken yes or no is read by a pattern match in `stores/call.ts`. "Family" in a consent question means the family members it names, or the main contact when it names nobody.
- Urgency is a narrow word match in `stores/call.ts`, plus your `urgent` flag on the facts path.
- Rose's phone rings at the call time only while the app is open on it.

## I need from the other side

- **A family-side answer endpoint** if you have time: `POST /api/carrie/ask` with a question and the facts that person may see, returning an answer that cites them. It would replace my word matching.
- Whether a real GPT-Live call works with the key, and whether Carrie brings up the carried requests.

# Quentin's Claude (ffmad)

Last updated: 11 Nov, 20:14 Taipei time.

## I own

- `frontend/` — the Vue PWA
- `supabase/` — schema, seed, config
- `design/` — character, logo, colors (not pushed yet)
- root files (`package.json`, `CLAUDE.md`, `.claude/`)
- `backend/` — only the scaffold so far. **Open to hand over**, see below.

## Doing now

- Testing the call with a real microphone in Chrome: live captions, one audio clip per thing Rose says, upload to `clips`, and playing a clip back from the family feed. None of that has run with a microphone yet.
- Design: five directions generated with Codex (carrier bird, voice glow, geometric neighbour, string phone, the word carries). Quentin picks one next, then it goes into `frontend/src/styles/tokens.css` and `CarrieAvatar.vue`.

## Done

- Local Supabase with the schema, a `clips` audio bucket and a week of seeded calls for Rose. Checked through the API: reads, clip upload and playback work, and a fact cannot be shared without a recorded yes.
- `backend/`: `POST /api/carrie/turn` takes what Rose just said and returns Carrie's reply, the facts with their exact quotes, and an optional "can I share this?" question. It uses Claude when a key is set and a scripted call when not. The request and response shapes are in `backend/src/carrie/types.ts`.
- The five screens (Home, Call, Family, Fact, Doctor) read the local database, and fall back to bundled demo data without one.
- A call works end to end with typed lines: ring, Carrie says she is an AI, announces Leo's waiting voice note, takes a fact, asks to share it. The call, its lines and the facts are saved; "tell the doctor, not my daughter" ends as doctor yes, family no.
- Measured with Claude (`claude-sonnet-5-5`): about 1.7 s for the opening line and 2.6 to 3.4 s for a reply that carries a fact. That is slower than a phone call should feel, and worth weighing in the provider decision.

Known shortcuts:

- A spoken yes or no to "can I share this?" is read with a simple pattern match in `frontend/src/stores/call.ts`; tap buttons are the backup.
- Facts whose quote is not word for word in what Rose said are dropped by the backend.
- Seeded lines have no recording, so their receipts are read aloud in a synthetic voice, labelled as such.

## Next, in this order

1. Microphone pass in Chrome (see "Doing now"), then fix what breaks.
2. Family feed updating live during the call.
3. Rose hearing Leo's real recording in the call.
4. Apply the chosen design, then record the video.

## Open areas, nobody on them yet

- **Carrie's brain** (`backend/src/carrie/`): the prompt, how well she pulls facts out, how she asks for consent, how she brings up a waiting voice note. Biggest effect on how the demo feels.
- **Voice**: the app uses the browser's speech recognition and speech synthesis for now. A better voice for Carrie, or better transcription, would show in the video.
- **Rose's recorded lines**: the seeded facts have no audio, so their receipts do not play. Someone has to record them (the lines are in `supabase/seed.sql`).
- **The video**: script, on-screen captions, recording.

## I need from the other side

- **What Carrie runs on.** We may not use the Claude API. My questions are in [the sync issue](https://github.com/ffmad/carrie/issues/1#issuecomment-6795474635). Until it is answered the Claude version stays as a placeholder behind `backend/src/carrie/types.ts`.
- Which open areas you are taking, in your status file.
- The original idea write-up. I have only seen a one-line summary of it (an AI that calls grandma, tracks her health and backs every fact with her own words), so tell me if something above goes against it.

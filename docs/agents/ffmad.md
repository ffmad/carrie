# Quentin's Claude (ffmad)

Last updated: 11 Nov, 20:13 Taipei time.

## I own

- `frontend/` — the Vue PWA
- `supabase/` — schema, seed, config
- `design/` — character, logo, colors (not pushed yet)
- root files (`package.json`, `CLAUDE.md`, `.claude/`)
- `backend/` — only the scaffold so far. **Open to hand over**, see below.

## Doing now

- Frontend screens: Home, Call, Family, Fact and Doctor exist and type-check. They show demo data; the live call is not wired to the database yet.
- Design: five directions generated with Codex (carrier bird, voice glow, geometric neighbour, string phone, the word carries). Quentin picks one next, then it goes into `frontend/src/styles/tokens.css` and `CarrieAvatar.vue`.

## Done

- Local Supabase with the schema, a `clips` audio bucket and a week of seeded calls for Rose. Checked through the API: reads, clip upload and playback work, and a fact cannot be shared without a recorded yes.
- `backend/`: `POST /api/carrie/turn` takes what Rose just said and returns Carrie's reply, the facts with their exact quotes, and an optional "can I share this?" question. It uses Claude when a key is set and a scripted call when not. The request and response shapes are in `backend/src/carrie/types.ts`.

## Next, in this order

1. Call screen end to end: record each thing Rose says as its own clip, upload it to `clips`, save the utterance and the facts.
2. Family feed updating live during the call, tap a fact to hear the clip.
3. Leo's voice note played to Rose in the next call.
4. Doctor brief.
5. Apply the chosen design, then record the video.

## Open areas, nobody on them yet

- **Carrie's brain** (`backend/src/carrie/`): the prompt, how well she pulls facts out, how she asks for consent, how she brings up a waiting voice note. Biggest effect on how the demo feels.
- **Voice**: the app uses the browser's speech recognition and speech synthesis for now. A better voice for Carrie, or better transcription, would show in the video.
- **Rose's recorded lines**: the seeded facts have no audio, so their receipts do not play. Someone has to record them (the lines are in `supabase/seed.sql`).
- **The video**: script, on-screen captions, recording.

## I need from the other side

- **What Carrie runs on.** We may not use the Claude API. My questions are in [the sync issue](https://github.com/ffmad/carrie/issues/1#issuecomment-6795474635). Until it is answered the Claude version stays as a placeholder behind `backend/src/carrie/types.ts`.
- Which open areas you are taking, in your status file.
- The original idea write-up. I have only seen a one-line summary of it (an AI that calls grandma, tracks her health and backs every fact with her own words), so tell me if something above goes against it.

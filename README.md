# Carrie

**An AI helper who phones your grandmother, and carries what she chooses to share to her family and her doctor.**

"Carrie" is *care* + *carry*. She doesn't replace your call. She gives you a reason to make it.

**▶ Demo video (under 2 minutes):** https://github.com/ffmad/carrie/releases/download/demo-video/carrie-demo.mp4

Built in one evening at c0mpiled-18, the YC Startup School Hackathon in Taipei, 11 November 2026.

## Team

- **Quentin** ([ffmad](https://github.com/ffmad)): the app, the database, the design
- **Ash** ([aashcep](https://github.com/aashcep)): Carrie's voice and brain, the original idea, and Rose's voice in the video

## What it does

One Carrie, four people, each talking to her in their own way.

- **Rose, 78** gets a phone call. She picks up and talks; there is nothing to tap or read. Carrie says she is an AI in her first sentence.
- **Every fact has a receipt.** "Knee bad on the stairs since Sunday" links to the clip of Rose saying it. Carrie never claims something she cannot play back.
- **Sharing follows an agreement.** Everyday news (she baked, she saw a friend) reaches the family on its own. Anything about her health is shared only after her yes, one person at a time: "Tell the doctor, not my daughter" is respected, and the database refuses to share without it. Rose can take anything back.
- **Mia and Leo** each have a conversation with Carrie: what Mum shared with *them*, in her own voice, a reason to call her and what to talk about, and a way to ask or tell her something through Carrie.
- **Dr. Chen** opens one page before the appointment: only what Rose agreed to share with the doctor, in her exact words, with how often it came up.

## How it works

- **Voice:** OpenAI GPT-Live 1 over WebRTC, full duplex. Carrie listens and speaks; the app steers her mid-call (a sharing question to ask, a message from the family).
- **Facts beside the call:** after each thing Rose says, a second model extracts facts with her exact quote, decides whether each is everyday, needs her yes, or is private, and flags anything urgent.
- **Receipts:** the microphone is kept during the call and cut by transcript time, so each fact plays back the moment she said it.
- **App:** Vue 3 + Vite PWA. **Backend:** Node + Hono. **Data:** Supabase (Postgres and storage), run locally.
- **Fallback:** without a microphone or an OpenAI key, the call runs turn by turn through Claude, or a script.

What each person sees, the routes and the data layer: [docs/app-spec.md](docs/app-spec.md).

## Run it

```
npm install && npm run db:start                    # local Supabase, no Docker
cd backend  && npm install && cp .env.example .env && npm run dev   # add OPENAI_API_KEY for the live voice
cd frontend && npm install && npm run dev          # http://localhost:5240
```

Details, including the two values for `frontend/.env.local`, are in [CLAUDE.md](CLAUDE.md).

## How we built it

Two people, each with their own Claude Code session, plus Codex for the character design. The two Claudes coordinated through this repo: [CLAUDE.md](CLAUDE.md) as the shared brief, a status file each in [docs/agents/](docs/agents/), and [issue #1](https://github.com/ffmad/carrie/issues/1) as their chat. The first real voice call was replayed as a test ([frontend/test/consent.replay.ts](frontend/test/consent.replay.ts)) after it showed that a mumbled "uh" could count as a yes.

## Honest limits

- No sign-in: the home screen stands in for it, and the database is open to anyone holding the local key. Demo data only; everyone in it is fictional.
- Reading a spoken yes or no, and spotting an emergency, are narrow word matches backed by the model's own flag. They are not yet good enough for real use.
- Carrie rings at the agreed time only while the app is open on Rose's phone. There is no real phone line yet.
- The seeded week has no recordings, so those quotes are read in a synthetic voice and labelled as such. Everything said on a real call plays as recorded.

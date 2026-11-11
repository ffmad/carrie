# aashcep's Claude

Last updated: 11 Nov, 20:45 Taipei time.

## I own

- `backend/`. Handed over by Quentin's Claude; see the sync issue.
- Carrie's brain and voice: the prompt, fact extraction, consent questions, and the GPT-Live 1 call.

## Doing now

- Carrie runs on OpenAI GPT-Live 1 (full duplex, over WebRTC). Answer and proposed shape change: [sync issue comment](https://github.com/ffmad/carrie/issues/1#issuecomment-6795890133).
- Next: `POST /api/live/session` and `POST /api/carrie/facts` in `backend/`, keeping `/turn` working until the call screen moves over.

## Done

- `POST /api/live/session` and `POST /api/carrie/facts` on `main`, with how to use them in [this comment](https://github.com/ffmad/carrie/issues/1#issuecomment-6795953448). Tested without keys: 503 without OpenAI, facts via the script fallback, 400 on a bad body. Not yet run against a real GPT-Live call.

## Done outside this repo

- A working GPT-Live 1 call page: ring, answer, live captions from timed transcript pieces, a clean session close. It has not run with a real key yet.
- Fact extraction with an exact-quote check, plus GBrain memory (facts saved with their source call and second). Tested offline with fixtures.

## Next

1. Run a real GPT-Live call once the OpenAI key is in `backend/.env`.
2. Port the call page into `CallView` / the `call` store, or hand it to Quentin. That depends on his answer.

## I need from the other side

- Whether you move `CallView` and the `call` store to WebRTC, or I open a pull request.
- Nothing else is blocking. Each machine uses its own OpenAI key in `backend/.env`.

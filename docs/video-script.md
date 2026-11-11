# Carrie: video script (2:00)

Built on the demo week in `supabase/seed.sql`. Carrie's memory (GBrain) holds the same week: `cd backend && npm run memory:reset`.

Cast:
- **Ash** plays **Rose** on the call, and is narrator **A**.
- **Quentin** is narrator **B**, and records **Leo's** voice note.

Two voices, one man and one woman, alternate lines, so the narration never sounds like Rose. Ash narrates only the opening and the close, away from the call scene.

Before recording:
- `npm run db:reset`
- `cd backend && npm run memory:reset`
- Wear headphones on Rose's phone. A loud speaker leaks Carrie's voice into the mic and garbles the captions.
- Rose's lines are a guide. GPT-Live is live, so Carrie's exact words will differ. Keep the takes where she hits the beats below.

## 0:00–0:12 · The problem (voice-over, Rose alone at her window)

> **A:** In Japan, nearly one in three people is over 65. Korea and Taiwan just crossed one in five. The US is at nearly one in five, and climbing.
> **B:** Their families love them, but they're busy, far away, and often don't know what to say when they call.

(Figures for 2025: Japan 29.7%, Korea 20% from late 2024, Taiwan 20.06%, US 18.9%. Sources: Taiwan Ministry of the Interior, Statistics Korea, and US Census Bureau/PRB as reported in the press.)
> **A:** Meet Carrie, an AI that phones Grandma every day.
> **B:** She doesn't replace your call. She gives you a reason to make it.

## 0:12–0:55 · The call (Rose's phone, `/rose`)

Carrie rings at 10:00. Rose taps **Answer**. From then on she only talks: no buttons, no screen.

| | Who | Line (guide) | What it shows |
|---|---|---|---|
| 1 | Carrie | "Hi Rose, it's Carrie, your AI helper…" | **She says she's an AI**, first line |
| 2 | Carrie | "…are you still waking up at four?" | **Memory** (GBrain): she remembers this week |
| 3 | Rose | "A bit better. But my knee's been bad on the stairs since Sunday." | Something new. A **fact chip** appears, with her clip |
| 4 | Carrie | "Can I tell Dr. Chen about your knee?" | **Asks first, names one person** |
| 5 | Rose | "Yes, tell the doctor. Not Mia though, she'll only fuss." | **Per-person consent** |
| 6 | Carrie | "Okay, I'll tell Dr. Chen." | |
| 7 | Carrie | Dr. Chen's question: "does the dizziness come after your morning pill?" | **Carrie carries the doctor's question** (pending `ask` in the seed) |
| 8 | Rose | "Now you mention it… yes, about half an hour after." | A fact, shared with Dr. Chen |
| 9 | Rose | "And tell Leo to come early on Saturday, the cake's best warm." | A message back to the family |

Hang up. On screen: **"Here's what I'll pass on"**, under To Dr. Chen, To Leo, and Just between us.

## 0:55–1:25 · The family (Mia's phone, then Leo's)

- **Mia** (`/family/mia`): Mum this week. She sees the eye-clinic request and taps **I'll do it**. **The knee is not there**, because Rose said not Mia. Caption: *Only what Mum said Mia can know.*
- **Leo** (`/family/leo`): Carrie's card at the top: *"Grandma misses you and is baking apple cake for Saturday. You last spoke 12 days ago."* (`/api/carrie/family-update`). He taps play and hears **Rose's own voice**: "I do miss that boy." He records a voice note back.
- **B:** *Leo hadn't called in twelve days. Now he knows what to say.*

## 1:25–1:45 · The doctor (`/doctor`)

One page before the visit: knee since Sunday and dizziness about 30 minutes after the morning pill, each with **her exact words and a play button**. The missed-pill strip. "Woken at 4 a.m. came up 2 times."

## 1:45–2:00 · Why you can trust it (voice-over over the receipts)

> **B:** AI can be wrong. So Carrie never makes anything up. Every fact comes from Rose's own words, with the recording to prove it.
> **A:** Carrie only carries. Rose decides who hears what.
> **B:** GPT-Live 1 for the voice, GBrain for memory with sources, and consent on every fact.
> **A:** Carrie. More calls, not fewer.

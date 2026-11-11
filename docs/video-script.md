# Carrie: video script (1:30)

Built on the demo week in `supabase/seed.sql`. Carrie's memory (GBrain) holds the same week: `cd backend && npm run memory:reset`.

Cast:
- **Ash** plays **Rose** on the call, and is narrator **A**.
- **Quentin** is narrator **B**, and records **Leo's** voice note.

Two voices, one man and one woman, alternate lines. Ash narrates only the opening and the close, away from the call scene.

Before recording:
- `npm run db:reset`
- `cd backend && npm run memory:reset`
- Wear headphones on Rose's phone. A loud speaker leaks Carrie's voice into the mic and garbles the captions.
- Rose's lines are a guide. GPT-Live is live, so Carrie's exact words will differ. Keep the take where she hits the beats. Cut the call down in the edit; it doesn't need to run in real time.

## 0:00–0:08 · Opening (voice-over, Rose's phone ringing)

> **A:** One in five people in Taiwan and Korea is over 65. The US is close behind.
> **B:** Families care, but often don't know what to say when they call. Meet Carrie.

## 0:08–0:45 · The call (Rose's phone, `/rose`)

Carrie rings. Rose taps **Answer**, then only talks: no buttons, no screen.

| | Who | Line (guide) | What it shows |
|---|---|---|---|
| 1 | Carrie | "Hi Rose, it's Carrie, your AI helper… are you still waking up at four?" | **Says she's an AI**, and **remembers** this week (GBrain) |
| 2 | Rose | "A bit better. But my knee's been bad on the stairs since Sunday." | **Fact chip** appears, with her clip |
| 3 | Carrie | "Can I tell Dr. Chen about your knee?" | **Asks first, names one person** |
| 4 | Rose | "Yes, tell the doctor. Not Mia, she'll only fuss." | **Per-person consent** |
| 5 | Rose | "And tell Leo to come early Saturday, the cake's best warm." | A message back to the family |

Hang up. On screen, about 2 seconds: **"Here's what I'll pass on"**, under To Dr. Chen, To Leo, and Just between us.

## 0:45–1:08 · The family

- **Mia** (`/family/mia`), about 5 s: Mum this week. **No knee**, because Rose said not Mia.
- **Leo** (`/family/leo`), about 15 s: Carrie's card at the top: *"Grandma misses you and is baking apple cake for Saturday. You last spoke 12 days ago."* He taps play and hears **Rose's own voice**.
- **B:** *Leo hadn't called in twelve days. Now he knows what to say.*

## 1:08–1:20 · The doctor (`/doctor`)

The knee since Sunday, with **her exact words and a play button**, and the missed-pill strip.

## 1:20–1:30 · Close (voice-over over the receipts)

> **B:** Carrie never makes anything up. Every fact is Rose's own words, and Rose decides who hears it.
> **A:** Carrie. She doesn't replace your call. She gives you a reason to make it.

(Figures for 2025: Taiwan 20.06%, Korea 20% from late 2024, US 18.9%, Japan 29.7%.)

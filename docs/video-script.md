# Carrie: video script (1:30)

Built on the demo week in `supabase/seed.sql`. Carrie's memory (GBrain) holds the same week: `cd backend && npm run memory:reset`.

Cast:
- **Ash** plays **Rose** on the call, and is narrator **A**.
- **Quentin** is narrator **B**, and records **Leo's** voice note.

Two voices, one man and one woman, alternate lines. Ash narrates only the opening and the close, away from the call scene.

Before recording:
- Film on a machine with **local Supabase running and `frontend/.env.local` filled in**. Without them the app shows its bundled demo data, which doesn't match this script.
- `npm run db:reset`
- `cd backend && npm run memory:reset`, then keep `npm run dev` running in `backend/`.
- Wear headphones on Rose's phone. A loud speaker leaks Carrie's voice into the mic and garbles the captions.
- Rose's lines are a guide. GPT-Live is live, so Carrie's exact words will differ. Keep the take where she hits the beats. Cut the call down in the edit; it doesn't need to run in real time.

## 0:00–0:08 · Opening (voice-over, Rose's phone ringing)

> **A:** One in five people in Taiwan and Korea is over 65. The US is close behind.
> **B:** Families care, but often don't know what to say when they call. Meet Carrie.

## 0:08–0:45 · The call (Rose's phone, `/rose`)

Carrie rings. Off camera, Mia taps **Check in now** on her phone; otherwise Carrie only rings at the set call time. Rose taps **Answer**, then only talks: no buttons, no screen.

| | Who | Line (guide) | What it shows |
|---|---|---|---|
| 1 | Carrie | "Hi Rose, it's Carrie, your AI helper. How have you been?" | **Says she's an AI** |
| 2 | Rose | "Better, thanks. I baked the apple cake this morning. But my knee's been bad on the stairs since Sunday." | Cake = **everyday**, shared without asking. Knee = **health**, a fact chip with her clip |
| 3 | Carrie | "Can I tell Dr. Chen about your knee?" | **Asks first, names one person** |
| 4 | Rose | "Yes, tell the doctor. Not Mia." | **Per-person consent** |
| 5 | Rose | "And tell Leo to come early Saturday. Bye, dear." | A message back to the family |

Carrie does **not** ask about the cake; that's the point. Hang up. On screen, about 2 seconds: **"Here's what I'll pass on"**: the cake under To Mia and To Leo, the knee under To Dr. Chen.

## 0:45–1:08 · The family

- **Mia** (`/family/mia`), about 5 s: Mum this week. **The apple cake is there** (everyday news arrives on its own), and **the knee is not** (health waits for Rose's yes, and she said not Mia).
- **Leo** (`/family/leo`), about 15 s: Carrie's card at the top: *"Grandma misses you and is baking apple cake for Saturday. You last spoke 12 days ago."* Then he taps play on **today's** message from the call, "tell Leo to come early Saturday", and hears **Rose's own voice**. Only things said on a real call have a recording; the seeded week plays in a labelled synthetic voice, so don't tap those on camera.
- **B:** *Leo hadn't called in twelve days. Now he knows what to say.*

## 1:08–1:20 · The doctor (`/doctor`)

The knee since Sunday, with **her exact words and a play button**, and the missed-pill strip.

## 1:20–1:30 · Close (voice-over over the receipts)

> **B:** Carrie never makes anything up. Everyday news flows to the family; anything about her health waits for Rose's yes.
> **A:** Carrie. She doesn't replace your call. She gives you a reason to make it.

(Figures for 2025: Taiwan 20.06%, Korea 20% from late 2024, US 18.9%, Japan 29.7%.)

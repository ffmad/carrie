# Filming: step by step (tonight)

What we say is in [video-script.md](video-script.md). This file covers what we do, in order. Deadline: submit by **22:45**.

**Who:** **Ash** plays Rose and is narrator A. **Quentin** runs the machine and phones, is narrator B, and is Leo's voice.

**How it looks:** no faces. Phone and laptop screen recordings, plus one hand-held shot of the phone ringing. Narration is recorded separately and laid on top.

---

## 1 · Setup on Quentin's machine (21:45–21:55)

Run each in its own terminal and leave it running.

1. `git pull --rebase`
2. Database: `npm run db:start`, then `npm run db:reset`. This gives a clean demo week. `frontend/.env.local` must have `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Backend:
   - Put your OpenAI key in `backend/.env` (`OPENAI_API_KEY=`).
   - Run `cd backend && npm run memory:reset`. Carrie now remembers the same week.
   - Then `npm run dev`.
   - Check: `curl -s localhost:3050/api/health` must show `"live":"gpt-live-1"`.
4. Frontend: `cd frontend && npm run dev`.
5. Phone access: `tailscale serve --bg 5240`. On your phone, which must be on the same tailnet, open `https://<machine>.<tailnet>.ts.net/rose`. It **must be https**, or the phone refuses the mic.
6. **Rehearsal (2 min, required).** Mia triggers the call: open `/family/mia` on the laptop, go to the Carrie tab, and tap **Check in now**. Rose's phone rings. Answer it and say one line.
   - Pass: Carrie answers in voice, and captions appear on the phone.
   - Fail: use the **fallback** at the bottom. Don't debug past 22:00.
7. After the rehearsal, run `npm run db:reset` and `cd backend && npm run memory:reset` again, so the rehearsal doesn't show up in the video.

Phone settings for Rose's phone: Do Not Disturb on, brightness up, volume medium. No headphones, so the recording hears Carrie. A loud speaker garbles the captions.

## 2 · Record, in this order (22:00–22:20)

The call has to come first: the family and doctor screens show what Rose says in it.

### Shot 1 · The call (Rose's phone)
1. Rose's phone: start **iOS screen recording** (Control Centre). Leave **mic on**, so both voices are recorded.
2. Laptop: on `/family/mia`, tap **Check in now**.
3. Phone rings. Ash taps **Answer** and talks. Ash's lines, loosely, waiting for Carrie each time:
   1. *(Carrie asks if Rose is still waking at four)* "A bit better. But my knee's been bad on the stairs since Sunday."
   2. *(Carrie asks "Can I tell Dr. Chen about your knee?")* "Yes, tell the doctor. Not Mia, she'll only fuss."
   3. *(Carrie carries Dr. Chen's question about the dizziness)* "Now you mention it… yes, about half an hour after the pill."
   4. "And tell Leo to come early on Saturday, the cake's best warm."
   5. "That's all, dear. Bye now." Tap **Hang up**.
4. Keep the "Here's what I'll pass on" screen up for 3 seconds, then stop recording.
5. Bad take? Run `db:reset` and `memory:reset`, then do it again. Two or three takes at most.

### Shot 2 · The ring (Ash's phone films Rose's phone)
Before Shot 1, or with one extra Check in now afterwards: film the phone lying on a table as "Carrie is calling" comes up, and a hand picks it up. 3 seconds. This is the opening shot.

### Shot 3 · Mia (screen recording, ~6 s)
Open `/family/mia` and go to the Mum tab. Scroll slowly. **The knee is not there**, because Rose said not Mia. Optional: tap **I'll do it** on the eye-clinic request.

### Shot 4 · Leo (screen recording, ~15 s)
Open `/family/leo`.
1. Show Carrie's card at the top: the reason to call, and what to talk about.
2. Tap play on **today's** "tell Leo to come early on Saturday". This is Rose's real voice from Shot 1.
3. Don't tap the older items. They play a labelled synthetic voice.

### Shot 5 · Dr. Chen (laptop screen recording, ~10 s)
Open `/doctor` and record the laptop screen (macOS: Cmd-Shift-5). Show the knee since Sunday with her exact words and a play button, then the missed-pill strip.

### Shot 6 · Narration (phone Voice Memos, somewhere quiet)
Read the **A** and **B** lines from [video-script.md](video-script.md), each line twice. Ash reads A; Quentin reads B.

## 3 · Edit and submit (22:20–22:40)

CapCut or iMovie, 90 seconds:

1. Shot 2, under the opening narration.
2. Shot 1, cut down to its beats.
3. Shot 3.
4. Shot 4, with B's "Leo hadn't called in twelve days…".
5. Shot 5.
6. The closing narration over a receipt playing.

Add burned-in captions for the call. Optional small text in a corner: *Rose is played by a teammate.* Export, then submit the video and this repo **before 22:45**.

## Fallback if the phone call won't work

Run the call on the laptop instead:
1. Open `http://localhost:5240/rose` in Chrome on Quentin's machine. Localhost may use the mic without https.
2. Resize the window narrow, phone-shaped.
3. Record the screen with Cmd-Shift-5, with the microphone option on.
4. Everything else stays the same.

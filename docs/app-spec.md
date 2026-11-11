# Carrie — what each person sees

Carrie is someone each of the four people talks to, not a dashboard. Nobody "starts a Carrie call": Carrie rings Rose, or Rose taps the dove; the family and the doctor tell Carrie what to carry and she tells them what Rose agreed to share.

Four rules hold everywhere:

1. **Consent is per person and can be taken back.** "Can I tell Mia?" does not tell Leo. A fact lists the people who may see it (`sharedWith`). A person only ever sees facts that list them.
2. **Carrie never guesses.** If Rose has not said it, the answer is "She hasn't mentioned that."
3. **Real voices travel both ways.** Family recordings are played to Rose; Rose's answer goes back as her own recording.
4. **One exception to consent, stated openly:** if Rose mentions a fall, chest pain or sounds confused, Carrie tells her she is alerting the main contact, and does. (Shown as a rule in the app; not detected yet.)

## Routes and who owns which files

| Route | File | Person |
|---|---|---|
| `/` | `views/HomeView.vue` | pick whose phone this is (stands in for sign-in) |
| `/rose` | `views/rose/RoseView.vue` | Rose: resting, incoming call, in the call, after the call |
| `/rose/shared` | `views/rose/RoseSharedView.vue` | Rose: what she has shared, and with whom |
| `/family/:who` (`mia`, `leo`) | `views/family/FamilyShell.vue` | tab bar + `<RouterView>`; sets the viewer from `:who` |
| `/family/:who/carrie` | `views/family/FamilyCarrieView.vue` | the conversation with Carrie (default tab) |
| `/family/:who/her` | `views/family/FamilyHerView.vue` | "Mum" for Mia, "Grandma" for Leo |
| `/family/:who/circle` | `views/family/FamilyCircleView.vue` | people, schedule, what Carrie checks on |
| `/doctor` | `views/doctor/DoctorView.vue` | Dr. Chen: one page, no menu |

`App.vue` is only `<PhoneFrame><RouterView /></PhoneFrame>`: there is no global header or nav. Every view fills the phone itself: root element `class="screen"`, scrolling part `class="screen__scroll"` (see `styles/layout.css`). Use only the CSS variables in `styles/tokens.css` and the helpers in `styles/base.css`; no hard-coded colors. Carrie is `<CarrieAvatar :state="'idle' | 'listening' | 'speaking'" :size="160" />`; the wordmark is `<CarrieLogo />`.

Do not edit `stores/`, `types.ts`, `lib/supabase.ts`, `lib/api.ts`, `lib/live.ts`, `router.ts`, `App.vue`, `styles/` or `CarrieAvatar.vue`. If you need something from the data layer that is not below, say so in your report instead of working around it.

## Data layer (all from `frontend/src`)

Everything is already loaded and refreshed every 3 seconds by `App.vue`; views just read the stores.

```ts
// types.ts
interface Fact { id; callId; elderId; utteranceId: string | null; category: FactCategory;
  statement: string; quote: string;          // Carrie's wording, and Rose's exact words
  sharedWith: string[];                      // ids of the people who may see it
  claimedBy: string | null;                  // who said "I'll do it" (category 'request')
  consent: 'pending' | 'granted' | 'declined'; createdAt: string }
interface VoiceNote { id; fromId; toId; audioPath: string; transcript: string | null; replyToFactId: string | null;
  inReplyTo: string | null;                  // Rose's answer to a family note points at that note
  deliveredCallId: string | null; deliveredAt: string | null; createdAt: string }
interface CareRequest { id; elderId; fromId; kind: 'ask' | 'tell' | 'checkin'; text: string;
  status: 'pending' | 'done'; handledCallId: string | null; createdAt: string }
interface CareSettings { elderId; callTime: string /* "10:00" */; checks: string[];
  mainContactId: string | null; doctorId: string | null; nextAppointment: string | null }
interface Call { id; elderId; startedAt: string; endedAt: string | null; summary: string | null }

// stores/circle.ts
useCircleStore(): { people, elder, family, doctor, viewer /* whose phone this is */, viewerKey,
  viewAs(key: 'rose' | 'mia' | 'leo' | 'dr-chen'), personFor(key), byId(id) }
// stores/calls.ts
useCallsStore(): { calls /* oldest first */, ended, latest /* last finished call or null */, byId(id) }
// stores/facts.ts
useFactsStore(): { facts, newestFirst, byId(id), forCall(callId), sharedWith(personId) /* newest first */,
  receiptUrl(fact) /* url of Rose saying it, or null */,
  setSharing(id, { allow?: string[], deny?: string[] }), revoke(id, personId), claim(id, personId | null) }
// stores/voiceNotes.ts
useVoiceNotesStore(): { notes, pendingFor(personId), involving(personId) /* sent by or to them, oldest first */,
  send({ fromId, toId, recording, transcript?, replyToFactId?, inReplyTo? }), markDelivered(id, callId) }
// stores/requests.ts — things the family or doctor give Carrie for the next call, and "check in now"
useRequestsStore(): { requests /* oldest first */, pending(kind?), from(personId),
  add({ fromId, kind, text? }): Promise<CareRequest>, markDone(id, callId?) }
// stores/settings.ts
useSettingsStore(): { settings: CareSettings, mainContact /* Person | null */, isMainContact(personId),
  update({ callTime?, checks?, nextAppointment? }) }
// stores/call.ts — the live call on Rose's phone
useCallStore(): { phase: 'idle' | 'ringing' | 'talking' | 'consent' | 'ended', carrie: 'idle' | 'listening' | 'speaking',
  call, utterances, interim, thinking, error, liveMode, inCall, callFacts, elderTurns,
  pendingConsent: { question, audience, factId, personIds } | null,
  playingNote: VoiceNote | null,             // a family recording is playing right now
  ring(), answer(), start() /* Rose taps the dove: answer without ringing */,
  hearElder(text, recording?), answerConsent({ family?: boolean, doctor?: boolean }), hangUp(), reset() /* back to idle */ }
```

Helpers: `lib/format.ts` (category labels, dates), `lib/recorder.ts` (record from the microphone, `playAudio(url)`), `lib/speech.ts`, `clipUrl(path)` in `lib/supabase.ts`, components `ReceiptPlayer` (`src`, `quote`, `speaker?`), `VoiceNoteRecorder` (`toName`, emits `send`), `CaptionStream`, `ConsentPrompt`.

## Rose (`views/rose/`)

No menu, no tabs, nothing to learn. Text at least 20px, buttons at least 56px tall, high contrast.

- **Resting** (`phase` idle): the dove, a greeting for the time of day, "Tap me and talk". Tapping the dove calls `call.start()`. Up to two large cards under it: a waiting family recording ("Leo sent you a message", from `voiceNotes.pendingFor(elder.id)`; tapping it also starts talking, since Carrie plays it) and the next appointment (`settings.nextAppointment` with the doctor's name). One quiet link at the bottom: "What I've shared".
- **Incoming** (`phase` ringing): "Carrie is calling", a big Answer button (`call.answer()`) and "Not now" (`call.reset()`). The view watches `requests.pending('checkin')`: when one appears while resting, call `call.ring()` and `requests.markDone(id)`.
- **In the call** (`inCall`): the dove in her current state, a status line with a running timer ("On the phone with Carrie · 01:23"), large captions, each fact as a chip when it is caught, and a big hang-up button. While `playingNote` is set, show whose voice it is ("Leo's voice"). On a GPT-Live call (`liveMode`) Rose never has to tap or read: no consent buttons, no typing. Otherwise keep the tap-to-speak button, the "Type instead" drawer and the consent buttons that the old `views/CallView.vue` has (read it and carry its working logic over; it is deleted afterwards).
- **After the call** (`phase` ended): "Here's what I'll pass on", grouped per person from `callFacts` ("To Mia", "To Dr. Chen", "Just between us" for facts shared with nobody). One button, "Thank you, Carrie", calls `call.reset()`.
- **What I've shared** (`/rose/shared`): every fact, grouped by who knows it, in her own words (the quote first). Each person on a fact has "Take it back" (`facts.revoke`). Things shared with nobody sit under "Just between us".

## Mia and Leo (`views/family/`)

One app for both. Tabs at the bottom: **Carrie · Mum · Circle** for Mia, **Carrie · Grandma · Circle** for Leo (label from the viewer's `relation`: daughter says "Mum", grandson says "Grandma"). The viewer only ever sees `facts.sharedWith(viewer.id)`.

- **Carrie** (the conversation, newest at the bottom): built from data, oldest first:
  - after each finished call, Carrie says when she spoke with Rose, then one card per fact from that call shared with the viewer: the statement, a play button for the receipt and the quote. A `request` fact has "I'll do it" (`facts.claim`); once claimed it says who is on it. Never show `call.summary` (it can mention private things).
  - the viewer's own recordings to Rose (play button, and "Carrie plays it on the next call" or "Played" with the date);
  - Rose's answers to them (`inReplyTo`), as Carrie saying "She answered you", with a play button;
  - the viewer's requests: an `ask` or `tell` shows as their bubble, then Carrie's line ("I'll ask her on the next call at 10:00" while pending, "I asked her on Tuesday's call" when done).
  - The composer has three modes, picked with chips: **Ask Carrie** (default; answered at once from what Rose has shared with the viewer, by matching words against the statements and quotes: show the matching facts with receipts, or "She hasn't mentioned that to me. Shall I ask her?" with a button that turns it into an `ask`), **Ask her** (`requests.add` kind `ask`), **Tell her** (kind `tell`). A microphone button records a voice note for Rose (`voiceNotes.send`). "Check in now" adds a `checkin` request; Carrie answers "Calling her now."
- **Mum / Grandma**: a header card (when Carrie last spoke with her, the next call time, and what Carrie will bring: waiting recordings and pending requests from the viewer), then "She needs" (`request` facts, with "I'll do it"), then the other facts grouped by topic with receipts. For Leo put the lighter topics (mood, social, daily) first under "Moments".
- **Circle**: who is in the circle and their relation; when Carrie calls; what she gently checks on (chips); the doctor and the next appointment with "Copy the doctor's link" (`/doctor`); the consent rules in two plain sentences, including the urgent exception. Only the main contact (`settings.isMainContact(viewer.id)`, Mia) can edit the call time and the checks; for Leo it is read-only.

## Dr. Chen (`views/doctor/`)

One page, no menu, opened by link before the appointment. Calm and dense; the dove appears only small next to the wordmark.

- Header: Rose, the appointment time, and one line: only what Rose agreed to share with the doctor, self-reported on calls, not a medical record.
- "Since the last visit": the facts in `facts.sharedWith(doctor.id)`, health and medication first, each with the date, the statement, her exact words and a play button. Where several facts are about the same thing (same category and a shared key word), say how many times it came up.
- A 14-day strip for self-reported missed pills (a dot per day, marked on days with a `medication` fact).
- "Ask Carrie to check something" (`requests.add` kind `ask` from the doctor) and "After the visit: what should Rose remember?" (kind `tell`), each listing what was already sent with its status.

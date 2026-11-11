-- Demo data: Rose's care circle and a week of calls, so nobody's screen is empty before the live call.
-- Everyone here is fictional.
-- Seeded lines have no audio clip (audio_path is null); the app reads those quotes in a synthetic
-- voice and says so. Lines recorded in a real call play as recorded.

insert into public.people (id, role, name, relation, avatar_color) values
  ('00000000-0000-4000-8000-000000000001', 'elder',  'Rose',     'Grandma, 78',   'var(--color-person-rose)'),
  ('00000000-0000-4000-8000-000000000002', 'family', 'Mia',      'Daughter',      'var(--color-person-mia)'),
  ('00000000-0000-4000-8000-000000000003', 'family', 'Leo',      'Grandson',      'var(--color-person-leo)'),
  ('00000000-0000-4000-8000-000000000004', 'doctor', 'Dr. Chen', 'Family doctor', 'var(--color-person-chen)');

insert into public.care_settings (elder_id, call_time, checks, main_contact_id, doctor_id, next_appointment) values
  ('00000000-0000-4000-8000-000000000001', '10:00', array['Blood pressure pill', 'Sleep', 'Her knee'],
   '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004',
   date_trunc('day', now()) + interval '2 days 1 hour');

-- No summaries: a summary could mention something Rose kept to herself.
insert into public.calls (id, elder_id, started_at, ended_at) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001',
   now() - interval '6 days', now() - interval '6 days' + interval '7 minutes'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   now() - interval '3 days', now() - interval '3 days' + interval '9 minutes'),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001',
   now() - interval '1 day', now() - interval '1 day' + interval '8 minutes');

insert into public.utterances (id, call_id, speaker, speaker_id, text, position, created_at) values
  -- Call 1
  ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-0000000000c1', 'carrie', null,
   'Hi Rose, it''s Carrie, your family''s AI helper. How has your day been?', 1, now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000a02', '00000000-0000-4000-8000-0000000000c1', 'elder', '00000000-0000-4000-8000-000000000001',
   'Joan and I walked down to the market this morning. It was lovely, we had a coffee after.', 2, now() - interval '6 days' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000a03', '00000000-0000-4000-8000-0000000000c1', 'carrie', null,
   'That sounds like a good morning. And how are you sleeping?', 3, now() - interval '6 days' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000a04', '00000000-0000-4000-8000-0000000000c1', 'elder', '00000000-0000-4000-8000-000000000001',
   'Not well. I keep waking up at four and I just lie there until it gets light.', 4, now() - interval '6 days' + interval '3 minutes'),
  -- Call 2
  ('00000000-0000-4000-8000-000000000a05', '00000000-0000-4000-8000-0000000000c2', 'carrie', null,
   'Hi Rose, it''s Carrie, your family''s AI helper. Did you manage your tablets this week?', 1, now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000a06', '00000000-0000-4000-8000-0000000000c2', 'elder', '00000000-0000-4000-8000-000000000001',
   'I forgot the little white one on Tuesday, the blood pressure one. I took it the other days.', 2, now() - interval '3 days' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000a14', '00000000-0000-4000-8000-0000000000c2', 'elder', '00000000-0000-4000-8000-000000000001',
   'I was up at four again last night. I made tea and sat by the window.', 3, now() - interval '3 days' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000a07', '00000000-0000-4000-8000-0000000000c2', 'elder', '00000000-0000-4000-8000-000000000001',
   'I haven''t heard from Leo in a while. I do miss that boy.', 4, now() - interval '3 days' + interval '4 minutes'),
  ('00000000-0000-4000-8000-000000000a08', '00000000-0000-4000-8000-0000000000c2', 'elder', '00000000-0000-4000-8000-000000000001',
   'The boiler man says it will be two thousand. I don''t know where that comes from. Don''t say anything to Mia.', 5, now() - interval '3 days' + interval '6 minutes'),
  -- Call 3
  ('00000000-0000-4000-8000-000000000a09', '00000000-0000-4000-8000-0000000000c3', 'carrie', null,
   'Hi Rose, it''s Carrie, your family''s AI helper. Leo left you a message. Shall I play it?', 1, now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000a16', '00000000-0000-4000-8000-0000000000c3', 'elder', '00000000-0000-4000-8000-000000000001',
   'Tell Leo I''m making the apple cake for Saturday. He always has two slices.', 2, now() - interval '1 day' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000a10', '00000000-0000-4000-8000-0000000000c3', 'elder', '00000000-0000-4000-8000-000000000001',
   'I went dizzy on Monday getting up from my chair. Had to hold the table. Don''t tell Mia, she worries.', 3, now() - interval '1 day' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-0000000000c3', 'carrie', null,
   'I won''t tell Mia. Can I tell Dr. Chen, so she knows before your appointment?', 4, now() - interval '1 day' + interval '3 minutes'),
  ('00000000-0000-4000-8000-000000000a12', '00000000-0000-4000-8000-0000000000c3', 'elder', '00000000-0000-4000-8000-000000000001',
   'Yes, tell the doctor. That''s all right.', 5, now() - interval '1 day' + interval '3 minutes'),
  ('00000000-0000-4000-8000-000000000a13', '00000000-0000-4000-8000-0000000000c3', 'elder', '00000000-0000-4000-8000-000000000001',
   'Someone needs to ring the eye clinic for me. I can''t manage that phone menu.', 6, now() - interval '1 day' + interval '5 minutes');

-- shared_with lists exactly the people Rose said yes to, by name.
insert into public.facts
  (id, call_id, elder_id, utterance_id, category, statement, quote, shared_with, consent, created_at)
values
  ('00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a02', 'social',
   'Walked to the market with her neighbour Joan',
   'Joan and I walked down to the market this morning. It was lovely, we had a coffee after.',
   array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']::uuid[], 'granted',
   now() - interval '6 days' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000f02', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a04', 'health',
   'Wakes around 4 a.m. most nights and cannot get back to sleep',
   'I keep waking up at four and I just lie there until it gets light.',
   array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004']::uuid[], 'granted',
   now() - interval '6 days' + interval '3 minutes'),
  ('00000000-0000-4000-8000-000000000f03', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a06', 'medication',
   'Missed her blood pressure pill on Tuesday',
   'I forgot the little white one on Tuesday, the blood pressure one.',
   array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004']::uuid[], 'granted',
   now() - interval '3 days' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000f08', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a14', 'health',
   'Awake at 4 a.m. again; got up and made tea',
   'I was up at four again last night. I made tea and sat by the window.',
   array['00000000-0000-4000-8000-000000000004']::uuid[], 'granted',
   now() - interval '3 days' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000f04', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a07', 'mood',
   'Misses Leo and would love to hear from him',
   'I haven''t heard from Leo in a while. I do miss that boy.',
   array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']::uuid[], 'granted',
   now() - interval '3 days' + interval '4 minutes'),
  ('00000000-0000-4000-8000-000000000f05', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a08', 'daily',
   'Worried about the cost of a new boiler',
   'The boiler man says it will be two thousand. I don''t know where that comes from.',
   '{}'::uuid[], 'declined',
   now() - interval '3 days' + interval '6 minutes'),
  ('00000000-0000-4000-8000-000000000f09', '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a16', 'daily',
   'Baking her apple cake for Saturday',
   'I''m making the apple cake for Saturday. He always has two slices.',
   array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']::uuid[], 'granted',
   now() - interval '1 day' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000f06', '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a10', 'health',
   'Felt dizzy getting up from her chair on Monday',
   'I went dizzy on Monday getting up from my chair. Had to hold the table.',
   array['00000000-0000-4000-8000-000000000004']::uuid[], 'granted',
   now() - interval '1 day' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000f07', '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a13', 'request',
   'Needs someone to book her eye clinic appointment',
   'Someone needs to ring the eye clinic for me. I can''t manage that phone menu.',
   array['00000000-0000-4000-8000-000000000002']::uuid[], 'granted',
   now() - interval '1 day' + interval '5 minutes');

-- Leo answered "misses Leo"; Carrie played it on yesterday's call and Rose answered him.
insert into public.voice_notes
  (id, from_id, to_id, audio_path, transcript, reply_to_fact_id, in_reply_to, delivered_call_id, delivered_at, created_at)
values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
   null, 'Hi Grandma, it''s Leo. I miss you too. I''m coming over on Saturday, save me some of that apple cake.',
   '00000000-0000-4000-8000-000000000f04', null,
   '00000000-0000-4000-8000-0000000000c3', now() - interval '1 day', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003',
   null, 'Tell Leo I''m making the apple cake for Saturday. He always has two slices.',
   null, '00000000-0000-4000-8000-0000000000b1',
   '00000000-0000-4000-8000-0000000000c3', now() - interval '1 day' + interval '1 minute', now() - interval '1 day' + interval '1 minute');

insert into public.requests (id, elder_id, from_id, kind, text, status, handled_call_id, created_at) values
  -- Dr. Chen's question waits for the next call.
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004',
   'ask', 'Does the dizziness come on after the morning pill?', 'pending', null, now() - interval '3 hours'),
  -- Mia's message was carried on yesterday's call.
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'tell', 'I''m coming on Sunday with the photo albums.', 'done', '00000000-0000-4000-8000-0000000000c3', now() - interval '2 days');

-- Demo data: Rose's care circle and a week of calls, so the family feed and the doctor brief
-- are not empty before the live call. Everyone here is fictional.
-- Seeded lines have no audio clip yet (audio_path is null); record them to make the receipts play.

insert into public.people (id, role, name, relation, avatar_color) values
  ('00000000-0000-4000-8000-000000000001', 'elder',  'Rose',     'grandma',       '#E8A598'),
  ('00000000-0000-4000-8000-000000000002', 'family', 'Mia',      'daughter',      '#7FB7A4'),
  ('00000000-0000-4000-8000-000000000003', 'family', 'Leo',      'grandson',      '#8FA8D9'),
  ('00000000-0000-4000-8000-000000000004', 'doctor', 'Dr. Chen', 'family doctor', '#B9A3D6');

insert into public.calls (id, elder_id, started_at, ended_at, summary) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001',
   now() - interval '6 days', now() - interval '6 days' + interval '7 minutes',
   'Good spirits after a walk to the market with Joan. Sleep is broken: awake around four most nights.'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   now() - interval '3 days', now() - interval '3 days' + interval '9 minutes',
   'Missed her blood pressure pill on Tuesday. Misses Leo. Worried about the boiler bill, kept private.'),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001',
   now() - interval '1 day', now() - interval '1 day' + interval '6 minutes',
   'Dizzy getting up on Monday, for the doctor only. Needs help booking the eye clinic.');

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
  ('00000000-0000-4000-8000-000000000a07', '00000000-0000-4000-8000-0000000000c2', 'elder', '00000000-0000-4000-8000-000000000001',
   'I haven''t heard from Leo in a while. I do miss that boy.', 3, now() - interval '3 days' + interval '4 minutes'),
  ('00000000-0000-4000-8000-000000000a08', '00000000-0000-4000-8000-0000000000c2', 'elder', '00000000-0000-4000-8000-000000000001',
   'The boiler man says it will be two thousand. I don''t know where that comes from. Don''t say anything to Mia.', 4, now() - interval '3 days' + interval '6 minutes'),
  -- Call 3
  ('00000000-0000-4000-8000-000000000a09', '00000000-0000-4000-8000-0000000000c3', 'carrie', null,
   'Hi Rose, it''s Carrie, your family''s AI helper. How are you feeling today?', 1, now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000a10', '00000000-0000-4000-8000-0000000000c3', 'elder', '00000000-0000-4000-8000-000000000001',
   'I went dizzy on Monday getting up from my chair. Had to hold the table. Don''t tell Mia, she worries.', 2, now() - interval '1 day' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-0000000000c3', 'carrie', null,
   'I won''t tell Mia. Can I tell Dr. Chen, so she knows before your appointment?', 3, now() - interval '1 day' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000a12', '00000000-0000-4000-8000-0000000000c3', 'elder', '00000000-0000-4000-8000-000000000001',
   'Yes, tell the doctor. That''s all right.', 4, now() - interval '1 day' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000a13', '00000000-0000-4000-8000-0000000000c3', 'elder', '00000000-0000-4000-8000-000000000001',
   'Someone needs to ring the eye clinic for me. I can''t manage that phone menu.', 5, now() - interval '1 day' + interval '4 minutes');

insert into public.facts
  (id, call_id, elder_id, utterance_id, category, statement, quote, share_family, share_doctor, consent, created_at)
values
  ('00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a02', 'social',
   'Walked to the market with her neighbour Joan',
   'Joan and I walked down to the market this morning. It was lovely, we had a coffee after.',
   true, false, 'granted', now() - interval '6 days' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000f02', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a04', 'health',
   'Wakes around 4 a.m. most nights and cannot get back to sleep',
   'I keep waking up at four and I just lie there until it gets light.',
   true, true, 'granted', now() - interval '6 days' + interval '3 minutes'),
  ('00000000-0000-4000-8000-000000000f03', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a06', 'medication',
   'Missed her blood pressure pill on Tuesday',
   'I forgot the little white one on Tuesday, the blood pressure one.',
   true, true, 'granted', now() - interval '3 days' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000f04', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a07', 'mood',
   'Misses Leo and would love to hear from him',
   'I haven''t heard from Leo in a while. I do miss that boy.',
   true, false, 'granted', now() - interval '3 days' + interval '4 minutes'),
  ('00000000-0000-4000-8000-000000000f05', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a08', 'daily',
   'Worried about the cost of a new boiler',
   'The boiler man says it will be two thousand. I don''t know where that comes from.',
   false, false, 'declined', now() - interval '3 days' + interval '6 minutes'),
  ('00000000-0000-4000-8000-000000000f06', '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a10', 'health',
   'Felt dizzy getting up from her chair on Monday',
   'I went dizzy on Monday getting up from my chair. Had to hold the table.',
   false, true, 'granted', now() - interval '1 day' + interval '1 minute'),
  ('00000000-0000-4000-8000-000000000f07', '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000a13', 'request',
   'Needs someone to book her eye clinic appointment',
   'Someone needs to ring the eye clinic for me. I can''t manage that phone menu.',
   true, false, 'granted', now() - interval '1 day' + interval '4 minutes');

-- Leo answered the "misses Leo" fact; Carrie has not played it to Rose yet.
insert into public.voice_notes (id, from_id, to_id, audio_path, transcript, reply_to_fact_id, created_at) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
   null, 'Hi Grandma, it''s Leo. I miss you too. I''m coming over on Saturday, save me some of that apple cake.',
   '00000000-0000-4000-8000-000000000f04', now() - interval '2 days');

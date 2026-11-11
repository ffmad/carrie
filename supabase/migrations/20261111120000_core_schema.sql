-- Carrie core schema.
--   people       the care circle: the elder, the family members, the doctor
--   calls        one phone call between Carrie and the elder
--   utterances   each thing said in a call; the elder's lines keep their audio clip
--   facts        what Carrie learned, each tied to the utterance that proves it (the receipt)
--   voice_notes  real voice messages Carrie carries from the family to the elder
--
-- Hackathon demo: there is no sign-in yet, so the policies at the bottom open every table
-- and the `clips` bucket to the anon key. Replace them with per-circle policies before any
-- real person's data goes in.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('elder', 'family', 'doctor')),
  name text not null,
  -- How the elder would call them: "daughter", "grandson", "family doctor".
  relation text,
  avatar_color text,
  created_at timestamptz not null default now()
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.people (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text
);
create index calls_elder_started_idx on public.calls (elder_id, started_at desc);

create table public.utterances (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  speaker text not null check (speaker in ('elder', 'carrie', 'family')),
  speaker_id uuid references public.people (id) on delete set null,
  text text not null,
  -- Path in the `clips` bucket. Carrie's own lines are synthesized, so they have none.
  audio_path text,
  position int not null,
  created_at timestamptz not null default now()
);
create index utterances_call_position_idx on public.utterances (call_id, position);

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  elder_id uuid not null references public.people (id) on delete cascade,
  -- The receipt: the utterance where the elder said it.
  utterance_id uuid references public.utterances (id) on delete set null,
  category text not null check (category in ('health', 'medication', 'mood', 'daily', 'social', 'request')),
  -- Carrie's one-line wording, and the elder's exact words it rests on.
  statement text not null,
  quote text not null,
  -- Family and doctor are separate: "tell the doctor, but not my daughter" is a valid answer.
  share_family boolean not null default false,
  share_doctor boolean not null default false,
  -- pending = Carrie has not asked yet; declined = the elder said to keep it private.
  consent text not null default 'pending' check (consent in ('pending', 'granted', 'declined')),
  created_at timestamptz not null default now(),
  -- Nothing leaves the call without a yes.
  constraint facts_share_needs_consent check (consent = 'granted' or not (share_family or share_doctor))
);
create index facts_elder_created_idx on public.facts (elder_id, created_at desc);

create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.people (id) on delete cascade,
  to_id uuid not null references public.people (id) on delete cascade,
  audio_path text,
  transcript text,
  reply_to_fact_id uuid references public.facts (id) on delete set null,
  -- Set once Carrie has played it to the elder.
  delivered_call_id uuid references public.calls (id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index voice_notes_to_created_idx on public.voice_notes (to_id, created_at desc);

-- The family's phone updates while the call is still going.
alter publication supabase_realtime
  add table public.calls, public.utterances, public.facts, public.voice_notes;

-- Audio clips ----------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('clips', 'clips', true)
on conflict (id) do nothing;

create policy "demo: anyone reads clips" on storage.objects
  for select to anon, authenticated using (bucket_id = 'clips');
create policy "demo: anyone uploads clips" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'clips');

-- Demo access ----------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['people', 'calls', 'utterances', 'facts', 'voice_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format(
      'create policy "demo: open to everyone" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end;
$$;

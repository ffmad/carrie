-- Sharing becomes per person, and the family and doctor can give Carrie things to carry.
--   facts.shared_with   the people who may see a fact ("Can I tell Mia?" does not tell Leo)
--   facts.claimed_by    who said "I'll do it" for something the elder needs
--   voice_notes.in_reply_to  the elder's spoken answer to a family recording
--   requests       "ask her…", "tell her…" for the next call, and "check in now"
--   care_settings  when Carrie rings, what she checks on, the main contact, the next appointment
--
-- Same demo access as the core schema: no sign-in, open to the anon key.

alter table public.facts add column shared_with uuid[] not null default '{}';

update public.facts f
set shared_with = coalesce(
  (select array_agg(p.id order by p.created_at, p.name)
   from public.people p
   where (f.share_family and p.role = 'family') or (f.share_doctor and p.role = 'doctor')),
  '{}'
);

alter table public.facts drop constraint facts_share_needs_consent;
alter table public.facts drop column share_family, drop column share_doctor;
-- Nothing leaves the call without a yes.
alter table public.facts
  add constraint facts_share_needs_consent check (consent = 'granted' or cardinality(shared_with) = 0);

alter table public.facts add column claimed_by uuid references public.people (id) on delete set null;

alter table public.voice_notes add column in_reply_to uuid references public.voice_notes (id) on delete set null;

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.people (id) on delete cascade,
  from_id uuid not null references public.people (id) on delete cascade,
  -- ask / tell wait for the next call; checkin makes the elder's phone ring now.
  kind text not null check (kind in ('ask', 'tell', 'checkin')),
  text text not null default '',
  status text not null default 'pending' check (status in ('pending', 'done')),
  -- The call in which Carrie carried it.
  handled_call_id uuid references public.calls (id) on delete set null,
  created_at timestamptz not null default now()
);
create index requests_elder_status_idx on public.requests (elder_id, status, created_at);

create table public.care_settings (
  elder_id uuid primary key references public.people (id) on delete cascade,
  call_time text not null default '10:00',
  checks text[] not null default '{}',
  main_contact_id uuid references public.people (id) on delete set null,
  doctor_id uuid references public.people (id) on delete set null,
  next_appointment timestamptz,
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['requests', 'care_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format(
      'create policy "demo: open to everyone" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end;
$$;

-- A thread is a relationship in her record that has recurred: two things
-- that happened near each other in time more than once. It is built from
-- the temporal links and changes the baselines run already stores, by the
-- intelligence function, and it is the object an insight is written about.
--
-- The claim a thread makes is exactly what its evidence rows point at and
-- no more. The wording that ever reaches her will say "followed" or
-- "occurred alongside", never "caused". The status values and evidence
-- roles are the spec's, verbatim (section 5.4).

create type public.thread_status as enum (
  'new', 'watching', 'recurring', 'contextualized', 'actionable', 'changed', 'resolved', 'continue'
);

create type public.evidence_role as enum (
  'supports', 'context', 'contradicts', 'alternative_explanation', 'user_reported', 'research_context'
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Names the relationship, not the occasion: the two metric names, sorted,
  -- joined with a tilde, so cycle_length~sleep_hours is the same key however
  -- the pair was found. The unique constraint below is what lets the
  -- function upsert: seeing the relationship again updates this row.
  key text not null,
  title text not null,
  status public.thread_status not null default 'new',
  domains text[] not null default '{}',
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  -- How many separate times the relationship has been seen. Zero is a
  -- thread with no occurrences, which the function never writes; negative
  -- is a bug, and it fails here rather than reaching a sentence.
  observation_count integer not null default 0,
  -- Components and the names of what is missing, per the 16 September
  -- founder decision. Nothing reads a score out of this while the Decision
  -- Register's lock on scores stands; see the Slice 3c plan's decisions.
  confidence jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  constraint threads_count_check check (observation_count >= 0)
);

create index threads_user_status on public.threads (user_id, status);

alter table public.threads enable row level security;
create policy "owner select" on public.threads for select to authenticated
  using (user_id = (select auth.uid()));
create trigger threads_touch before update on public.threads
  for each row execute function public.touch_updated_at();

-- Derived by the server, never written by the client, exactly as
-- temporal_links. enable_owner_rls() is deliberately not used here: it
-- would grant insert, update and delete policies to the owner, and a thread
-- she could edit is a trace she could edit.
revoke all on public.threads from anon, authenticated;
grant select on public.threads to authenticated;
grant all on public.threads to service_role;

-- What a thread rests on. Each row points at exactly one stored thing: an
-- observation, a change, or a link (Slice 3c Task 2 adds research refs).
-- That is the trace, and it is why a row that pointed at nothing, or at two
-- things, is refused as it is formed rather than stored and puzzled over.
create table public.thread_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  role public.evidence_role not null,
  -- Cascades, all three: evidence pointing at a row that no longer exists
  -- is not evidence.
  observation_id uuid references public.observations (id) on delete cascade,
  change_id uuid references public.changes (id) on delete cascade,
  link_id uuid references public.temporal_links (id) on delete cascade,
  -- A short note the function attaches, for example which side of the pair
  -- this row is. Never her words: those live in journal_entries and are
  -- pointed at through an observation.
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint thread_evidence_one_target check (
    (observation_id is not null)::int + (change_id is not null)::int + (link_id is not null)::int = 1
  )
);

create index thread_evidence_thread on public.thread_evidence (thread_id);
create index thread_evidence_user on public.thread_evidence (user_id);

alter table public.thread_evidence enable row level security;
create policy "owner select" on public.thread_evidence for select to authenticated
  using (user_id = (select auth.uid()));
create trigger thread_evidence_touch before update on public.thread_evidence
  for each row execute function public.touch_updated_at();

revoke all on public.thread_evidence from anon, authenticated;
grant select on public.thread_evidence to authenticated;
grant all on public.thread_evidence to service_role;

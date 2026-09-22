-- An insight is what the intelligence function says about a thread, in the
-- four parts the Insight screen shows: what changed, what it was connected
-- to, what she told the record around those days, and what is not
-- established. The fourth is a column that may not be empty, because an
-- insight that has not named what it does not know has not earned the
-- screen. Every sentence in these columns is produced by the wording
-- module from structured fields; nothing here is written by hand.
--
-- A research ref is a publication about a cohort, worded to her as
-- "Research has found" and never as proof about her. It is reference data
-- with no owner, so it takes the concepts shape (see 20260918100300): RLS
-- on with one unconditional select policy, and grants that let a signed in
-- person read and nobody but the server write. No refs are seeded by this
-- migration or by Slice 3c: every ref must be a real publication that a
-- person has reviewed, which is what reviewed_by and reviewed_at record.

create table public.research_refs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publication text,
  year integer check (year is null or (year >= 1900 and year <= 2100)),
  url text,
  summary text not null,
  domains text[] not null default '{}',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.research_refs enable row level security;
create policy research_refs_read on public.research_refs
  for select to authenticated
  using (true);
comment on policy research_refs_read on public.research_refs is 'Reference data, readable by any signed in person. using (true) is unconditional because the rows have no owner: a published cohort study is the same fact for everyone. No policy permits insert, update or delete, so writes are refused by default even if a grant were widened later.';
create trigger research_refs_touch before update on public.research_refs
  for each row execute function public.touch_updated_at();

revoke all on public.research_refs from anon, authenticated;
grant select on public.research_refs to authenticated;
grant all on public.research_refs to service_role;

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  title text not null,
  what_changed text not null,
  connected text not null,
  you_told text not null,
  not_established text not null,
  alternatives text[] not null default '{}',
  -- new: written this run. updated: the same thread, with new parts.
  -- continuing: seen again, nothing new to say. resolved: the relationship
  -- stopped recurring. dismissed: she said so (Slice 4 writes that).
  status text not null default 'new'
    check (status in ('new', 'updated', 'continuing', 'resolved', 'dismissed')),
  importance integer not null default 0,
  confidence jsonb not null default '{}',
  valid_from timestamptz not null default now(),
  -- Set when a later insight about the same thread replaces this one, so
  -- the newest live insight is the one with valid_to null.
  valid_to timestamptz,
  dismissed_at timestamptz,
  dismissal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insights_not_established_named check (length(btrim(not_established)) > 0)
);

create index insights_user_live on public.insights (user_id, valid_from desc) where valid_to is null;
create index insights_thread on public.insights (thread_id);

alter table public.insights enable row level security;
create policy "owner select" on public.insights for select to authenticated
  using (user_id = (select auth.uid()));
create trigger insights_touch before update on public.insights
  for each row execute function public.touch_updated_at();

revoke all on public.insights from anon, authenticated;
grant select on public.insights to authenticated;
grant all on public.insights to service_role;

-- Evidence may now point at a research ref, and still at exactly one thing.
-- The Task 1 check covered three columns; this replaces it with four.
alter table public.thread_evidence
  add column research_ref_id uuid references public.research_refs (id) on delete set null;
alter table public.thread_evidence drop constraint thread_evidence_one_target;
alter table public.thread_evidence add constraint thread_evidence_one_target check (
  (observation_id is not null)::int + (change_id is not null)::int
  + (link_id is not null)::int + (research_ref_id is not null)::int = 1
);

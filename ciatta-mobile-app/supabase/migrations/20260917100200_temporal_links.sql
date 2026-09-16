-- Two things in her record happened near each other in time. That is the
-- whole claim this table makes. It is the raw material a thread is built
-- from in the next slice, and the wording that ever reaches her will say
-- "occurred alongside" or "followed", never "caused".
--
-- The values are the spec's, verbatim (section 5.4).
create type public.link_relation as enum (
  'same_day', 'within_24h', 'within_3d', 'within_7d', 'before', 'after', 'recurring'
);

create table public.temporal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- a is always the earlier observation by occurred_at, ties broken on the
  -- smaller uuid. Without that rule the same pair lands twice, once from
  -- each side. relation describes b relative to a.
  a_observation_id uuid not null references public.observations (id) on delete cascade,
  b_observation_id uuid not null references public.observations (id) on delete cascade,
  relation public.link_relation not null,
  gap_hours numeric not null,
  -- The day the later of the two happened, for indexing a person's recent
  -- links without joining back to observations.
  occurred_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, a_observation_id, b_observation_id, relation),
  constraint temporal_links_distinct_check check (a_observation_id <> b_observation_id),
  -- a is the earlier observation, so the gap is a magnitude. A negative one
  -- means the ordering rule was broken upstream, which is a bug rather than
  -- a datum, and it should fail loudly here rather than quietly skew a
  -- later thread.
  constraint temporal_links_gap_check check (gap_hours >= 0)
);
create index temporal_links_user_day on public.temporal_links (user_id, occurred_on desc);
create index temporal_links_a on public.temporal_links (a_observation_id);
create index temporal_links_b on public.temporal_links (b_observation_id);

-- Server derived, exactly like baselines and changes: she reads her own
-- rows and never writes them. enable_owner_rls is the wrong helper here for
-- the same reason it was wrong for baselines, it would hand her insert,
-- update and delete policies she must not have.
alter table public.temporal_links enable row level security;
create policy "owner select" on public.temporal_links for select to authenticated
  using (user_id = (select auth.uid()));
create trigger temporal_links_touch before update on public.temporal_links
  for each row execute function public.touch_updated_at();
revoke all on public.temporal_links from anon, authenticated;
grant select on public.temporal_links to authenticated;
grant all on public.temporal_links to service_role;

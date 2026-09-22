-- The second half of the loop, stored: what she is offered about an insight
-- (recommendations), what she chooses (considerations, actions), what
-- happened after (outcomes, in two halves she and the server each own),
-- what was learned (learning_events), and what she has already seen
-- (insight_views), which is how Today can say what changed since last time
-- instead of repeating the same discovery.
--
-- Two kinds of ownership, kept apart on purpose. Recommendations and
-- learning events are the server's: written only by the intelligence
-- function, read only to her, exactly as threads and insights are. Actions,
-- considerations, insight views and the REPORTED half of an outcome are
-- hers, under the same owner policies as her episodes. The MEASURED half of
-- an outcome is the server's, enforced by column grants rather than a
-- separate table, so one row holds both answers side by side and neither
-- can overwrite the other.

create type public.recommendation_type as enum (
  'observe', 'log', 'reflect', 'try', 'review', 'prepare', 'explore', 'discuss', 'connect', 'continue', 'no_action_yet'
);

-- An offer, never an instruction. Grounded in exactly one stored thing: an
-- insight, a thread, or a change (the short walk the engine already
-- suggests rests on a sustained drop in steps, which is a change row and
-- not yet a thread). key is what lets the function upsert the same offer
-- run after run without resurrecting one she dismissed.
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.recommendation_type not null,
  insight_id uuid references public.insights (id) on delete cascade,
  thread_id uuid references public.threads (id) on delete cascade,
  change_id uuid references public.changes (id) on delete cascade,
  key text not null,
  title text not null,
  body text not null default '',
  status text not null default 'active'
    check (status in ('active', 'accepted', 'dismissed', 'expired')),
  dismissed_at timestamptz,
  dismissal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  constraint recommendations_one_grounding check (
    (insight_id is not null)::int + (thread_id is not null)::int + (change_id is not null)::int = 1
  )
);
create index recommendations_user_status on public.recommendations (user_id, status);
alter table public.recommendations enable row level security;
create policy "owner select" on public.recommendations for select to authenticated
  using (user_id = (select auth.uid()));
create trigger recommendations_touch before update on public.recommendations
  for each row execute function public.touch_updated_at();
revoke all on public.recommendations from anon, authenticated;
grant select on public.recommendations to authenticated;
grant all on public.recommendations to service_role;

-- Her stance on a thing: watching it, dismissing an offer with a reason,
-- marking it handled. Hers to write, and also written by the RPCs that
-- change a status, so the reason outlives the offer it was about.
create table public.considerations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  basis_kind text not null check (basis_kind in ('insight', 'thread', 'recommendation')),
  basis_id uuid not null,
  status text not null default 'active'
    check (status in ('active', 'dismissed', 'completed', 'expired')),
  reason text check (reason is null or reason in ('not_relevant', 'already_handled', 'dont_want_to', 'waiting', 'other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index considerations_user_basis on public.considerations (user_id, basis_kind, basis_id);
select public.enable_owner_rls('considerations');
revoke all on public.considerations from anon, authenticated;
grant select, insert, update, delete on public.considerations to authenticated;
grant all on public.considerations to service_role;

-- Something she decided to try, with the intent she gave it. metric and
-- wanted name the measure she hopes to move and which way; without them
-- the measured outcome is unknown, never guessed. One action of a kind per
-- day: a walk planned twice on one day is one walk.
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind text not null default 'custom',
  intent text,
  expected_outcome text,
  metric text check (metric is null or metric in ('sleep_hours', 'steps', 'resting_hr', 'hrv', 'active_minutes')),
  wanted text check (wanted is null or wanted in ('higher', 'lower')),
  started_on date not null default current_date,
  started_at timestamptz not null default now(),
  target_end_at timestamptz,
  ended_at timestamptz,
  status text not null default 'active'
    check (status in ('planned', 'active', 'ended', 'abandoned')),
  created_from_insight_id uuid references public.insights (id) on delete set null,
  created_from_recommendation_id uuid references public.recommendations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, started_on)
);
create index actions_user_started on public.actions (user_id, started_on desc);
select public.enable_owner_rls('actions');
revoke all on public.actions from anon, authenticated;
grant select, insert, update, delete on public.actions to authenticated;
grant all on public.actions to service_role;

-- What happened after, in two halves. reported is what she says; measured
-- is what the server found in the days around the action, with the
-- evidence it used. The column grants below are the boundary: she can
-- create the row and write reported, and nothing she can do reaches
-- measured. The server writes measured and never touches reported.
create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action_id uuid not null references public.actions (id) on delete cascade,
  reported text check (reported is null or reported in ('improved', 'unchanged', 'worse', 'insufficient_evidence', 'unknown')),
  reported_at timestamptz,
  measured text check (measured is null or measured in ('improved', 'unchanged', 'worse', 'insufficient_evidence', 'unknown')),
  measured_at timestamptz,
  measured_evidence jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, action_id)
);
create index outcomes_action on public.outcomes (action_id);
select public.enable_owner_rls('outcomes');
revoke all on public.outcomes from anon, authenticated;
grant select on public.outcomes to authenticated;
grant insert (user_id, action_id, reported, reported_at) on public.outcomes to authenticated;
grant update (reported, reported_at) on public.outcomes to authenticated;
grant all on public.outcomes to service_role;

-- What was learned, as the function found it: a pattern that came back, an
-- outcome measured or reported, an insight that changed. key makes each
-- lesson land once. A summary that says nothing is refused.
create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid references public.threads (id) on delete set null,
  action_id uuid references public.actions (id) on delete set null,
  outcome_id uuid references public.outcomes (id) on delete set null,
  type text not null
    check (type in ('pattern_recurred', 'pattern_resolved', 'outcome_measured', 'outcome_reported', 'insight_updated')),
  summary text not null,
  evidence jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  constraint learning_events_summary_named check (length(btrim(summary)) > 0)
);
create index learning_events_user_time on public.learning_events (user_id, occurred_at desc);
alter table public.learning_events enable row level security;
create policy "owner select" on public.learning_events for select to authenticated
  using (user_id = (select auth.uid()));
create trigger learning_events_touch before update on public.learning_events
  for each row execute function public.touch_updated_at();
revoke all on public.learning_events from anon, authenticated;
grant select on public.learning_events to authenticated;
grant all on public.learning_events to service_role;

-- What she has already seen, so Today can tell new from unchanged.
create table public.insight_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_id uuid not null references public.insights (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  viewed_count integer not null default 1 check (viewed_count >= 1),
  status_when_last_seen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, insight_id)
);
create index insight_views_insight on public.insight_views (insight_id);
select public.enable_owner_rls('insight_views');
revoke all on public.insight_views from anon, authenticated;
grant select, insert, update on public.insight_views to authenticated;
grant all on public.insight_views to service_role;

-- Her own entries invoke the reasoning (spec section 6): an action she
-- starts or ends, and an outcome she reports, queue an intelligence run for
-- her, the way a daily_metrics write queues baselines. The function's own
-- writes to these rows fire it too; that costs one extra run that finds
-- nothing new and completes, and jobs_one_pending keeps it to one.
create function public.enqueue_intelligence_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_job(new.user_id, 'intelligence');
  return new;
end $$;
revoke execute on function public.enqueue_intelligence_job() from public, anon, authenticated;

create trigger actions_enqueue_intelligence after insert or update of status, ended_at on public.actions
  for each row execute function public.enqueue_intelligence_job();
create trigger outcomes_enqueue_intelligence after insert or update of reported on public.outcomes
  for each row execute function public.enqueue_intelligence_job();

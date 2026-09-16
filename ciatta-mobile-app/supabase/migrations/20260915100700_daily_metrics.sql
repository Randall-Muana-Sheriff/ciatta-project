-- One row per person per day: what her devices measured and what she checked
-- in. Mirrors the Day shape the screens already read. Every column is
-- nullable: a metric Apple Health has no sample for stays unknown.
create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid,
  provenance public.provenance not null default 'MEASURED',
  day date not null,
  sleep_hours numeric,
  stage_awake numeric,
  stage_rem numeric,
  stage_light numeric,
  stage_deep numeric,
  time_in_bed numeric,
  steps integer,
  active_minutes numeric,
  workouts jsonb not null default '[]',
  resting_hr numeric,
  hrv numeric,
  temp_deviation numeric,
  energy smallint check (energy between 1 and 5),
  mood smallint check (mood between 1 and 5),
  stress smallint check (stress between 1 and 5),
  caffeine numeric,
  alcohol numeric,
  foods text[] not null default '{}',
  digestion text[] not null default '{}',
  note text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day),
  constraint daily_metrics_provenance_client_check
    check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED')),
  constraint daily_metrics_source_id_user_id_fkey
    foreign key (source_id, user_id) references public.health_sources (id, user_id)
    on delete set null (source_id)
);
create index daily_metrics_user_day on public.daily_metrics (user_id, day desc);
select public.enable_owner_rls('daily_metrics');
revoke all on public.daily_metrics from anon, authenticated;
grant select, insert, update, delete on public.daily_metrics to authenticated;
grant all on public.daily_metrics to service_role;

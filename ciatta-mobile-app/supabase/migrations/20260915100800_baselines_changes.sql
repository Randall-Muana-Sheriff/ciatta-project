-- What is usual for her, per metric, and what has moved against it. Both
-- tables are server derived: the baselines/changes job (a later task in
-- this slice) writes them as service_role; she only ever reads her own
-- rows. Unlike every table so far, enable_owner_rls is the wrong helper
-- here -- it would hand her insert, update and delete policies she must
-- not have.

create table public.baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  window_days integer not null,
  median numeric,
  low numeric,
  high numeric,
  variability numeric,
  n integer not null default 0,
  sufficient boolean not null default false,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, metric, window_days),
  -- Null means unknown; a baseline with too little history is sufficient
  -- false, never a fabricated number. So a sufficient baseline must carry
  -- a median, and an insufficient one must carry none of the derived figures.
  constraint baselines_sufficiency_check check (
    (sufficient and median is not null)
    or (not sufficient and median is null and low is null and high is null and variability is null)
  )
);
create index baselines_user_metric on public.baselines (user_id, metric);

alter table public.baselines enable row level security;
create policy "owner select" on public.baselines for select to authenticated
  using (user_id = (select auth.uid()));
create trigger baselines_touch before update on public.baselines
  for each row execute function public.touch_updated_at();
revoke all on public.baselines from anon, authenticated;
grant select on public.baselines to authenticated;
grant all on public.baselines to service_role;

create table public.changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  from_value numeric not null,
  to_value numeric not null,
  window_days integer not null,
  deviation numeric not null,
  direction text not null check (direction in ('lower', 'higher')),
  quality text not null default 'ok' check (quality in ('ok', 'partial', 'low')),
  detected_on date not null,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, metric, detected_on)
);
create index changes_user_detected on public.changes (user_id, detected_on desc);

alter table public.changes enable row level security;
create policy "owner select" on public.changes for select to authenticated
  using (user_id = (select auth.uid()));
create trigger changes_touch before update on public.changes
  for each row execute function public.touch_updated_at();
revoke all on public.changes from anon, authenticated;
grant select on public.changes to authenticated;
grant all on public.changes to service_role;

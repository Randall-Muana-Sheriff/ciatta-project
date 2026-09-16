-- The server-only work queue. Writing a day row means her baselines may
-- now be out of date, so it queues a job for the baselines function
-- (a later task in this slice) to pick up and recompute. She never sees
-- this table: it is an implementation detail of the server, not her data.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('baselines')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index jobs_user_kind on public.jobs (user_id, kind);
-- At most one pending job per person per kind: repeated writes while a job
-- is still queued (or running) collapse into the one already waiting.
create unique index jobs_one_pending on public.jobs (user_id, kind) where status = 'pending';

alter table public.jobs enable row level security;
-- No policy at all: RLS here is belt and braces, since the grant below
-- already gives neither Data API role anything to evaluate a policy against.
revoke all on public.jobs from anon, authenticated;
grant all on public.jobs to service_role;

-- Queues a pending job, or does nothing if one is already waiting. Runs
-- with definer rights so it can write jobs regardless of who is asking it
-- to (the trigger below fires on her own insert/update of her own row).
-- The second parameter is named job_kind, not kind, because "kind" is also
-- a column of jobs: PL/pgSQL's ambiguity check reaches into the ON CONFLICT
-- target list too (not just expressions), and there is no way to qualify a
-- column there to resolve it, so the parameter name itself has to differ.
create function public.enqueue_job(uid uuid, job_kind text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.jobs (user_id, kind, status)
  values (uid, job_kind, 'pending')
  on conflict (user_id, kind) where status = 'pending' do nothing;
end $$;
revoke execute on function public.enqueue_job(uuid, text) from public, anon, authenticated;

-- Runs with definer rights because the row that fired it already passed
-- her RLS on daily_metrics; it only ever queues work for that same row's owner.
create function public.enqueue_baselines_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_job(new.user_id, 'baselines');
  return new;
end $$;
revoke execute on function public.enqueue_baselines_job() from public, anon, authenticated;

create trigger daily_metrics_enqueue_baselines after insert or update on public.daily_metrics
  for each row execute function public.enqueue_baselines_job();

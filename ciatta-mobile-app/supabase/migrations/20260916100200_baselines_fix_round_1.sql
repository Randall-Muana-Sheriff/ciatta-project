-- Task 6 review, fix round 1.

-- Fix 1: the function fed itself. daily_metrics_enqueue_baselines had no
-- WHEN clause, so writing temp_deviation (which the baselines function
-- itself derives) re-enqueued another baselines job every time, forever,
-- for anyone with wrist temperature data -- the job in hand is 'running',
-- not 'pending', so jobs_one_pending never collapsed the new row.
--
-- A single combined "after insert or update" trigger can't reference OLD
-- in its WHEN clause (OLD doesn't exist for an insert), so this splits
-- into two triggers: insert always enqueues (there is nothing to compare
-- to), update enqueues only when a column that actually feeds a baseline
-- changed. temp_deviation is deliberately not one of them.
drop trigger daily_metrics_enqueue_baselines on public.daily_metrics;

create trigger daily_metrics_enqueue_baselines_insert after insert on public.daily_metrics
  for each row execute function public.enqueue_baselines_job();

create trigger daily_metrics_enqueue_baselines_update after update on public.daily_metrics
  for each row
  when (
    new.sleep_hours is distinct from old.sleep_hours
    or new.steps is distinct from old.steps
    or new.resting_hr is distinct from old.resting_hr
    or new.hrv is distinct from old.hrv
    or new.active_minutes is distinct from old.active_minutes
  )
  execute function public.enqueue_baselines_job();

-- The other half of fix 1: even with the WHEN clause above, a recompute
-- that lands on the same number as last time is still a write (a new row
-- version, updated_at churn) for no reason. write_temp_deviations() folds
-- the whole batch into one statement whose ON CONFLICT branch only fires
-- when the value actually changed, and only sets temp_deviation there --
-- provenance is intentionally absent from that SET list, so an existing
-- row (real measurements) keeps whatever provenance it already has; only
-- a brand new row, created solely to hold this deviation, takes the
-- 'DERIVED' this migration adds below (fix 4).
create function public.write_temp_deviations(p_user_id uuid, p_deviations jsonb) returns void
language sql security invoker set search_path = '' as $$
  insert into public.daily_metrics (user_id, day, temp_deviation, provenance)
  select p_user_id, (d ->> 'day')::date, (d ->> 'value')::numeric, 'DERIVED'::public.provenance
  from jsonb_array_elements(p_deviations) as d
  on conflict (user_id, day) do update
    set temp_deviation = excluded.temp_deviation
    where public.daily_metrics.temp_deviation is distinct from excluded.temp_deviation;
$$;
revoke all on function public.write_temp_deviations(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.write_temp_deviations(uuid, jsonb) to service_role;

-- Fix 2 and fix 3: claim also clears any stale last_error (so a job that
-- failed once and then succeeded doesn't end up 'done' with an old error
-- name attached), and also reclaims a 'running' job whose started_at is
-- over 15 minutes old. Fifteen minutes because a legitimate run here
-- processes one person's data across five metrics plus one temperature
-- pass -- a handful of queries, not a batch job -- so anything still
-- 'running' after that long almost certainly crashed or was killed
-- mid-run rather than being genuinely busy; cleanup_baselines_jobs()
-- only sweeps 'done' rows, so without this a crash left a job stuck
-- forever with nothing to reclaim it.
create or replace function public.claim_baselines_job() returns setof public.jobs
language sql security invoker set search_path = '' as $$
  update public.jobs
  set status = 'running', started_at = now(), attempts = attempts + 1, last_error = null
  where id = (
    select id from public.jobs
    where kind = 'baselines'
      and (status = 'pending' or (status = 'running' and started_at < now() - interval '15 minutes'))
    order by created_at
    for update skip locked
    limit 1
  )
  returning *;
$$;

-- Fix 4: now that the client's write on daily_metrics is revoked entirely
-- (20260916100100_daily_metrics_read_only.sql), the only writer left is
-- this server, so DERIVED is a safe addition here (client provenance
-- values are unaffected; 'DERIVED' was never one of them and still isn't
-- reachable by authenticated). A row created solely to hold a temperature
-- deviation, with no measured content of its own, should not carry
-- 'MEASURED' as its provenance.
alter table public.daily_metrics
  drop constraint daily_metrics_provenance_client_check,
  add constraint daily_metrics_provenance_client_check
    check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED', 'DERIVED'));

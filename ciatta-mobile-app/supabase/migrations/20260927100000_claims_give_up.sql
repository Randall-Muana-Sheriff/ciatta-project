-- A job that kills its worker never gets to say it failed.
--
-- fail_baselines_job and fail_intelligence_job retire a job after three
-- reported failures, but they are called by the function, and a function
-- killed at the platform's CPU or memory limit calls nothing. Its job stays
-- running, the claim below reclaims it fifteen minutes later, the worker is
-- killed again, and that repeats for as long as the scheduler ticks. On the
-- live project five baselines jobs for one person were reclaimed between 37
-- and 325 times each over four days (23 to 27 September 2026) before anyone
-- looked.
--
-- So the claim itself now gives up. Before it claims anything, a running
-- job that has gone stale and has already been picked up five times is
-- closed as failed with the reason Abandoned, unless the function managed
-- to record a reason of its own. Five is above the three that a reported
-- failure allows, so a job the function can still speak for is retired by
-- its own rule first, and only a silent one reaches this.

create or replace function public.claim_baselines_job() returns setof public.jobs
language sql security invoker set search_path = '' as $$
  update public.jobs
  set status = 'failed', last_error = coalesce(last_error, 'Abandoned'), finished_at = now()
  where kind = 'baselines'
    and status = 'running'
    and started_at < now() - interval '15 minutes'
    and attempts >= 5;

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
revoke all on function public.claim_baselines_job() from public, anon, authenticated;
grant execute on function public.claim_baselines_job() to service_role;

create or replace function public.claim_intelligence_job() returns setof public.jobs
language sql security invoker set search_path = '' as $$
  update public.jobs
  set status = 'failed', last_error = coalesce(last_error, 'Abandoned'), finished_at = now()
  where kind = 'intelligence'
    and status = 'running'
    and started_at < now() - interval '15 minutes'
    and attempts >= 5;

  update public.jobs
  set status = 'running', started_at = now(), attempts = attempts + 1, last_error = null
  where id = (
    select id from public.jobs
    where kind = 'intelligence'
      and (status = 'pending' or (status = 'running' and started_at < now() - interval '15 minutes'))
    order by created_at
    for update skip locked
    limit 1
  )
  returning *;
$$;
revoke all on function public.claim_intelligence_job() from public, anon, authenticated;
grant execute on function public.claim_intelligence_job() to service_role;

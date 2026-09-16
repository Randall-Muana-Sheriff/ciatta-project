-- Claiming, completing and cleaning up jobs needs one atomic statement
-- (claim: an update whose target row is picked with `for update skip
-- locked`, so two overlapping runs never claim the same job) and
-- PostgREST's REST interface has no way to express that; only a plain SQL
-- statement can. These functions exist only so the baselines edge function
-- can call them over RPC as service_role, which already holds full grants
-- on public.jobs (see 20260915100900_jobs.sql) -- this is not a privilege
-- escalation, just the one operation the Data API can't shape on its own.

-- `returns setof`, not a bare `public.jobs`: a SQL function with a plain
-- composite return type still returns one row (every column null) when
-- its query matches nothing, which reads as "claimed a job with no id"
-- rather than "nothing to claim". `setof` lets zero pending jobs come back
-- as zero rows.
create function public.claim_baselines_job() returns setof public.jobs
language sql security invoker set search_path = '' as $$
  update public.jobs
  set status = 'running', started_at = now(), attempts = attempts + 1
  where id = (
    select id from public.jobs
    where status = 'pending' and kind = 'baselines'
    order by created_at
    for update skip locked
    limit 1
  )
  returning *;
$$;
revoke all on function public.claim_baselines_job() from public, anon, authenticated;
grant execute on function public.claim_baselines_job() to service_role;

create function public.complete_baselines_job(job_id uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.jobs set status = 'done', finished_at = now() where id = job_id;
$$;
revoke all on function public.complete_baselines_job(uuid) from public, anon, authenticated;
grant execute on function public.complete_baselines_job(uuid) to service_role;

-- Records the error name (never health content, the caller's job) and
-- sends the job back to pending, unless this was its third attempt
-- (attempts is already incremented by claim_baselines_job before the work
-- runs), in which case it stops retrying and fails for good.
create function public.fail_baselines_job(job_id uuid, error_name text) returns void
language sql security invoker set search_path = '' as $$
  update public.jobs
  set last_error = error_name,
      status = case when attempts >= 3 then 'failed' else 'pending' end
  where id = job_id;
$$;
revoke all on function public.fail_baselines_job(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_baselines_job(uuid, text) to service_role;

-- The queue grows without bound otherwise (Task 3's own note); called at
-- the end of a successful run.
create function public.cleanup_baselines_jobs() returns void
language sql security invoker set search_path = '' as $$
  delete from public.jobs where status = 'done' and finished_at < now() - interval '7 days';
$$;
revoke all on function public.cleanup_baselines_jobs() from public, anon, authenticated;
grant execute on function public.cleanup_baselines_jobs() to service_role;

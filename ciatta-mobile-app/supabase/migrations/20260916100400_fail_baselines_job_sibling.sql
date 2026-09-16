-- Slice 2 review: fail_baselines_job requeued a failed job by setting it
-- back to 'pending', but a daily_metrics write that lands while the job is
-- running enqueues a new pending row for the same (user_id, kind) through
-- the trigger. The jobs_one_pending partial unique index
-- (20260915100900_jobs.sql) then rejects the update, the edge function's
-- error path logs the failure and moves on, and the job sits in 'running'
-- until the 15 minute reclaim sweeps it up. Bounded, but a swallowed
-- constraint violation on a queue's own error path is not something to
-- leave standing.
--
-- When a sibling pending row already exists, that row carries the work this
-- job was going to redo, so this one is marked 'done' rather than colliding
-- with it. finished_at is stamped at the same time, because
-- cleanup_baselines_jobs() only sweeps 'done' rows that have one, and a
-- 'done' row with a null finished_at would sit in the queue forever.
--
-- On the ACL: `create or replace function` keeps the existing privileges on
-- the function rather than resetting them, so the revoke and grant from
-- 20260916100000_claim_baselines_job.sql do still stand after this. They are
-- restated below anyway rather than assumed: this project revokes execute
-- from public, anon and authenticated for every function it defines, and
-- that guarantee should be visible in the file that last wrote the function,
-- not inferred from the one before it.
create or replace function public.fail_baselines_job(job_id uuid, error_name text) returns void
language sql security invoker set search_path = '' as $$
  update public.jobs j
  set last_error = error_name,
      status = case
                 when j.attempts >= 3 then 'failed'
                 when exists (
                   select 1 from public.jobs sibling
                   where sibling.user_id = j.user_id
                     and sibling.kind = j.kind
                     and sibling.status = 'pending'
                     and sibling.id <> j.id
                 ) then 'done'
                 else 'pending'
               end,
      finished_at = case
                      when j.attempts < 3 and exists (
                        select 1 from public.jobs sibling
                        where sibling.user_id = j.user_id
                          and sibling.kind = j.kind
                          and sibling.status = 'pending'
                          and sibling.id <> j.id
                      ) then now()
                      else j.finished_at
                    end
  where j.id = job_id;
$$;
revoke all on function public.fail_baselines_job(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_baselines_job(uuid, text) to service_role;

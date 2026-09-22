-- The reasoning runs as its own job, after the arithmetic, never before it.
--
-- Threads are built from the changes and temporal links the baselines run
-- writes, so running intelligence before that run finishes would read a
-- stale window. The chain below makes that impossible: complete_baselines_job
-- enqueues an intelligence job for the same person as its last act, and
-- jobs_one_pending collapses ten completions in a row into one run that
-- reads everything they wrote. It is a separate function rather than more
-- steps inside baselines because that function already skips its links step
-- when a window is dense to stay inside one request's CPU (links.ts);
-- reading every link and every change in the same request would make that
-- skip fire sooner and take the baselines down with it.
--
-- Every function here mirrors its baselines sibling, including the 15
-- minute reclaim of a crashed run and the pending sibling rule from
-- 20260916100400. cleanup_baselines_jobs already sweeps done rows of every
-- kind, so it is reused rather than duplicated.

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('baselines', 'intelligence'));

create function public.claim_intelligence_job() returns setof public.jobs
language sql security invoker set search_path = '' as $$
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

create function public.complete_intelligence_job(job_id uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.jobs set status = 'done', finished_at = now() where id = job_id;
$$;
revoke all on function public.complete_intelligence_job(uuid) from public, anon, authenticated;
grant execute on function public.complete_intelligence_job(uuid) to service_role;

create function public.fail_intelligence_job(job_id uuid, error_name text) returns void
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
revoke all on function public.fail_intelligence_job(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_intelligence_job(uuid, text) to service_role;

-- The chain. complete_baselines_job stays security invoker, so the edge
-- function's service role is the caller of enqueue_job here; that role held
-- no execute on enqueue_job until now (the trigger and the reconciliation
-- job reach it as other roles), so the grant below is load bearing and the
-- test asserts it positively.
create or replace function public.complete_baselines_job(job_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid;
begin
  update public.jobs set status = 'done', finished_at = now()
  where id = job_id
  returning user_id into owner;
  if owner is not null then
    perform public.enqueue_job(owner, 'intelligence');
  end if;
end $$;
revoke all on function public.complete_baselines_job(uuid) from public, anon, authenticated;
grant execute on function public.complete_baselines_job(uuid) to service_role;
grant execute on function public.enqueue_job(uuid, text) to service_role;

-- The drain, a copy of baselines_tick with one path changed. It reads the
-- key from Vault at call time, so the cron command carries no secret.
create function public.intelligence_tick(batch integer default 10) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  service_key text;
  project_url text;
  fired integer := 0;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key';
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url';

  if service_key is null or project_url is null then
    return 0;
  end if;

  for i in 1..batch loop
    perform net.http_post(
      url := project_url || '/functions/v1/intelligence',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      timeout_milliseconds := 30000
    );
    fired := fired + 1;
  end loop;

  return fired;
end $$;
revoke execute on function public.intelligence_tick(integer) from public, anon, authenticated;

-- Same cadence as the baselines drain. An intelligence job only exists once
-- a baselines job has completed, so a tick that fires in the same minute
-- finds nothing to claim until the next one, and nothing is read early.
select cron.schedule(
  'intelligence-drain',
  '*/5 * * * *',
  $$ select public.intelligence_tick(10) $$
);

-- The health view learns the new drain and the new queue. A view can only
-- be replaced with its existing columns in their existing order, so the
-- shape from 20260917100400 is kept verbatim, scheduler_configured
-- included, and the four new columns come after it.
create or replace view public.scheduler_health
with (security_invoker = true) as
select
  j.jobname,
  max(d.start_time) as last_run,
  (array_agg(d.status order by d.start_time desc))[1] as last_status,
  count(*) filter (
    where d.status <> 'succeeded' and d.start_time > now() - interval '24 hours'
  ) as failures_24h,
  (select count(*) from public.jobs
     where status = 'pending' and kind = 'baselines') as queue_pending_jobs,
  (select min(created_at) from public.jobs
     where status = 'pending' and kind = 'baselines') as queue_oldest_pending,
  (select count(*) from public.jobs
     where status = 'running' and kind = 'baselines') as queue_running_jobs,
  (select min(started_at) from public.jobs
     where status = 'running' and kind = 'baselines') as queue_oldest_running,
  (select count(*) from vault.decrypted_secrets
     where name in ('service_role_key', 'project_url')) = 2 as scheduler_configured,
  (select count(*) from public.jobs
     where status = 'pending' and kind = 'intelligence') as intelligence_pending_jobs,
  (select min(created_at) from public.jobs
     where status = 'pending' and kind = 'intelligence') as intelligence_oldest_pending,
  (select count(*) from public.jobs
     where status = 'running' and kind = 'intelligence') as intelligence_running_jobs,
  (select min(started_at) from public.jobs
     where status = 'running' and kind = 'intelligence') as intelligence_oldest_running
from cron.job j
left join cron.job_run_details d on d.jobid = j.jobid
where j.jobname in ('baselines-drain', 'baselines-reconcile', 'intelligence-drain')
group by j.jobname;
revoke all on public.scheduler_health from anon, authenticated;
grant select on public.scheduler_health to service_role;

-- The state scheduler_health could not see, and the one most likely on the
-- day this is deployed.
--
-- baselines_tick reads the service role key and the project url out of
-- Vault, and when either is missing it returns 0 and posts nothing. That is
-- deliberate: a cron job firing every five minutes should not raise every
-- five minutes over a thing a person has to go and fix. But it means the
-- tick SUCCEEDS while doing nothing at all, and every column of this view
-- then reports health. Observed on a stack with an empty vault: last_status
-- succeeded, failures_24h 0, every queue column 0. Nothing had ever been
-- posted and the view had no way to say so.
--
-- Missing secrets are the ordinary deploy day failure, not an exotic one.
-- The secret is created by hand against the live database (it is a secret,
-- so no migration may carry it), which means it can be forgotten, misnamed,
-- or created from the wrong key era. All three look identical here.
--
-- So the view reports whether the pipeline is configured at all, as a fact
-- it reads rather than a state it infers. Both names are required because
-- baselines_tick requires both: it returns 0 if either is null.
--
-- service_role can read vault.decrypted_secrets, which was verified against
-- the running stack rather than assumed: it holds usage on schema vault and
-- select on both vault.secrets and vault.decrypted_secrets, and a read
-- under set role service_role succeeds. That matters because this view is
-- security_invoker and carries no privileges of its own, so a role that
-- could not read the vault would get an error here instead of a column.
--
-- Only the count of matching NAMES is read. No decrypted_secret value is
-- selected, returned, or reachable through this view, and the key is never
-- rendered anywhere a reader of scheduler_health could see it.
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
     where name in ('service_role_key', 'project_url')) = 2 as scheduler_configured
from cron.job j
left join cron.job_run_details d on d.jobid = j.jobid
where j.jobname in ('baselines-drain', 'baselines-reconcile')
group by j.jobname;

-- How to read this column, stated plainly, because the person reading it at
-- 2am will read the green columns first and stop.
--
-- scheduler_configured false means NOTHING HAS EVER BEEN POSTED. Not that
-- the pipeline is slow, or behind, or degraded: that no request has ever
-- reached the baselines function and no baseline has ever been computed by
-- the scheduler. Every other column on that row is green because the tick
-- ran and returned cleanly, having decided there was nothing it could do.
-- last_status succeeded, failures_24h 0 and an empty queue are all
-- compatible with a pipeline that is completely dead, and this is the one
-- column that separates the two.
--
-- A false here is fixed by creating the two Vault secrets on the live
-- project, named exactly service_role_key and project_url. It is never
-- fixed by waiting.
--
-- The converse is not promised. scheduler_configured true says both secrets
-- exist under those names, and nothing more: it cannot say the key is
-- current, that it belongs to this project, or that the function accepted
-- it. pg_net is fire and forget, so no column in this view can say that.
-- The queue draining is still the only evidence the pipeline works end to
-- end.

-- Revoke first, then grant the one role that needs it. Never additive.
-- Restated here because create or replace view preserves the privileges the
-- view already had, and a grant that is merely inherited is a grant nobody
-- has checked.
revoke all on public.scheduler_health from anon, authenticated;
grant select on public.scheduler_health to service_role;

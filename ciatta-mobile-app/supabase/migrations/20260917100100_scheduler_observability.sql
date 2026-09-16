-- One query that answers "is the baselines pipeline actually running, and
-- is it keeping up". The facts live in two places: cron.job_run_details
-- says whether the tick fired and whether it errored, and public.jobs says
-- whether the queue is draining. A person debugging this at 2am should not
-- have to know that.
--
-- net._http_response is deliberately NOT read here, though it is the
-- obvious third source. Two reasons. It carries only the RESPONSE side of
-- each post; the REQUEST headers, which carry the service role key as
-- plaintext jsonb, live in net.http_request_queue, and a view that joined
-- its way toward one is a key waiting to be selected by someone who only
-- meant to check on a cron job. And the posts are fired in a loop with no
-- per job correlation id, so a response row cannot honestly be attributed
-- to the job it drained. A column that cannot be trusted is worse here
-- than a column that is absent, so last_status reports what cron saw.
--
-- security_invoker so the view carries no privileges of its own: it is
-- readable only by a role that can already read the tables underneath,
-- which is service_role and the superuser, and neither Data API role is
-- granted anything below.
create view public.scheduler_health
with (security_invoker = true) as
select
  j.jobname,
  max(d.start_time) as last_run,
  (array_agg(d.status order by d.start_time desc))[1] as last_status,
  count(*) filter (
    where d.status <> 'succeeded' and d.start_time > now() - interval '24 hours'
  ) as failures_24h,
  (select count(*) from public.jobs where status = 'pending') as pending_jobs,
  (select min(created_at) from public.jobs where status = 'pending') as oldest_pending
from cron.job j
left join cron.job_run_details d on d.jobid = j.jobid
where j.jobname in ('baselines-drain', 'baselines-reconcile')
group by j.jobname;

-- The left join is what makes this answer on a database where nothing has
-- run yet: a scheduled job with no runs still returns a row, with a null
-- last_run and zero failures, rather than vanishing. The first person to
-- ask "is this running" will ask before it ever has.
--
-- Nothing in the view exposes a person: jobs is counted, never read out by
-- user_id, and no health column is reachable from here at all.

-- Revoke first, then grant the one role that needs it. Never additive.
revoke all on public.scheduler_health from anon, authenticated;
grant select on public.scheduler_health to service_role;

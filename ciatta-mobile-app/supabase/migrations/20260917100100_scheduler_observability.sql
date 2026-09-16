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
  (select count(*) from public.jobs
     where status = 'pending' and kind = 'baselines') as queue_pending_jobs,
  (select min(created_at) from public.jobs
     where status = 'pending' and kind = 'baselines') as queue_oldest_pending,
  (select count(*) from public.jobs
     where status = 'running' and kind = 'baselines') as queue_running_jobs,
  (select min(started_at) from public.jobs
     where status = 'running' and kind = 'baselines') as queue_oldest_running
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
--
-- The four queue columns carry a queue_ prefix and are filtered to
-- kind = 'baselines'. The prefix because they are global to the queue and
-- not scoped to the row's jobname: both rows of this view carry the same
-- four values, and sitting immediately right of jobname the unprefixed
-- names read as though they belonged to that job. The kind filter because
-- jobs.kind allows only 'baselines' today, so an unfiltered count is right
-- by accident and becomes silently wrong the day a second kind is added.

-- What last_status and failures_24h do and do not mean. The names promise
-- more than they can deliver, and the person reading this at 2am will
-- believe the names.
--
-- Both describe the TICK, not the pipeline. pg_net is asynchronous:
-- baselines_tick returns the moment its posts are queued, never waiting for
-- an answer, so a tick that fires ten posts which all come back 500 still
-- records 'succeeded' here. failures_24h counts only ticks that raised
-- inside Postgres, despite a name that sounds like it counts pipeline
-- failures. It is not a count of baselines that failed to compute, and
-- nothing in this view is.
--
-- Worse, failures_24h reads 0 when the job has not run at all, which is the
-- worst state presenting as the best one. last_run is what reveals that: a
-- null last_run, or one older than five minutes, means the drain is not
-- firing however clean the failure count looks.
--
-- So the real signal that the pipeline is broken is the QUEUE failing to
-- drain: queue_pending_jobs climbing, or queue_oldest_pending falling
-- further behind. The running pair is the other half of that signal and the
-- reason it exists: counting only pending made a job that
-- claim_baselines_job moved to 'running' and that never finished invisible
-- here. Pending read 0, oldest read null, and a jammed queue presented as a
-- perfectly healthy one. queue_oldest_running is measured from started_at,
-- the moment the job was claimed, which is the same clock
-- claim_baselines_job uses for its fifteen minute stale reclaim: a running
-- job older than that is stuck rather than busy.

-- Revoke first, then grant the one role that needs it. Never additive.
revoke all on public.scheduler_health from anon, authenticated;
grant select on public.scheduler_health to service_role;

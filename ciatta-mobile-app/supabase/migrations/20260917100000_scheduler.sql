-- Slice 2 shipped the baselines function and the job queue that feeds it,
-- and nothing called it: jobs enqueued on every device sync and sat
-- pending forever, so nobody's baselines were ever computed. This is the
-- caller.
--
-- pg_cron cannot make an HTTP request on its own, so pg_net provides the
-- post. pg_net is asynchronous: net.http_post queues the request and
-- returns an id immediately rather than waiting for the response, which is
-- why firing a batch of posts in one tick costs almost nothing.
--
-- `with schema extensions` places the extension itself alongside the other
-- extensions, but pg_net is not relocatable: its functions always land in
-- the schema `net` that the extension creates, which is why every call
-- below is qualified net.http_post and not extensions.http_post.
create extension if not exists pg_net with schema extensions;

-- Worth knowing, and not fixable from here: net.http_request_queue stores
-- each queued request's headers as plaintext jsonb, and the header posted
-- below carries the service role key. Supabase's issue_pg_net_access event
-- trigger grants the whole net schema to anon and authenticated as the
-- extension is created, and both that schema and its tables are owned by
-- supabase_admin, so a revoke issued from a migration (which runs as
-- postgres, not a superuser) is a no-op with a warning rather than an
-- error. What keeps the key out of reach is that the Data API exposes only
-- the public and graphql_public schemas, so net is not reachable over
-- REST, and pg_net's worker deletes queue rows once they age out. Raised
-- for the deploy step rather than silently worked around here.

-- pg_cron is not installed by default on this stack, so this file installs
-- it rather than assuming it. It is not relocatable either: the extension
-- sits in pg_catalog and its own objects live in the schema `cron`.
create extension if not exists pg_cron;

-- The service role key lives in Vault, never in the cron command. cron.job
-- stores its command as plain text, so a key written there would be
-- readable by anyone who could read that table. The secret is created by
-- the deploy step (see the plan's Task 5), not by this migration, because a
-- migration file lives in git and a key must never be committed.
--
-- baselines_tick fires up to `batch` posts at the baselines function. Each
-- post claims at most one job, so `batch` is the most jobs one tick can
-- drain. It returns the number of posts fired, never the number of jobs
-- processed: pg_net is asynchronous, so this function cannot know what
-- happened downstream, and it must not claim otherwise.
create function public.baselines_tick(batch integer default 10) returns integer
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

  -- No secret configured is not an error worth raising from a cron job
  -- every five minutes; it is a state to report. Nothing is posted.
  if service_key is null or project_url is null then
    return 0;
  end if;

  for i in 1..batch loop
    perform net.http_post(
      url := project_url || '/functions/v1/baselines',
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
revoke execute on function public.baselines_tick(integer) from public, anon, authenticated;

-- The nightly safety net. A job is normally enqueued by the trigger on
-- daily_metrics, so this exists for the case where that did not happen: a
-- failed job that exhausted its attempts, a row written before the trigger
-- existed, a restore. It enqueues one baselines job per person who has any
-- daily_metrics row at all; jobs_one_pending collapses anyone who already
-- has one waiting, so running it twice in a row is harmless.
--
-- Returns the number of users considered, not the number of rows inserted:
-- the insert is deliberately silent about conflicts, so the count of new
-- jobs is not knowable without a second query nobody needs.
create function public.enqueue_baselines_reconciliation() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  considered integer := 0;
begin
  select count(distinct user_id) into considered from public.daily_metrics;

  perform public.enqueue_job(user_id, 'baselines')
  from (select distinct user_id from public.daily_metrics) as owners;

  return considered;
end $$;
revoke execute on function public.enqueue_baselines_reconciliation() from public, anon, authenticated;

-- Every five minutes rather than the spec's morning refresh: a sync at 9am
-- should not wait until tomorrow to be processed. This subsumes the
-- morning refresh and keeps the nightly reconciliation below.
select cron.schedule(
  'baselines-drain',
  '*/5 * * * *',
  $$ select public.baselines_tick(10) $$
);

-- 03:15 UTC, off the hour so it does not land with every other nightly job
-- in the region.
select cron.schedule(
  'baselines-reconcile',
  '15 3 * * *',
  $$ select public.enqueue_baselines_reconciliation() $$
);

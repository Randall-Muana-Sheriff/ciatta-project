-- A drain posts only for the work that is waiting.
--
-- Both drains fired `batch` posts every five minutes whether or not a job
-- was pending: ten requests to each function, 5,760 a day, almost all of
-- them claiming nothing. Each tick now counts the jobs its function could
-- claim (pending, or running and stale for fifteen minutes, which is what
-- the claim RPC would take) and posts at most that many. An empty queue is
-- an empty tick.
--
-- The count is read in the same statement the posts are fired from, so a
-- job enqueued a moment later waits for the next tick, as it always did.
-- The return value keeps its meaning: posts fired, never jobs processed.

create or replace function public.baselines_tick(batch integer default 10) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  service_key text;
  project_url text;
  waiting integer;
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

  select count(*) into waiting from public.jobs
  where kind = 'baselines'
    and (status = 'pending' or (status = 'running' and started_at < now() - interval '15 minutes'));

  for i in 1..least(batch, waiting) loop
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

create or replace function public.intelligence_tick(batch integer default 10) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  service_key text;
  project_url text;
  waiting integer;
  fired integer := 0;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key';
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url';

  if service_key is null or project_url is null then
    return 0;
  end if;

  select count(*) into waiting from public.jobs
  where kind = 'intelligence'
    and (status = 'pending' or (status = 'running' and started_at < now() - interval '15 minutes'));

  for i in 1..least(batch, waiting) loop
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

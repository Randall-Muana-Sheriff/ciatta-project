-- Her records kept current without her asking. Every fifteen minutes the
-- scheduler asks provider-connect to read the few connections that have
-- waited longest, and each connection is read about once every twenty
-- hours (SYNC_EVERY_HOURS in the function).
--
-- sync_attempted_at, not last_synced_at, decides who is next. A connection
-- whose provider keeps failing is still moved to the back after each
-- attempt, so it cannot hold the front of the queue and starve everyone
-- else.
--
-- Same arrangement as baselines_tick: pg_net posts, and the service role
-- key comes from Vault at run time, so it is never in cron.job's command.

alter table public.provider_connections add column sync_attempted_at timestamptz;

comment on column public.provider_connections.sync_attempted_at is
  'When a sync of this connection last started, whether or not it finished. The scheduled run takes the oldest first.';

create function public.provider_sync_tick() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  service_key text;
  project_url text;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key';
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url';

  if service_key is null or project_url is null then
    return 0;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/provider-connect',
    body := '{"action":"sync_due"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    timeout_milliseconds := 120000
  );
  return 1;
end $$;
revoke execute on function public.provider_sync_tick() from public, anon, authenticated;

select cron.schedule(
  'provider-sync',
  '*/15 * * * *',
  $$ select public.provider_sync_tick() $$
);

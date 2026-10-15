begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'provider_connections', 'sync_attempted_at', 'a connection records when a sync was last tried');
select has_function('public', 'provider_sync_tick', 'provider_sync_tick exists');
select ok(not has_function_privilege('anon', 'public.provider_sync_tick()', 'EXECUTE'), 'anon cannot run the provider sync');
select ok(not has_function_privilege('authenticated', 'public.provider_sync_tick()', 'EXECUTE'), 'authenticated cannot run the provider sync');
select ok(
  exists (select 1 from cron.job where jobname = 'provider-sync'
          and command not ilike '%bearer%' and command not ilike '%service_role%' and command not ilike '%eyJ%'),
  'the provider sync is scheduled, and its command carries no key'
);

select * from finish();
rollback;

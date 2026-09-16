begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- The extensions this rests on are actually installed.
select has_extension('pg_cron', 'pg_cron is installed');
-- The extension is named pg_net; the schema it creates for its own
-- functions is the one called net.
select has_extension('pg_net', 'pg_net is installed');

-- Both functions exist.
select has_function('public', 'baselines_tick', 'baselines_tick exists');
select has_function('public', 'enqueue_baselines_reconciliation', 'reconciliation enqueuer exists');

-- Neither Data API role can call them. This is the whole security of the
-- scheduler: baselines_tick reads the service role key out of Vault.
-- baselines_tick(integer), not baselines_tick(): a default argument does
-- not create a second zero argument signature for this to name.
select ok(not has_function_privilege('anon', 'public.baselines_tick(integer)', 'EXECUTE'),
  'anon cannot execute baselines_tick');
select ok(not has_function_privilege('authenticated', 'public.baselines_tick(integer)', 'EXECUTE'),
  'authenticated cannot execute baselines_tick');
select ok(not has_function_privilege('anon', 'public.enqueue_baselines_reconciliation()', 'EXECUTE'),
  'anon cannot execute the reconciliation enqueuer');
select ok(not has_function_privilege('authenticated', 'public.enqueue_baselines_reconciliation()', 'EXECUTE'),
  'authenticated cannot execute the reconciliation enqueuer');

-- Both cron jobs are scheduled.
select ok(
  exists (select 1 from cron.job where jobname = 'baselines-drain'),
  'the five minute drain is scheduled'
);
select ok(
  exists (select 1 from cron.job where jobname = 'baselines-reconcile'),
  'the nightly reconciliation is scheduled'
);

-- The key is not sitting in the cron command in plaintext. This is the
-- failure this design exists to prevent, so it is asserted rather than
-- assumed: the command calls a function and carries no bearer token.
select ok(
  not exists (select 1 from cron.job where command ilike '%bearer%' or command ilike '%service_role%' or command ilike '%eyJ%'),
  'no cron command carries a key or a bearer token'
);

-- The reconciliation enqueues one job per user who has any daily_metrics
-- row, and the one pending job index collapses duplicates.
select lives_ok(
  $$ select public.enqueue_baselines_reconciliation() $$,
  'the reconciliation enqueuer runs without error on an empty database'
);

select * from finish();
rollback;

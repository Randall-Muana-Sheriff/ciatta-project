begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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

-- The health view exists and is server only.
select has_view('public', 'scheduler_health', 'scheduler_health exists');
select ok(not has_table_privilege('anon', 'public.scheduler_health', 'SELECT'),
  'anon cannot read scheduler health');
select ok(not has_table_privilege('authenticated', 'public.scheduler_health', 'SELECT'),
  'authenticated cannot read scheduler health');

-- It answers on an empty database rather than erroring, because the first
-- person to ask "is this running" will ask before it has ever run.
select lives_ok(
  $$ select * from public.scheduler_health $$,
  'scheduler health answers before the first run'
);

-- The column that separates a healthy pipeline from a dead one, because
-- every other column reports health either way. baselines_tick returns 0
-- and posts nothing when either Vault secret is missing, and the tick still
-- records 'succeeded' for having done so.
--
-- This stack has no secrets at all, so false is the correct answer here and
-- is asserted rather than merely allowed. It is also the state a live
-- project is in until the deploy step creates the two secrets by hand,
-- which is why it is worth a test: it is the ordinary deploy day failure,
-- not an exotic one.
select has_column('public', 'scheduler_health', 'scheduler_configured',
  'scheduler health reports whether the pipeline is configured at all');
select is(
  (select bool_or(scheduler_configured) from public.scheduler_health),
  false,
  'with no vault secrets it reads false, so a dead pipeline cannot report green'
);

-- The one positive privilege assertion in this file, and the load bearing
-- one. Every other check here is negative, so a future migration that
-- recreated the view without its grant, or that dropped security_invoker,
-- would leave the suite green while the view became unreadable by the only
-- role meant to read it. Reading it as service_role is not obvious either:
-- service_role has select on the cron tables but no usage on schema cron,
-- so it cannot reach cron.job by name at all, and this succeeds only
-- because a view stores resolved OIDs and never re-does that name lookup.
set local role service_role;
select lives_ok(
  $$ select * from public.scheduler_health $$,
  'service_role, the only role granted it, can actually read scheduler health'
);
reset role;

-- The safety net, actually exercised. The lives_ok above runs it on an
-- empty database, which would pass even if it enqueued nothing at all, so
-- this gives it real rows to work on.
--
-- Worth knowing before reading the counts: inserting a daily_metrics row
-- fires daily_metrics_enqueue_baselines_insert, so the two pending jobs
-- below already exist before the reconciliation is ever called. That is
-- the normal path working, not a flaw in the test. What is being proved
-- here is that the reconciliation agrees with it rather than duplicating
-- it: three day rows across two people collapse to one pending job each,
-- because jobs_one_pending plus the on conflict do nothing in enqueue_job
-- refuse a second. The return value counts people considered, never rows
-- inserted, so it stays 2 whether or not anything new was written.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local');

-- service_role writes day rows, not authenticated: the client's write on
-- daily_metrics is revoked (see daily_metrics_read_only.sql).
set local role service_role;
insert into public.daily_metrics (user_id, day, steps) values
  ('00000000-0000-0000-0000-0000000000c1', '2026-09-14', 1000),
  ('00000000-0000-0000-0000-0000000000c1', '2026-09-15', 2000),
  ('00000000-0000-0000-0000-0000000000c2', '2026-09-14', 3000);
reset role;

select is((select count(*)::int from public.jobs where status = 'pending' and kind = 'baselines'), 2,
  'the insert trigger alone already queued one pending job per person');

select is(public.enqueue_baselines_reconciliation(), 2,
  'the reconciliation considers both people who have day rows');
select is((select count(*)::int from public.jobs where status = 'pending' and kind = 'baselines'), 2,
  'it leaves exactly one pending job per person, not one per day row');

-- Immediately again: the proof that on conflict do nothing makes this
-- safe to run twice, which is what a nightly safety net needs to be.
select is(public.enqueue_baselines_reconciliation(), 2,
  'running it a second time still considers both people');
select is((select count(*)::int from public.jobs where status = 'pending' and kind = 'baselines'), 2,
  'and still leaves exactly two pending jobs, so it is idempotent');

-- The standing start, and the only part of this file that proves the
-- function enqueues anything at all. Everything above stays green even if
-- the perform public.enqueue_job(...) line is deleted from the function
-- body: the insert trigger already queued both jobs, and the return value
-- comes from a separate select count(distinct user_id) statement that does
-- not depend on the enqueue at all. So the assertions above prove the
-- function agrees with the trigger and is idempotent, and nothing more.
--
-- This is the state the nightly safety net actually exists for, and the one
-- inserting rows can never reach: a person with day rows and no job
-- waiting, left behind by a job that exhausted its attempts, a row written
-- before the trigger existed, or a restore.
delete from public.jobs;
select is((select count(*)::int from public.jobs where status = 'pending' and kind = 'baselines'), 0,
  'the queue is empty, so what follows cannot pass on jobs the trigger left behind');
select is(public.enqueue_baselines_reconciliation(), 2,
  'the reconciliation considers both people from a standing start');
select is((select count(*)::int from public.jobs where status = 'pending' and kind = 'baselines'), 2,
  'and queues a pending baselines job for each of them out of nothing');

select * from finish();
rollback;

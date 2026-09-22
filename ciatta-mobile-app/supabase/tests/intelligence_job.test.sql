begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

select has_function('public', 'claim_intelligence_job', 'claim_intelligence_job exists');
select has_function('public', 'complete_intelligence_job', 'complete_intelligence_job exists');
select has_function('public', 'fail_intelligence_job', 'fail_intelligence_job exists');
select has_function('public', 'intelligence_tick', 'intelligence_tick exists');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- The queue now knows a second kind of work, and still refuses any other.
select lives_ok(
  $$ insert into public.jobs (user_id, kind) values ('00000000-0000-0000-0000-00000000000b', 'intelligence') $$,
  'a job of kind intelligence can be queued'
);
select throws_ok(
  $$ insert into public.jobs (user_id, kind) values ('00000000-0000-0000-0000-00000000000b', 'other') $$,
  '23514',
  null,
  'a kind outside the list is refused'
);
delete from public.jobs where user_id = '00000000-0000-0000-0000-00000000000b';

-- One pending intelligence job per person, however many times it is asked for.
select public.enqueue_job('00000000-0000-0000-0000-00000000000a', 'intelligence');
select public.enqueue_job('00000000-0000-0000-0000-00000000000a', 'intelligence');
select is((select count(*)::int from public.jobs
             where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'intelligence' and status = 'pending'), 1,
  'asking twice leaves one pending intelligence job');
delete from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a';

-- The chain: finishing a baselines job queues the reasoning that reads what
-- it wrote. Exercised as service_role, the role that actually calls it from
-- the edge function, so that the grant on enqueue_job is proved rather than
-- assumed.
insert into public.jobs (id, user_id, kind, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'baselines', 'running');
set local role service_role;
select public.complete_baselines_job('00000000-0000-0000-0000-0000000000f1');
reset role;
select is((select status from public.jobs where id = '00000000-0000-0000-0000-0000000000f1'), 'done',
  'the baselines job is done');
select is((select count(*)::int from public.jobs
             where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'intelligence' and status = 'pending'), 1,
  'and one intelligence job now waits for the same person');

-- Claiming picks up intelligence work only, never a baselines job that
-- happens to be older.
insert into public.jobs (user_id, kind, status, created_at) values
  ('00000000-0000-0000-0000-00000000000b', 'baselines', 'pending', now() - interval '1 hour');
set local role service_role;
create temporary table claimed as select * from public.claim_intelligence_job();
reset role;
select is((select count(*)::int from claimed), 1, 'one job is claimed');
select is((select kind from claimed), 'intelligence', 'and it is the intelligence job, not the older baselines one');
select is((select status from claimed), 'running', 'a claimed job is running');
select is((select user_id from claimed), '00000000-0000-0000-0000-00000000000a'::uuid, 'and it belongs to A');
select is((select count(*)::int from public.jobs where kind = 'baselines' and status = 'pending'), 1,
  'the baselines job is untouched');

-- Completing, and failing, mirror the baselines pair exactly.
set local role service_role;
select public.complete_intelligence_job((select id from claimed));
reset role;
select is((select status from public.jobs where id = (select id from claimed)), 'done',
  'complete marks it done');
select ok((select finished_at is not null from public.jobs where id = (select id from claimed)),
  'and stamps finished_at');

insert into public.jobs (id, user_id, kind, status, attempts) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', 'intelligence', 'running', 1);
set local role service_role;
select public.fail_intelligence_job('00000000-0000-0000-0000-0000000000f2', 'TypeError');
reset role;
select is((select status from public.jobs where id = '00000000-0000-0000-0000-0000000000f2'), 'pending',
  'a first failure goes back to pending');
select is((select last_error from public.jobs where id = '00000000-0000-0000-0000-0000000000f2'), 'TypeError',
  'with the error name kept');

-- A failure with a pending sibling is marked done rather than colliding
-- with jobs_one_pending, as 20260916100400 does for baselines.
insert into public.jobs (id, user_id, kind, status, attempts) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000000a', 'intelligence', 'running', 1);
set local role service_role;
select public.fail_intelligence_job('00000000-0000-0000-0000-0000000000f3', 'TypeError');
reset role;
select is((select status from public.jobs where id = '00000000-0000-0000-0000-0000000000f3'), 'done',
  'a failure beside a pending sibling is marked done');
select ok((select finished_at is not null from public.jobs where id = '00000000-0000-0000-0000-0000000000f3'),
  'and stamped, so cleanup can sweep it');

-- Server only, every one of them. Negative for the client roles, positive
-- for the one role that calls them.
select ok(not has_function_privilege('anon', 'public.claim_intelligence_job()', 'EXECUTE'),
  'anon cannot claim');
select ok(not has_function_privilege('authenticated', 'public.claim_intelligence_job()', 'EXECUTE'),
  'authenticated cannot claim');
select ok(not has_function_privilege('authenticated', 'public.complete_intelligence_job(uuid)', 'EXECUTE'),
  'authenticated cannot complete');
select ok(not has_function_privilege('authenticated', 'public.fail_intelligence_job(uuid, text)', 'EXECUTE'),
  'authenticated cannot fail a job');
select ok(not has_function_privilege('authenticated', 'public.intelligence_tick(integer)', 'EXECUTE'),
  'authenticated cannot tick');
select ok(has_function_privilege('service_role', 'public.enqueue_job(uuid, text)', 'EXECUTE'),
  'service_role can execute enqueue_job, because complete_baselines_job now needs it');

-- Scheduled, and without a key in the command.
select ok(
  exists (select 1 from cron.job where jobname = 'intelligence-drain'),
  'the intelligence drain is scheduled'
);
select ok(
  not exists (select 1 from cron.job where command ilike '%bearer%' or command ilike '%service_role%' or command ilike '%eyJ%'),
  'no cron command carries a key or a bearer token'
);

-- The health view reports the new drain and the new queue.
set local role service_role;
select ok(
  exists (select 1 from public.scheduler_health where jobname = 'intelligence-drain'),
  'scheduler_health reports the intelligence drain'
);
select has_column('public', 'scheduler_health', 'intelligence_pending_jobs',
  'scheduler_health counts pending intelligence jobs');
reset role;

select * from finish();
rollback;

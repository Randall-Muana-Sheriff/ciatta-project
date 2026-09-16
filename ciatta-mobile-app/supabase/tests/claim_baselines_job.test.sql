-- The baselines job queue's own atomic operations: claim, complete, fail
-- and cleanup. These exist only because PostgREST's Data API has no way to
-- express "claim the oldest pending job, skipping any another run already
-- has locked" as a single statement; see
-- 20260916100000_claim_baselines_job.sql. Its own file, not jobs.test.sql,
-- because it exercises the RPC surface rather than the table's RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@test.local'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@test.local');

-- Neither Data API role can call any of the four functions at all.
set local role anon;
select throws_ok($$ select public.claim_baselines_job() $$, '42501', null, 'anon cannot claim a job');
reset role;
set local role authenticated;
select throws_ok($$ select public.claim_baselines_job() $$, '42501', null, 'authenticated cannot claim a job either');
reset role;

insert into public.jobs (user_id, kind, status) values ('00000000-0000-0000-0000-0000000000c1', 'baselines', 'pending');

set local role service_role;

-- Claiming the one pending job returns it, running, with attempts bumped.
select is((select count(*)::int from public.claim_baselines_job()
  where user_id = '00000000-0000-0000-0000-0000000000c1' and status = 'running' and attempts = 1), 1,
  'claiming the pending job marks it running and bumps attempts');
select is((select status from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c1'), 'running',
  'the claimed job is running in the table too');

-- Nothing left to claim: zero rows, not one row of nulls.
select is((select count(*)::int from public.claim_baselines_job()), 0,
  'claiming again with nothing pending returns zero rows');

-- Completing it marks it done with a finished_at.
select public.complete_baselines_job((select id from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c1'));
select is((select status from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c1'), 'done',
  'completing the job marks it done');
select isnt((select finished_at from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c1'), null,
  'completing the job stamps finished_at');

-- A failure short of the third attempt goes back to pending.
insert into public.jobs (user_id, kind, status, attempts) values ('00000000-0000-0000-0000-0000000000c2', 'baselines', 'pending', 0);
select public.claim_baselines_job();
select public.fail_baselines_job((select id from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c2'), 'TypeError');
select is((select status from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c2'), 'pending',
  'a failure on the first attempt is requeued as pending');
select is((select last_error from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c2'), 'TypeError',
  'the error name is recorded');

-- Fix 2: claiming again clears the stale last_error, so a job that failed
-- once and then succeeds doesn't end up done with an old error attached.
select public.claim_baselines_job();
select is((select last_error from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c2'), null,
  'claiming again clears the stale last_error');

-- A failure on the third attempt fails for good.
update public.jobs set attempts = 2, status = 'pending' where user_id = '00000000-0000-0000-0000-0000000000c2';
select public.claim_baselines_job();
select is((select attempts from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c2'), 3,
  'the third claim bumps attempts to 3');
select public.fail_baselines_job((select id from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c2'), 'RangeError');
select is((select status from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c2'), 'failed',
  'a third failed attempt stops retrying');

-- Cleanup removes only done jobs older than 7 days.
insert into public.jobs (user_id, kind, status, finished_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'baselines', 'done', now() - interval '8 days'),
  ('00000000-0000-0000-0000-0000000000c1', 'baselines', 'done', now() - interval '1 day');
select public.cleanup_baselines_jobs();
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c1' and finished_at < now() - interval '7 days'), 0,
  'cleanup removes done jobs older than 7 days');
-- The already completed job from earlier in this test plus the one day
-- old job just inserted: both inside 7 days, both left alone.
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c1' and finished_at > now() - interval '7 days'), 2,
  'cleanup leaves recently finished jobs alone');

-- Fix 3: a crashed run must not leave a job stuck in 'running' forever.
-- A job less than 15 minutes into 'running' is left alone (it may still be
-- genuinely in progress); one stuck longer is treated as crashed and
-- reclaimed.
insert into public.jobs (user_id, kind, status, started_at, attempts)
  values ('00000000-0000-0000-0000-0000000000c3', 'baselines', 'running', now() - interval '5 minutes', 1);
select is((select count(*)::int from public.claim_baselines_job() where user_id = '00000000-0000-0000-0000-0000000000c3'), 0,
  'a running job less than 15 minutes old is left alone');

update public.jobs set started_at = now() - interval '16 minutes' where user_id = '00000000-0000-0000-0000-0000000000c3';
select is((select count(*)::int from public.claim_baselines_job()
  where user_id = '00000000-0000-0000-0000-0000000000c3' and status = 'running' and attempts = 2), 1,
  'a running job stuck for over 15 minutes is reclaimed, attempts bumped again');

-- Slice 2 review: a daily_metrics write that lands while a job is running
-- queues a second pending row for the same person and kind. Sending the
-- running job back to 'pending' on failure would then collide with the
-- jobs_one_pending index, and the edge function's error path would swallow
-- that and leave the job stuck 'running'. The pending sibling already
-- carries the work, so the failing job is marked done instead.
insert into public.jobs (user_id, kind, status, started_at, attempts)
  values ('00000000-0000-0000-0000-0000000000c4', 'baselines', 'running', now(), 1);
insert into public.jobs (user_id, kind, status)
  values ('00000000-0000-0000-0000-0000000000c4', 'baselines', 'pending');

select lives_ok($$
  select public.fail_baselines_job(
    (select id from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c4' and status = 'running'),
    'TypeError')
$$, 'failing a job whose sibling is already pending raises nothing');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c4' and status = 'running'), 0,
  'the failed job is not left stuck running');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c4' and status = 'done'), 1,
  'it is marked done, because the pending sibling carries the work');
select isnt((select finished_at from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c4' and status = 'done'), null,
  'and stamped finished_at, so cleanup can sweep it later');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-0000000000c4' and status = 'pending'), 1,
  'the pending sibling is left alone, still waiting to be claimed');

reset role;
select * from finish();
rollback;

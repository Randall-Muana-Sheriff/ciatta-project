-- The baselines job queue's own atomic operations: claim, complete, fail
-- and cleanup. These exist only because PostgREST's Data API has no way to
-- express "claim the oldest pending job, skipping any another run already
-- has locked" as a single statement; see
-- 20260916100000_claim_baselines_job.sql. Its own file, not jobs.test.sql,
-- because it exercises the RPC surface rather than the table's RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local');

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

reset role;
select * from finish();
rollback;

-- The server-only work queue. Writing a daily_metrics row queues a
-- 'baselines' recompute for that person; she never sees the queue itself.
-- Its own file (not isolation.test.sql) because it exercises a table with
-- no owner access at all, unlike the owner-RLS tables isolation.test.sql
-- otherwise attacks.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- daily_metrics is server written only (review fix, see
-- daily_metrics_read_only.sql): device data arrives through the
-- ingest-health edge function under service_role, so that is the role that
-- exercises the trigger here too, not authenticated.
set local role service_role;

-- Writing a day row queues exactly one pending baselines job for her.
select lives_ok($$
  insert into public.daily_metrics (user_id, day, steps) values ('00000000-0000-0000-0000-00000000000a', '2026-09-14', 8000)
$$, 'service_role logs a day for A');

reset role;
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'pending'), 1,
  'writing a day row queues exactly one pending job');
select is((select kind from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'pending'), 'baselines',
  'the queued job is a baselines job');

-- A second day row (or an update to the first) does not create a second
-- pending job: the partial unique index holds.
set local role service_role;
select lives_ok($$
  insert into public.daily_metrics (user_id, day, steps) values ('00000000-0000-0000-0000-00000000000a', '2026-09-15', 4000)
$$, 'service_role logs a second day for A');
select lives_ok($$
  update public.daily_metrics set steps = 9000 where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'
$$, 'service_role updates her first day');

reset role;
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'pending'), 1,
  'a second write does not create a second pending job');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'still just the one job row total');

-- A completed job does not block a new pending one.
update public.jobs set status = 'done', finished_at = now() where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'pending';

set local role service_role;
select lives_ok($$
  update public.daily_metrics set steps = 9500 where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'
$$, 'service_role updates her day again after the job finished');

reset role;
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'pending'), 1,
  'a new pending job is created once the old one is done');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a'), 2,
  'the done job and the new pending job both exist');

-- Review fix: the function must not feed itself. A write that only
-- touches temp_deviation (what the baselines function itself derives)
-- must not enqueue another run while one is already in flight; a genuine
-- new day still must.
set local role service_role;
select lives_ok($$
  insert into public.daily_metrics (user_id, day, steps) values ('00000000-0000-0000-0000-00000000000b', '2026-09-14', 100)
$$, 'service_role logs a day for B');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'pending'), 1,
  'B''s day queues exactly one pending job');

-- Simulate the baselines function holding that job (claim_baselines_job
-- marks it running, not done), the exact state the bug needed to loop.
select lives_ok($$
  update public.jobs set status = 'running', started_at = now()
  where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'pending'
$$, 'B''s job is claimed (simulated): running, not pending');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'pending'), 0,
  'no pending job while the one job is running');

select lives_ok($$
  update public.daily_metrics set temp_deviation = 0.3
  where user_id = '00000000-0000-0000-0000-00000000000b' and day = '2026-09-14'
$$, 'service_role writes B''s temp_deviation, as the baselines function would');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'pending'), 0,
  'writing temp_deviation alone leaves zero pending jobs behind, even with a run already in flight');

select lives_ok($$
  insert into public.daily_metrics (user_id, day, steps) values ('00000000-0000-0000-0000-00000000000b', '2026-09-15', 200)
$$, 'service_role logs a genuine new day for B');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'pending'), 1,
  'a genuine new day still enqueues one pending job');

-- Clear B's jobs before the later block below inserts one directly for
-- her: the unique partial index (rightly) refuses a second pending job.
update public.jobs set status = 'done', finished_at = now()
  where user_id = '00000000-0000-0000-0000-00000000000b' and status in ('pending', 'running');

-- She never sees the queue: no select, insert or update, even on her own would-be row.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$ select count(*)::int from public.jobs $$, '42501', null, 'A cannot select jobs');
select throws_ok($$
  insert into public.jobs (user_id, kind) values ('00000000-0000-0000-0000-00000000000a', 'baselines')
$$, '42501', null, 'A cannot insert a job');
select throws_ok($$
  update public.jobs set status = 'failed' where user_id = '00000000-0000-0000-0000-00000000000a'
$$, '42501', null, 'A cannot update a job');

-- anon has no grant at all either.
reset role;
set local role anon;
select throws_ok($$ select count(*)::int from public.jobs $$, '42501', null, 'anon cannot read jobs');

-- service_role, the only caller with any access, can select, insert and update.
reset role;
set local role service_role;
select lives_ok($$ select count(*)::int from public.jobs $$, 'service_role can select jobs');
select lives_ok($$
  insert into public.jobs (user_id, kind) values ('00000000-0000-0000-0000-00000000000b', 'baselines')
$$, 'service_role can insert a job directly');
select lives_ok($$
  update public.jobs set status = 'running', started_at = now()
  where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'baselines'
$$, 'service_role can update a job');

reset role;

-- Deleting the auth user removes her jobs.
select lives_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'deleting the account succeeds');
select is((select count(*)::int from public.jobs where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'deleting the account deletes her jobs');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

-- Four running jobs of hers: one the worker keeps dying on, one that has
-- only stumbled twice, one picked up many times but still inside its
-- fifteen minutes, and an intelligence job in the same silent loop.
insert into public.jobs (id, user_id, kind, status, attempts, started_at, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'baselines', 'running', 5, now() - interval '20 minutes', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', 'baselines', 'running', 2, now() - interval '20 minutes', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000000a', 'baselines', 'running', 9, now() - interval '1 minute', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000000a', 'intelligence', 'running', 7, now() - interval '20 minutes', now() - interval '3 days');

set local role service_role;
create temporary table claimed as select * from public.claim_baselines_job();
reset role;

select is((select status from public.jobs where id = '00000000-0000-0000-0000-0000000000f1'), 'failed',
  'a stale job picked up five times is closed, not claimed again');
select is((select last_error from public.jobs where id = '00000000-0000-0000-0000-0000000000f1'), 'Abandoned',
  'with the reason that it was abandoned');
select ok((select finished_at is not null from public.jobs where id = '00000000-0000-0000-0000-0000000000f1'),
  'and stamped, so cleanup can sweep it');
select is((select count(*)::int from claimed), 1, 'one job is claimed');
select is((select id from claimed), '00000000-0000-0000-0000-0000000000f2'::uuid,
  'and it is the one that has only stumbled twice');
select is((select attempts from public.jobs where id = '00000000-0000-0000-0000-0000000000f2'), 3,
  'its attempts move on by one');
select is((select status from public.jobs where id = '00000000-0000-0000-0000-0000000000f3'), 'running',
  'a job still inside its fifteen minutes is left alone however often it was picked up');
select is((select status from public.jobs where id = '00000000-0000-0000-0000-0000000000f4'), 'running',
  'claiming baselines work does not touch intelligence work');

set local role service_role;
create temporary table claimed_intelligence as select * from public.claim_intelligence_job();
reset role;
select is((select count(*)::int from claimed_intelligence), 0, 'the silent intelligence job is not claimed again');
select is((select status from public.jobs where id = '00000000-0000-0000-0000-0000000000f4'), 'failed',
  'it is closed instead');

select ok(not has_function_privilege('authenticated', 'public.claim_baselines_job()', 'EXECUTE'),
  'and claiming is still the server''s alone');

select * from finish();
rollback;

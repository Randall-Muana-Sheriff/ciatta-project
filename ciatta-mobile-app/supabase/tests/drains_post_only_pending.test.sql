begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Secrets exist for the length of this transaction only, so the ticks
-- reach the point where they would post.
select vault.create_secret('http://127.0.0.1:54321', 'project_url');
select vault.create_secret('test-service-key', 'service_role_key');

select is(public.baselines_tick(10), 0, 'an empty queue is an empty tick');
select is(public.intelligence_tick(10), 0, 'for both drains');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

-- Two baselines jobs waiting, one intelligence job just claimed and still
-- inside its fifteen minutes, one intelligence job stale.
insert into public.jobs (id, user_id, kind, status, attempts, started_at, created_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'baselines', 'pending', 0, null, now() - interval '2 minutes'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a', 'baselines', 'running', 1, now() - interval '20 minutes', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000a', 'intelligence', 'running', 1, now() - interval '1 minute', now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000000a', 'intelligence', 'running', 3, now() - interval '30 minutes', now() - interval '2 hours');

select is(public.baselines_tick(10), 2, 'a tick posts once for each job its function could claim: the pending one and the stale one');
select is(public.baselines_tick(1), 1, 'and never more than its batch');
select is(public.intelligence_tick(10), 1, 'a job still inside its fifteen minutes is not waiting; the stale one is');

-- The posts really went out, as many as were reported.
select is((select count(*)::int from net.http_request_queue), 4, 'every post fired was queued');

update public.jobs set status = 'done', finished_at = now() where kind = 'baselines';
select is(public.baselines_tick(10), 0, 'once the queue is drained the tick posts nothing');

-- Unchanged: a tick with no secrets reports 0 and posts nothing, so a dead
-- pipeline cannot look busy.
delete from vault.secrets where name in ('project_url', 'service_role_key');
insert into public.jobs (id, user_id, kind, status, attempts, created_at) values
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-00000000000a', 'baselines', 'pending', 0, now());
select is(public.baselines_tick(10), 0, 'without secrets nothing is posted, however much is waiting');
select is((select count(*)::int from net.http_request_queue), 4, 'and the queue did not grow');

select * from finish();
rollback;

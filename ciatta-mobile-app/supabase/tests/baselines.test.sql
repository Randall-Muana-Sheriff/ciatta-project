begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Only the server writes these tables. Seed as postgres (bypasses RLS,
-- has the table owner's full privileges), the way the baselines/changes
-- job will once it exists.
select lives_ok($$
  insert into public.baselines (user_id, metric, window_days, median, low, high, variability, n, sufficient)
  values ('00000000-0000-0000-0000-00000000000a', 'sleep_hours', 28, 7.5, 6.5, 8.5, 0.6, 28, true)
$$, 'postgres inserts a baseline for A');

select lives_ok($$
  insert into public.changes (user_id, metric, from_value, to_value, window_days, deviation, direction, quality, detected_on)
  values ('00000000-0000-0000-0000-00000000000a', 'sleep_hours', 7.5, 6.1, 28, 1.4, 'lower', 'ok', '2026-09-14')
$$, 'postgres inserts a change for A');

-- A baseline with too little history is sufficient false and never carries
-- a fabricated number.
select throws_ok($$
  insert into public.baselines (user_id, metric, window_days, sufficient, median)
  values ('00000000-0000-0000-0000-00000000000a', 'steps', 7, false, 8000)
$$, '23514', null, 'an insufficient baseline cannot carry a median');
select throws_ok($$
  insert into public.baselines (user_id, metric, window_days, sufficient)
  values ('00000000-0000-0000-0000-00000000000a', 'steps', 7, true)
$$, '23514', null, 'a sufficient baseline must carry a median');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.baselines), 1, 'A can read her own baseline');
select is((select sufficient from public.baselines where metric = 'sleep_hours'), true, 'A sees her baseline is sufficient');
select is((select count(*)::int from public.changes), 1, 'A can read her own change');
select is((select direction from public.changes where metric = 'sleep_hours'), 'lower', 'A sees her change''s direction');

select throws_ok($$
  insert into public.baselines (user_id, metric, window_days, sufficient)
  values ('00000000-0000-0000-0000-00000000000a', 'hrv', 28, false)
$$, '42501', null, 'A cannot insert a baseline');
select throws_ok($$
  update public.baselines set sufficient = false where metric = 'sleep_hours'
$$, '42501', null, 'A cannot update a baseline');
select throws_ok($$
  delete from public.baselines where metric = 'sleep_hours'
$$, '42501', null, 'A cannot delete a baseline');

select throws_ok($$
  insert into public.changes (user_id, metric, window_days, direction, quality, detected_on)
  values ('00000000-0000-0000-0000-00000000000a', 'hrv', 28, 'higher', 'ok', '2026-09-15')
$$, '42501', null, 'A cannot insert a change');
select throws_ok($$
  update public.changes set quality = 'low' where metric = 'sleep_hours'
$$, '42501', null, 'A cannot update a change');
select throws_ok($$
  delete from public.changes where metric = 'sleep_hours'
$$, '42501', null, 'A cannot delete a change');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.baselines), 0, 'B sees none of A''s baselines');
select is((select count(*)::int from public.changes), 0, 'B sees none of A''s changes');

reset role;
set local role anon;
select throws_ok($$ select count(*)::int from public.baselines $$, '42501', null, 'anon cannot read baselines');
select throws_ok($$ select count(*)::int from public.changes $$, '42501', null, 'anon cannot read changes');

reset role;
select lives_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'deleting the account succeeds');
select is(
  (select count(*)::int from public.baselines where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.changes where user_id = '00000000-0000-0000-0000-00000000000a'),
  0, 'deleting the account cascades her baselines and changes');

select * from finish();
rollback;

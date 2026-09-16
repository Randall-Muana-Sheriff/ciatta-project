begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Review fix: daily_metrics used to grant authenticated insert and update
-- (from enable_owner_rls, like every earlier table), so the client could
-- write temp_deviation -- a column the baselines function derives from her
-- own baseline -- or overwrite a measured column device sync owns. Nothing
-- in the app writes this table today: device data arrives through the
-- ingest-health edge function under service_role. Seed as postgres
-- (bypasses RLS, has the table owner's full privileges), the way that
-- function will, mirroring how baselines.test.sql seeds baselines/changes.
select lives_ok($$
  insert into public.daily_metrics (user_id, day, sleep_hours, steps)
  values ('00000000-0000-0000-0000-00000000000a', '2026-09-14', 7.5, 8000)
$$, 'postgres logs a day for A');

-- Re-inserting the same (user_id, day) updates rather than duplicating.
insert into public.daily_metrics (user_id, day, sleep_hours, steps)
values ('00000000-0000-0000-0000-00000000000a', '2026-09-14', 6.25, 9000)
on conflict (user_id, day) do update set sleep_hours = excluded.sleep_hours, steps = excluded.steps;
select is((select count(*)::int from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'saving the same day twice keeps one row');
select is((select sleep_hours from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a'), 6.25,
  'the second save overwrote the first');

-- A day with only steps leaves every other measured column null.
select lives_ok($$
  insert into public.daily_metrics (user_id, day, steps)
  values ('00000000-0000-0000-0000-00000000000a', '2026-09-15', 4200)
$$, 'postgres logs a day with only steps');
select is(
  (select row(sleep_hours, stage_awake, stage_rem, stage_light, stage_deep, time_in_bed, active_minutes,
              resting_hr, hrv, temp_deviation, energy, mood, stress, caffeine, alcohol, note)
   from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-15'),
  row(null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric,
      null::numeric, null::numeric, null::numeric, null::smallint, null::smallint, null::smallint,
      null::numeric, null::numeric, null::text),
  'every other measured column stays null');

-- Review fix: workouts, foods and digestion have no default any more, so a
-- day written with only steps leaves them null (unknown), not an empty list
-- (which would fabricate "checked, found nothing").
select is((select workouts from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-15'), null::jsonb,
  'a day with only steps leaves workouts null, not an empty list');
select is((select foods from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-15'), null::text[],
  'a day with only steps leaves foods null, not an empty list');
select is((select digestion from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-15'), null::text[],
  'a day with only steps leaves digestion null, not an empty list');

-- An explicit empty list is a fact ("checked, found nothing") and must be
-- stored and read back as such, distinct from null ("not checked").
select lives_ok($$
  insert into public.daily_metrics (user_id, day, steps, workouts, foods, digestion)
  values ('00000000-0000-0000-0000-00000000000a', '2026-09-16', 100, '[]'::jsonb, '{}'::text[], '{}'::text[])
$$, 'postgres logs a day with explicit empty lists');
select is((select workouts from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-16'), '[]'::jsonb,
  'an explicit empty workouts list is stored as empty, not null');
select is((select foods from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-16'), '{}'::text[],
  'an explicit empty foods list is stored as empty, not null');
select is((select digestion from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-16'), '{}'::text[],
  'an explicit empty digestion list is stored as empty, not null');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- She still reads her own rows: the "owner select" policy is untouched.
select is((select count(*)::int from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a'), 3,
  'A can read her own daily metrics');

-- Review fix: A can no longer write daily_metrics at all. Nothing in the
-- app writes this table client side, so there is no feature to preserve
-- here, only a privilege to close.
select throws_ok($$
  insert into public.daily_metrics (user_id, day, steps)
  values ('00000000-0000-0000-0000-00000000000a', '2026-09-17', 100)
$$, '42501', null, 'A cannot insert a daily metrics row');
select throws_ok($$
  update public.daily_metrics set steps = 1 where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'
$$, '42501', null, 'A cannot update her own daily metrics row');
select throws_ok($$
  delete from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'
$$, '42501', null, 'A cannot delete her own daily metrics row');

-- B cannot see A's rows.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.daily_metrics), 0, 'B sees zero rows');

reset role;
select is((select steps from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'), 9000,
  'A''s blocked update left her row unchanged');
select is((select count(*)::int from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'), 1,
  'A''s blocked delete left her row in place');

-- anon has no grant at all.
set local role anon;
select throws_ok($$ select count(*)::int from public.daily_metrics $$, '42501', null, 'anon cannot read daily metrics');

reset role;

-- service_role (ingest-health, and later the baselines function for
-- temp_deviation) still has full access.
set local role service_role;
select lives_ok($$
  insert into public.daily_metrics (user_id, day, steps) values ('00000000-0000-0000-0000-00000000000a', '2026-09-18', 500)
$$, 'service_role can insert a daily metrics row');
select lives_ok($$
  update public.daily_metrics set steps = 600 where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-18'
$$, 'service_role can update a daily metrics row');
select lives_ok($$
  delete from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-18'
$$, 'service_role can delete a daily metrics row');

reset role;

-- Deleting the auth user removes her rows.
select lives_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'deleting the account succeeds');
select is((select count(*)::int from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'deleting the account deletes her daily metrics');

select * from finish();
rollback;

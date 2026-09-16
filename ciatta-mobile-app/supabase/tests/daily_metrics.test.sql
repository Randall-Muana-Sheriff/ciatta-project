begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.daily_metrics (user_id, day, sleep_hours, steps)
  values ('00000000-0000-0000-0000-00000000000a', '2026-09-14', 7.5, 8000)
$$, 'A logs a day');

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
$$, 'A logs a day with only steps');
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
$$, 'A logs a day with explicit empty lists');
select is((select workouts from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-16'), '[]'::jsonb,
  'an explicit empty workouts list is stored as empty, not null');
select is((select foods from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-16'), '{}'::text[],
  'an explicit empty foods list is stored as empty, not null');
select is((select digestion from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-16'), '{}'::text[],
  'an explicit empty digestion list is stored as empty, not null');

-- B cannot see A's rows.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.daily_metrics), 0, 'B sees zero rows');

-- B cannot update or delete A's row: the write affects zero rows.
update public.daily_metrics set steps = 1 where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14';
delete from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14';

reset role;
select is((select steps from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'), 9000,
  'B updating A''s row affects zero rows');
select is((select count(*)::int from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-14'), 1,
  'B deleting A''s row affects zero rows');

-- anon has no grant at all.
set local role anon;
select throws_ok($$ select count(*)::int from public.daily_metrics $$, '42501', null, 'anon cannot read daily metrics');

reset role;

-- Deleting the auth user removes her rows.
select lives_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'deleting the account succeeds');
select is((select count(*)::int from public.daily_metrics where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'deleting the account deletes her daily metrics');

select * from finish();
rollback;

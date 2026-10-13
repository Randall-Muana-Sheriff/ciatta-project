begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- A day the device already wrote, as the ingest function would.
insert into public.daily_metrics (user_id, day, steps, sleep_hours)
values ('00000000-0000-0000-0000-00000000000a', '2026-10-12', 8000, 7.5);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$ select public.save_daily_log('2026-10-12', p_digestion => array['Bloating'], p_caffeine => 2) $$,
  'she can save her day');
select is((select steps from public.daily_metrics where day = '2026-10-12'), 8000, 'device columns are untouched');
select is((select digestion from public.daily_metrics where day = '2026-10-12'), array['Bloating'], 'her flags are kept');

select public.save_daily_log('2026-10-12', p_digestion => array['Gas', 'Bloating']);
select is((select array_length(digestion, 1) from public.daily_metrics where day = '2026-10-12'), 2,
  'a second save merges flags without repeating one');
select is((select caffeine from public.daily_metrics where day = '2026-10-12'), 2::numeric,
  'a field not sent is left as it was');

select public.save_daily_log('2026-10-12', p_note => 'first');
select public.save_daily_log('2026-10-12', p_note => 'second');
select is((select note from public.daily_metrics where day = '2026-10-12'), E'first\nsecond', 'notes append');

select lives_ok($$ select public.save_daily_log('2026-10-13', p_mood => 4::smallint) $$, 'a day with no device row is created');
select is((select provenance::text from public.daily_metrics where day = '2026-10-13'), 'REPORTED', 'and is marked as hers');

-- B cannot reach A's day: the function writes only the caller's row.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select public.save_daily_log('2026-10-12', p_caffeine => 9);
reset role;
select is((select caffeine from public.daily_metrics
           where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-10-12'), 2::numeric,
  'another person saving the same date never writes her row');

select * from finish();
rollback;

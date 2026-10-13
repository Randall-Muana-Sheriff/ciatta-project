begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
select is((select mood from public.daily_metrics where day = '2026-10-13'), 4::smallint, 'and holds what she logged');

-- Order is kept: her earlier flags first, then the new ones in the order
-- she gave them, each once.
select public.save_daily_log('2026-10-14', p_digestion => array['Reflux', 'Bloating']);
select public.save_daily_log('2026-10-14', p_digestion => array['Gas', 'Bloating', 'Nausea']);
select is((select digestion from public.daily_metrics where day = '2026-10-14'), array['Reflux', 'Bloating', 'Gas', 'Nausea'],
  'flags keep the order she logged them in');

-- Files are appended to the day, never replacing the ones before.
select public.save_daily_log('2026-10-14', p_attachments => '[{"id":"f1","kind":"photo"}]'::jsonb);
select public.save_daily_log('2026-10-14', p_attachments => '[{"id":"f2","kind":"document"}]'::jsonb);
select is((select jsonb_array_length(metadata->'attachments') from public.daily_metrics where day = '2026-10-14'), 2,
  'files are appended');
select is((select metadata->'attachments'->0->>'id' from public.daily_metrics where day = '2026-10-14'), 'f1',
  'the first file stays first');

-- B cannot reach A's day: the function writes only the caller's row.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select public.save_daily_log('2026-10-12', p_caffeine => 9);
reset role;
select is((select caffeine from public.daily_metrics
           where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-10-12'), 2::numeric,
  'another person saving the same date never writes her row');

-- A day far in the future, a date from before records, or files that are
-- not a list are refused rather than stored.
select throws_ok($$ select public.save_daily_log((current_date + 30)::date, p_caffeine => 1) $$, '22023', null,
  'a day in the future is refused');
select throws_ok($$ select public.save_daily_log('1850-01-01', p_caffeine => 1) $$, '22023', null,
  'a day before any record is refused');
select throws_ok($$ select public.save_daily_log('2026-10-14', p_attachments => '{"not":"a list"}'::jsonb) $$, '22023', null,
  'files must be a list');

-- Signed out, nothing is written.
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok($$ select public.save_daily_log('2026-10-12', p_caffeine => 1) $$, '42501', null,
  'a caller with no user is refused');
reset role;
set local role anon;
select throws_ok($$ select public.save_daily_log('2026-10-12', p_caffeine => 1) $$, '42501', null,
  'the anonymous role cannot call it at all');
reset role;

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Two cuff readings on one evening in New York, one the next morning, and
-- two blood oxygen fractions. 02:00 UTC on the 13th is still the 12th there.
insert into public.observations (user_id, domain, metric, value, unit, occurred_at, provenance, dedupe_key) values
  ('00000000-0000-0000-0000-00000000000a', 'vitals', 'blood_pressure_systolic', 120, 'mmHg', '2026-10-12T22:00:00Z', 'MEASURED', 's1'),
  ('00000000-0000-0000-0000-00000000000a', 'vitals', 'blood_pressure_systolic', 130, 'mmHg', '2026-10-13T02:00:00Z', 'MEASURED', 's2'),
  ('00000000-0000-0000-0000-00000000000a', 'vitals', 'blood_pressure_systolic', 118, 'mmHg', '2026-10-13T14:00:00Z', 'MEASURED', 's3'),
  ('00000000-0000-0000-0000-00000000000a', 'vitals', 'oxygen_saturation', 0.97, '%', '2026-10-12T15:00:00Z', 'MEASURED', 'o1'),
  ('00000000-0000-0000-0000-00000000000a', 'vitals', 'oxygen_saturation', 0.93, '%', '2026-10-12T16:00:00Z', 'MEASURED', 'o2'),
  ('00000000-0000-0000-0000-00000000000a', 'vitals', 'heart_rate', 61, 'bpm', '2026-10-12T16:00:00Z', 'MEASURED', 'h1'),
  ('00000000-0000-0000-0000-00000000000b', 'vitals', 'blood_pressure_systolic', 150, 'mmHg', '2026-10-12T22:00:00Z', 'MEASURED', 'b1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select avg_value from public.vital_days('2026-10-01', 'America/New_York') where metric = 'blood_pressure_systolic' and day = '2026-10-12'),
  125::numeric, 'readings are grouped by her own calendar day and averaged');
select is((select n from public.vital_days('2026-10-01', 'America/New_York') where metric = 'blood_pressure_systolic' and day = '2026-10-12'),
  2, 'and counted');
select is((select avg_value from public.vital_days('2026-10-01', 'America/New_York') where metric = 'oxygen_saturation'),
  95::numeric, 'blood oxygen comes back as a percent, not a fraction');
select is((select min_value from public.vital_days('2026-10-01', 'America/New_York') where metric = 'oxygen_saturation'),
  93::numeric, 'with the day''s lowest reading');
select is((select count(*)::int from public.vital_days('2026-10-01', 'America/New_York') where metric = 'heart_rate'),
  0, 'only blood pressure and blood oxygen are returned');
select is((select count(*)::int from public.vital_days('2026-10-13', 'America/New_York')),
  1, 'days before the start are left out');
select is((select max(avg_value) from public.vital_days('2026-10-01', 'UTC') where metric = 'blood_pressure_systolic'),
  124::numeric, 'only her own readings: another person''s are never averaged in');
select throws_ok($$ select * from public.vital_days('2026-10-01', 'Not/A_Zone') $$, '22023', null, 'a time zone that does not exist is refused');

reset role;
set local role anon;
select throws_ok($$ select * from public.vital_days('2026-10-01', 'UTC') $$, '42501', null, 'signed out callers cannot read anything');

select * from finish();
rollback;

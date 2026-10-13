begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.results (user_id, test_name, value, unit, reference_low, reference_high, reference_text, flag, status, source, occurred_at)
  values ('00000000-0000-0000-0000-00000000000a', 'Ferritin', 12, 'ng/mL', 15, 150, '15 to 150', 'L', 'final', 'report', '2026-10-01')
$$, 'she saves a lab read from a report, with the lab''s range and flag');
select is((select flag from public.results where test_name = 'Ferritin'), 'L', 'the flag is kept as the lab sent it');
select throws_ok($$
  insert into public.results (user_id, test_name, value, flag, source, occurred_at)
  values ('00000000-0000-0000-0000-00000000000a', 'TSH', 2, 'Y', 'report', '2026-10-01')
$$, '23514', null, 'a flag that is not an HL7 interpretation code is refused');
select throws_ok($$
  insert into public.results (user_id, test_name, value, source, occurred_at)
  values ('00000000-0000-0000-0000-00000000000a', 'TSH', 2, 'typed', '2026-10-01')
$$, '23514', null, 'labs come from a provider or a report, nothing else');
select is((select source from public.results where test_name = 'Ferritin'), 'report', 'where it came from is kept');

-- A provider's result is updated on a re sync rather than duplicated.
reset role;
insert into public.results (user_id, test_name, value, unit, source, source_ref, occurred_at)
values ('00000000-0000-0000-0000-00000000000a', 'Hemoglobin', 12.1, 'g/dL', 'provider', 'c1:Observation/9', '2026-09-01');
select throws_ok($$
  insert into public.results (user_id, test_name, value, unit, source, source_ref, occurred_at)
  values ('00000000-0000-0000-0000-00000000000a', 'Hemoglobin', 12.4, 'g/dL', 'provider', 'c1:Observation/9', '2026-09-01')
$$, '23505', null, 'the same provider result cannot be stored twice');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(public.claim_lab_scan(), true, 'her first report scan of the day is allowed');
select is((select count(*)::int from (select public.claim_lab_scan() from generate_series(1, 19)) s), 19, 'and the next 19 run');
select is(public.claim_lab_scan(), false, 'the 21st is refused');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.results), 0, 'nobody else sees her labs');
select is(public.claim_lab_scan(), true, 'another person has her own allowance');

select * from finish();
rollback;

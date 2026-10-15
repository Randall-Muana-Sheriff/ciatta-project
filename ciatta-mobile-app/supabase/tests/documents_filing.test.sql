begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d4', 'd4@test.local'),
  ('00000000-0000-0000-0000-0000000000e4', 'e4@test.local');
insert into public.medications (id, user_id, name, provenance) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d4', 'Ibuprofen', 'REPORTED');
insert into public.conditions (id, user_id, name, kind, provenance) values
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d4', 'Iron deficiency anemia', 'condition', 'REPORTED');
update public.profiles set onboarding = jsonb_build_object('details', jsonb_build_object('conditions', jsonb_build_array('Iron deficiency anemia'), 'medications', jsonb_build_array('Ibuprofen')))
  where id = '00000000-0000-0000-0000-0000000000d4';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
create temp table saved (id uuid) on commit drop;
grant all on saved to authenticated;

select lives_ok($$
  insert into saved select public.save_document('visit', 'After Visit Summary', '2026-09-02',
    '00000000-0000-0000-0000-0000000000d4/documents/v1.pdf', '{"checksum":"v1"}'::jsonb,
    '{"conditions":[{"name":"Endometriosis","status":"active"}],
      "allergies":[{"name":"Penicillin","reaction":"Hives"}],
      "medications":[{"name":"Ferrous sulfate","dose":"325 mg, once daily","started_on":"2026-09-02","stopped_on":null,"route":"oral","prescriber":null}],
      "stop_medications":[{"id":"50000000-0000-0000-0000-000000000001"}],
      "procedures":[{"name":"Pelvic ultrasound","performed_on":"2026-09-02"}],
      "referrals":[{"specialty":"Gynecology","clinician":"Dr Chen","reason":"Laparoscopy","referred_by":"Dr Rivera","referred_on":"2026-09-02"}],
      "linked":[{"table":"conditions","id":"50000000-0000-0000-0000-000000000002"},{"table":"medications","id":"50000000-0000-0000-0000-000000000001"}]}'::jsonb,
    '{"provider":"Aetna","plan":"Choice POS II","member_id":"W123"}'::jsonb)
$$, 'she can save a visit summary and file what it says');

select is((select status from public.conditions where name = 'Endometriosis'), 'active', 'a new diagnosis is filed as active');
select is((select kind::text from public.conditions where name = 'Penicillin'), 'allergy', 'an allergy is filed as an allergy');
select is((select stopped_on from public.medications where id = '50000000-0000-0000-0000-000000000001'), '2026-09-02'::date, 'the medication the document stopped is marked stopped');
select is((select provenance::text from public.medications where name = 'Ferrous sulfate'), 'DOCUMENT', 'filed rows say they came from a document');
select is((select count(*)::int from public.procedures where name = 'Pelvic ultrasound'), 1, 'the procedure is filed');
select is((select steps->>'referred' from public.referrals where specialty = 'Gynecology'), '2026-09-02', 'the referral is filed with the day it was made');
select is((select insurance->>'provider' from public.profiles where id = '00000000-0000-0000-0000-0000000000d4'), 'Aetna', 'the insurance card becomes her plan');
select ok((select onboarding->'details'->'medications' ? 'Ferrous sulfate' from public.profiles where id = '00000000-0000-0000-0000-0000000000d4'),
  'the medication shows in her Health Details list too');

select throws_ok($$
  select public.save_document('visit', 'X', '2026-09-02', '00000000-0000-0000-0000-0000000000d4/documents/v2.pdf', '{}'::jsonb,
    '{"conditions":[{"name":"Ok","status":"active"}],"procedures":[{"name":"","performed_on":"2026-09-02"}]}'::jsonb, null)
$$, '23514', null, 'one invalid item refuses the whole document');
select is((select count(*)::int from public.conditions where name = 'Ok'), 0, 'and nothing of it was filed');

select throws_ok($$
  select public.save_document('visit', 'X', '2026-09-02', '00000000-0000-0000-0000-0000000000e4/documents/v3.pdf', '{}'::jsonb, '{}'::jsonb, null)
$$, '42501', null, 'a file outside her own folder is refused');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}';
select is(public.remove_document((select id from saved)), null, 'someone else cannot remove her document');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
select public.remove_document((select id from saved));
select is(
  (select count(*)::int from public.conditions where name in ('Endometriosis', 'Penicillin'))
  + (select count(*)::int from public.medications where name = 'Ferrous sulfate')
  + (select count(*)::int from public.procedures where name = 'Pelvic ultrasound')
  + (select count(*)::int from public.referrals where specialty = 'Gynecology')
  + 10 * (select count(*)::int from public.conditions where id = '50000000-0000-0000-0000-000000000002'),
  10, 'removing it takes what it filed, and keeps what she already had');

select * from finish();
rollback;

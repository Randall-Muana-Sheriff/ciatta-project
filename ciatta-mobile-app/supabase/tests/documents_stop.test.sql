begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f5', 'f5@test.local');
insert into public.medications (id, user_id, name, provenance) values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f5', 'Ibuprofen', 'REPORTED');
update public.profiles set onboarding = jsonb_build_object('details', jsonb_build_object('medications', jsonb_build_array('Ibuprofen', 'Iron'), 'allergies', jsonb_build_array('Latex')))
  where id = '00000000-0000-0000-0000-0000000000f5';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f5","role":"authenticated"}';

-- A document with no date of its own that stops a medication she takes.
select lives_ok($$
  select public.save_document('visit', 'Note', null, '00000000-0000-0000-0000-0000000000f5/documents/s1.pdf', '{}'::jsonb,
    '{"stop_medications":[{"id":"70000000-0000-0000-0000-000000000001"}],
      "allergies":[{"name":"Penicillin","reaction":null},{"name":"Penicillin","reaction":null}]}'::jsonb, null)
$$, 'an undated document can stop a medication');
select is((select stopped_on from public.medications where id = '70000000-0000-0000-0000-000000000001'), current_date,
  'it is stopped today when the document gives no date');
select ok(not ((select onboarding->'details'->'medications' from public.profiles where id = '00000000-0000-0000-0000-0000000000f5') ? 'Ibuprofen'),
  'a stopped medication leaves her Health Details list');
select is((select onboarding->'details'->'allergies' from public.profiles where id = '00000000-0000-0000-0000-0000000000f5'),
  '["Latex", "Penicillin"]'::jsonb, 'a filed allergy joins her Allergies list once');

select * from finish();
rollback;

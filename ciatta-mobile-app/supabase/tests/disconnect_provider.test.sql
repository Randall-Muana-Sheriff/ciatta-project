begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local');

insert into public.provider_connections (id, user_id, endpoint_id, endpoint_name, fhir_base_url, vendor, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'one', 'Hospital One', 'https://one.example/R4', 'epic', 'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'two', 'Hospital Two', 'https://two.example/R4', 'epic', 'active');

insert into public.clinical_records (user_id, connection_id, source_id, kind, name) values
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'Condition/1', 'condition', 'Asthma'),
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000002', 'Condition/2', 'condition', 'Migraine');

insert into public.results (user_id, test_name, value, occurred_at, source, source_ref) values
  ('00000000-0000-0000-0000-0000000000a1', 'TSH', 4.2, '2026-01-01', 'provider', '10000000-0000-0000-0000-000000000001:Observation/1'),
  ('00000000-0000-0000-0000-0000000000a1', 'TSH', 3.9, '2026-02-01', 'provider', '10000000-0000-0000-0000-000000000002:Observation/2'),
  ('00000000-0000-0000-0000-0000000000a1', 'Ferritin', 20, '2026-03-01', 'report', 'document 1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(public.disconnect_provider('10000000-0000-0000-0000-000000000001'), false, 'someone else cannot remove her connection');
reset role;
select is((select count(*)::int from public.provider_connections where id = '10000000-0000-0000-0000-000000000001'), 1,
  'and it is still there');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.disconnect_provider('10000000-0000-0000-0000-000000000001'), true, 'she can remove her connection');
select is(public.disconnect_provider('10000000-0000-0000-0000-000000000001'), false, 'removing it a second time is a no');
reset role;

select is((select count(*)::int from public.provider_connections where user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'only that connection is gone');
select is((select count(*)::int from public.clinical_records where user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'its records are gone and the other provider''s stay');
select is((select count(*)::int from public.results where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'provider'), 1,
  'its labs are gone and the other provider''s stay');
select is((select count(*)::int from public.results where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'report'), 1,
  'labs she added from a report are untouched');
select ok(not has_function_privilege('anon', 'public.disconnect_provider(uuid)', 'EXECUTE'), 'anon cannot call it');

select * from finish();
rollback;

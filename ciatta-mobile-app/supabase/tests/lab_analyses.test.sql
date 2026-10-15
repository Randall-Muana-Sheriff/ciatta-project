begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.local'),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.local');
insert into public.documents (id, user_id, storage_path, doc_type) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a7/lab-reports/x.pdf', 'lab_report');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
select throws_ok($$ select public.store_lab_analysis('40000000-0000-0000-0000-000000000001', 'gpt-4o', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'an analysis cannot be stored against someone else''s report');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select lives_ok($$ select public.store_lab_analysis('40000000-0000-0000-0000-000000000001', 'gpt-4o', 'h', '{"summary":"x"}'::jsonb) $$,
  'she can store one against her own report');
select is((select count(*)::int from public.lab_analyses), 1, 'and she can read it');
select throws_ok($$ insert into public.lab_analyses (user_id, document_id, model, facts_hash, analysis)
  values ('00000000-0000-0000-0000-0000000000a7', '40000000-0000-0000-0000-000000000001', 'm', 'h', '{}') $$,
  '42501', null, 'the app cannot write an analysis directly');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
select is((select count(*)::int from public.lab_analyses), 0, 'someone else reads none of it');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select is((select bool_and(public.claim_lab_analysis()) from generate_series(1, 20)), true, 'twenty analyses a day');
select is(public.claim_lab_analysis(), false, 'and not a twenty first');

reset role;
delete from public.documents where id = '40000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.lab_analyses), 0, 'removing the report removes its analysis');

select * from finish();
rollback;

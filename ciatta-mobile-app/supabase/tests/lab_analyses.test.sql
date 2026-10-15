begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.local'),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.local');
insert into public.documents (id, user_id, storage_path, doc_type) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a7/lab-reports/x.pdf', 'lab_report');

-- Only the function, with the server's key, stores an analysis, and only
-- after it has checked it. A signed in person cannot call this at all.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select throws_ok($$ select public.store_lab_analysis('00000000-0000-0000-0000-0000000000a7', '40000000-0000-0000-0000-000000000001', 'gpt-4o', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'she cannot store an analysis herself, even on her own report');
select throws_ok($$ insert into public.lab_analyses (user_id, document_id, model, facts_hash, analysis)
  values ('00000000-0000-0000-0000-0000000000a7', '40000000-0000-0000-0000-000000000001', 'm', 'h', '{}') $$,
  '42501', null, 'the app cannot write an analysis directly');

reset role;
set local role service_role;
select throws_ok($$ select public.store_lab_analysis('00000000-0000-0000-0000-0000000000b7', '40000000-0000-0000-0000-000000000001', 'gpt-4o', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'the function cannot store one against a report that is not that person''s');
select lives_ok($$ select public.store_lab_analysis('00000000-0000-0000-0000-0000000000a7', '40000000-0000-0000-0000-000000000001', 'gpt-4o', 'h', '{"summary":"x"}'::jsonb) $$,
  'the function stores it against her own report');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select is((select count(*)::int from public.lab_analyses), 1, 'and she can read it');

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

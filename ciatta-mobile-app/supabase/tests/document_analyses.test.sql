begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.local'),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.local');
insert into public.documents (id, user_id, storage_path, doc_type) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a8/documents/x.pdf', 'visit');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';
select throws_ok($$ select public.store_document_analysis('00000000-0000-0000-0000-0000000000a8', '60000000-0000-0000-0000-000000000001', 'm', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'she cannot store an analysis herself');

reset role;
set local role service_role;
select throws_ok($$ select public.store_document_analysis('00000000-0000-0000-0000-0000000000b8', '60000000-0000-0000-0000-000000000001', 'm', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'not against someone else''s document');
select lives_ok($$ select public.store_document_analysis('00000000-0000-0000-0000-0000000000a8', '60000000-0000-0000-0000-000000000001', 'm', 'h', '{"summary":"x"}'::jsonb) $$,
  'the function stores it against her document');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';
select is((select count(*)::int from public.document_analyses), 1, 'she can read it');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}';
select is((select count(*)::int from public.document_analyses), 0, 'someone else cannot');

reset role;
delete from public.documents where id = '60000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.document_analyses), 0, 'removing the document removes its analysis');

select * from finish();
rollback;

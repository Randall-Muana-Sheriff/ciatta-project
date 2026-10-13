begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.procedures (user_id, client_id, name, performed_on)
  values ('00000000-0000-0000-0000-00000000000a', 'p1', 'Laparoscopy', '2026-01-12')
$$, 'she adds a procedure with its date');
select throws_ok($$
  insert into public.procedures (user_id, client_id, name, performed_on)
  values ('00000000-0000-0000-0000-00000000000a', 'p2', '   ', '2026-01-12')
$$, '23514', null, 'a procedure has a name');
select throws_ok($$
  insert into public.procedures (user_id, client_id, name, performed_on)
  values ('00000000-0000-0000-0000-00000000000b', 'p3', 'Biopsy', '2026-01-12')
$$, '42501', null, 'she cannot write someone else''s');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.procedures), 0, 'another person sees none of hers');

select * from finish();
rollback;

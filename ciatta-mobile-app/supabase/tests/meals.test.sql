begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.meals (user_id, client_id, eaten_at, items, kcal, protein_g, carbs_g, fat_g, provenance)
  values ('00000000-0000-0000-0000-00000000000a', 'm1', '2026-10-13 12:30+00',
          '[{"name":"Grilled Chicken","kcal":248,"from":"estimated"}]', 248, 46.5, 0, 5.4, 'INFERRED')
$$, 'she saves a scanned meal, marked as inferred');

select throws_ok($$
  insert into public.meals (user_id, client_id, eaten_at, items, kcal)
  values ('00000000-0000-0000-0000-00000000000a', 'm2', now(), '{"not":"a list"}', 10)
$$, '23514', null, 'items must be a list');

select throws_ok($$
  insert into public.meals (user_id, client_id, eaten_at, items, kcal)
  values ('00000000-0000-0000-0000-00000000000a', 'm3', now(), '[]', -5)
$$, '23514', null, 'no negative figures');

select throws_ok($$
  insert into public.meals (user_id, client_id, eaten_at, items)
  values ('00000000-0000-0000-0000-00000000000b', 'm4', now(), '[]')
$$, '42501', null, 'she cannot write someone else''s meal');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.meals), 0, 'another person sees none of hers');

select * from finish();
rollback;

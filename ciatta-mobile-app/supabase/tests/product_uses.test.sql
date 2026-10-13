begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.product_uses (user_id, client_id, product, size, started_at)
  values ('00000000-0000-0000-0000-00000000000a', 'p1', 'Tampon', 'Super', '2026-10-12 08:00+00')
$$, 'she logs a product going in');

select throws_ok($$
  insert into public.product_uses (user_id, client_id, product, size, started_at)
  values ('00000000-0000-0000-0000-00000000000a', 'p2', 'Pad', 'Regular', '2026-10-12 09:00+00')
$$, '23505', null, 'two products can never be in at once');

select lives_ok($$
  update public.product_uses set ended_at = '2026-10-12 14:00+00', fullness = 'Soaked' where client_id = 'p1'
$$, 'she takes it out');

select throws_ok($$
  insert into public.product_uses (user_id, client_id, product, size, started_at)
  values ('00000000-0000-0000-0000-00000000000a', 'p3', 'Sponge', 'Regular', '2026-10-12 15:00+00')
$$, '23514', null, 'only the products the app offers');

select throws_ok($$
  insert into public.product_uses (user_id, client_id, product, size, started_at, ended_at)
  values ('00000000-0000-0000-0000-00000000000a', 'p4', 'Pad', 'Regular', '2026-10-12 15:00+00', '2026-10-12 14:00+00')
$$, '23514', null, 'a use cannot end before it started');

select throws_ok($$
  insert into public.product_uses (user_id, client_id, product, size, started_at)
  values ('00000000-0000-0000-0000-00000000000b', 'p5', 'Pad', 'Regular', '2026-10-12 15:00+00')
$$, '42501', null, 'she cannot write someone else''s use');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.product_uses), 0, 'another person sees none of hers');

select * from finish();
rollback;

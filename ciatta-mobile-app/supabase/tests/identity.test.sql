begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', '{"full_name":"Ada Lovelace"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{}');

select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Ada',
  'a profile is created with the first name from sign in');
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null,
  'no name given means no name stored');
select is((select count(*)::int from public.health_sources
  where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'user_report' and name = 'You'), 1,
  'every person starts with the You source');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'A sees only her own profile');
select is((select count(*)::int from public.health_sources), 1, 'A sees only her own sources');
update public.profiles set first_name = 'Mallory' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok(
  $$ insert into public.health_sources (user_id, kind, name, status)
     values ('00000000-0000-0000-0000-00000000000b', 'manual', 'Sneaky', 'active') $$,
  '42501', null, 'A cannot add a source to B');
select lives_ok(
  $$ insert into public.health_sources (user_id, kind, name, status)
     values ('00000000-0000-0000-0000-00000000000a', 'apple_health', 'Apple Health', 'unsupported') $$,
  'A can add her own source');

reset role;
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null,
  'A could not rename B');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

select has_column('public', 'profiles', 'onboarded_at', 'profiles knows when she went through the first steps');
select is((select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), null,
  'a new profile has not been through them');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
update public.profiles set onboarded_at = now() where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set onboarded_at = now() where id = '00000000-0000-0000-0000-00000000000b';
reset role;

select ok((select onboarded_at is not null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'she can stamp her own');
select is((select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null,
  'and cannot stamp another person');

set local role anon;
select throws_ok(
  $$ select onboarded_at from public.profiles $$,
  '42501', null, 'anon cannot read it');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null,
  'B still sees her own as not yet');
reset role;

select * from finish();
rollback;

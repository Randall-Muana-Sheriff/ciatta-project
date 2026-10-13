begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  update public.profiles set nutrition_targets = '{"protein_g": 110}' where id = '00000000-0000-0000-0000-00000000000a'
$$, 'she sets her own targets');
select is((select nutrition_targets->>'protein_g' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), '110',
  'and reads them back');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 0,
  'nobody else can read them');

select * from finish();
rollback;

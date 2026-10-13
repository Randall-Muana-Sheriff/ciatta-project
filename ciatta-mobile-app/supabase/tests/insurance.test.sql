begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  update public.profiles set insurance = '{"provider": "Anthem", "plan": "PPO", "member_id": "XJ12345"}' where id = '00000000-0000-0000-0000-00000000000a'
$$, 'she saves her insurance');
select is((select insurance->>'provider' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Anthem', 'and reads it back');
select throws_ok($$
  update public.profiles set insurance = '{"plan": "PPO"}' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'an insurer is required');
select throws_ok($$
  update public.profiles set insurance = '"Anthem"' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'and it must be the expected shape');
select lives_ok($$
  update public.profiles set insurance = null where id = '00000000-0000-0000-0000-00000000000a'
$$, 'she can remove it');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 0, 'nobody else can read it');

select * from finish();
rollback;

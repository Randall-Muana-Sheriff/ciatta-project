begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a') on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.push_tokens (user_id, token, platform) values ('00000000-0000-0000-0000-00000000000a', 'ExponentPushToken[aaa]', 'ios')
$$, 'she registers her phone');
select lives_ok($$
  insert into public.push_tokens (user_id, token, platform) values ('00000000-0000-0000-0000-00000000000a', 'ExponentPushToken[aaa]', 'ios')
  on conflict (user_id, token) do update set updated_at = now()
$$, 'registering the same phone again keeps one row');
select is((select notify_findings from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), true,
  'new findings are on unless she turns them off');
select throws_ok($$
  insert into public.push_tokens (user_id, token, platform) values ('00000000-0000-0000-0000-00000000000b', 'ExponentPushToken[bbb]', 'ios')
$$, '42501', null, 'she cannot register a phone to someone else');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.push_tokens), 0, 'another person sees none of her phones');

select * from finish();
rollback;

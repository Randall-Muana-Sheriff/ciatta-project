begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(public.claim_food_scan(), true, 'her first scan of the day is allowed');
select is((select count(*)::int from (select public.claim_food_scan() from generate_series(1, 39)) s), 39, 'and the next 39 run');
select is(public.claim_food_scan(), false, 'the 41st is refused');
select throws_ok($$ insert into public.food_scan_uses (user_id, day, count) values ('00000000-0000-0000-0000-00000000000a', current_date, 0) $$,
  '42501', null, 'the phone cannot reset its own count');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is(public.claim_food_scan(), true, 'another person has her own allowance');

select * from finish();
rollback;

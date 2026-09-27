begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

set local role service_role;

select throws_ok(
  $$insert into public.daily_metrics (user_id, day, sleep_hours, time_in_bed)
    values ('00000000-0000-0000-0000-00000000000a', '2026-09-01', 0, 5.5)$$,
  '23514', null, 'a night of zero hours of sleep is refused');

select lives_ok(
  $$insert into public.daily_metrics (user_id, day, time_in_bed)
    values ('00000000-0000-0000-0000-00000000000a', '2026-09-01', 5.5)$$,
  'the same night with sleep left unknown is kept');

select lives_ok(
  $$insert into public.daily_metrics (user_id, day, sleep_hours, time_in_bed)
    values ('00000000-0000-0000-0000-00000000000a', '2026-09-02', 6.25, 7)$$,
  'a night that was measured is kept');

select throws_ok(
  $$update public.daily_metrics set sleep_hours = 0
    where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-09-02'$$,
  '23514', null, 'and cannot be turned into zero afterwards');

reset role;
select * from finish();
rollback;

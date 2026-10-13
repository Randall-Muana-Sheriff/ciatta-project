begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Written as the server function does, under service_role.
insert into public.environment_days (user_id, day, temp_max_c, temp_min_c, humidity_mean, daylight_minutes, pm2_5, us_aqi)
values ('00000000-0000-0000-0000-00000000000a', '2026-10-12', 21, 12, 0.64, 660, 8.2, 34);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*)::int from public.environment_days), 1, 'she reads her own weather');
select throws_ok($$
  insert into public.environment_days (user_id, day, temp_max_c)
  values ('00000000-0000-0000-0000-00000000000a', '2026-10-13', 99)
$$, '42501', null, 'the phone cannot write weather; only the server function can');
select throws_ok($$
  update public.environment_days set temp_max_c = 99 where day = '2026-10-12'
$$, '42501', null, 'nor change it');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.environment_days), 0, 'another person sees none of it');

select * from finish();
rollback;

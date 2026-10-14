begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  update public.profiles set body = '{"blood_type": 1, "height_cm": 173, "weight_kg": 64.2, "weight_on": "2026-10-20", "units": "uk"}'
  where id = '00000000-0000-0000-0000-00000000000a'
$$, 'she saves her blood type, height, weight and units');
select is((select (body->>'height_cm')::numeric from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 173::numeric, 'and reads them back');
select throws_ok($$
  update public.profiles set body = '{"blood_type": 9}' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'a blood type is one of the eight');
select throws_ok($$
  update public.profiles set body = '{"height_cm": 20}' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'a height is a human height');
select throws_ok($$
  update public.profiles set body = '{"weight_kg": 900}' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'a weight is a human weight');
select lives_ok($$
  update public.profiles set body = '{"units": "imperial"}' where id = '00000000-0000-0000-0000-00000000000a'
$$, 'units are metric or imperial');
select throws_ok($$
  update public.profiles set body = '{"units": "furlongs"}' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'and nothing else');
select lives_ok($$
  update public.profiles set body = '{"ethnicity": "east_asian", "gender": "woman", "language": "Yoruba"}' where id = '00000000-0000-0000-0000-00000000000a'
$$, 'she saves her ethnicity, gender and language');
select throws_ok($$
  update public.profiles set body = '{"gender": "martian"}' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'a gender is one of the listed');
select throws_ok($$
  update public.profiles set body = '{"ethnicity": "martian"}' where id = '00000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'an ethnicity is one of the listed');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 0, 'nobody else can read them');

select * from finish();
rollback;

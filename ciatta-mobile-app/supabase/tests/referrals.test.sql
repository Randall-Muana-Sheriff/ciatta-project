begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.referrals (user_id, client_id, specialty, reason, referred_by, referred_on, steps)
  values ('00000000-0000-0000-0000-00000000000a', 'r1', 'Gynecology', 'Pelvic pain', 'Dr Kim', '2026-10-01', '{"referred": "2026-10-01"}')
$$, 'she starts tracking a referral');
select lives_ok($$
  update public.referrals set steps = steps || '{"insurance": "2026-10-05"}', scheduled_for = '2026-11-02' where client_id = 'r1'
$$, 'and ticks off a step');
select is((select steps->>'insurance' from public.referrals where client_id = 'r1'), '2026-10-05', 'the step keeps its day');
select throws_ok($$
  insert into public.referrals (user_id, client_id, specialty) values ('00000000-0000-0000-0000-00000000000a', 'r2', '  ')
$$, '23514', null, 'a referral names who it is to');
select throws_ok($$
  insert into public.referrals (user_id, client_id, specialty, steps) values ('00000000-0000-0000-0000-00000000000a', 'r3', 'Cardiology', '{"invented": "2026-10-01"}')
$$, '23514', null, 'only the known steps can be recorded');
select throws_ok($$
  insert into public.referrals (user_id, client_id, specialty) values ('00000000-0000-0000-0000-00000000000b', 'r4', 'Cardiology')
$$, '42501', null, 'she cannot write someone else''s');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.referrals), 0, 'another person sees none of hers');

select * from finish();
rollback;

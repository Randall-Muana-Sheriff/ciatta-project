begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.care_requests (user_id, client_id, kind, title, body, clinician)
  values ('00000000-0000-0000-0000-00000000000a', 'q1', 'refill', 'Refill: Levothyroxine', 'Hello Dr Kim, ...', 'Dr Kim')
$$, 'Ciatta drafts a request for her');
select is((select status from public.care_requests where client_id = 'q1'), 'draft', 'it starts as a draft');
select lives_ok($$
  update public.care_requests set status = 'sent', sent_on = '2026-10-15' where client_id = 'q1'
$$, 'she marks it sent');
select throws_ok($$
  update public.care_requests set status = 'approved' where client_id = 'q1'
$$, '23514', null, 'only the known states');
select throws_ok($$
  insert into public.care_requests (user_id, client_id, kind, title) values ('00000000-0000-0000-0000-00000000000a', 'q2', 'prescribe', 'x')
$$, '23514', null, 'only the kinds of request she can make of her own clinician');
select lives_ok($$
  insert into public.care_team (user_id, client_id, name, role, organization) values ('00000000-0000-0000-0000-00000000000a', 'c1', 'Dr Kim', 'Gynecologist', 'Riverside Health')
$$, 'she adds a clinician to her care team');
select throws_ok($$
  insert into public.care_team (user_id, client_id, name) values ('00000000-0000-0000-0000-00000000000a', 'c2', '   ')
$$, '23514', null, 'a clinician has a name');
select throws_ok($$
  insert into public.care_team (user_id, client_id, name) values ('00000000-0000-0000-0000-00000000000b', 'c3', 'Dr Lee')
$$, '42501', null, 'she cannot write someone else''s');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.care_requests) + (select count(*)::int from public.care_team), 0, 'another person sees none of hers');

select * from finish();
rollback;

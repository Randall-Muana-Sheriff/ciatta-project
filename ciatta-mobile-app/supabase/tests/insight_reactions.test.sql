begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.insight_reactions (user_id, client_id, insight_id, reaction, saved)
  values ('00000000-0000-0000-0000-00000000000a', 'iron-fatigue', 'iron-fatigue', 'up', true)
$$, 'she likes and saves an insight');
select lives_ok($$
  update public.insight_reactions set reaction = null where client_id = 'iron-fatigue'
$$, 'and takes her thumbs up back, keeping it saved');
select throws_ok($$
  insert into public.insight_reactions (user_id, client_id, insight_id, reaction) values ('00000000-0000-0000-0000-00000000000a', 'bristol', 'bristol', 'love')
$$, '23514', null, 'only up or down');
select throws_ok($$
  insert into public.insight_reactions (user_id, client_id, insight_id) values ('00000000-0000-0000-0000-00000000000a', 'nope', 'not-an-insight')
$$, '23503', null, 'only to insights that exist');
select throws_ok($$
  insert into public.insight_reactions (user_id, client_id, insight_id) values ('00000000-0000-0000-0000-00000000000b', 'thyroid', 'thyroid')
$$, '42501', null, 'she cannot write someone else''s');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.insight_reactions), 0, 'another person sees none of hers');

select * from finish();
rollback;

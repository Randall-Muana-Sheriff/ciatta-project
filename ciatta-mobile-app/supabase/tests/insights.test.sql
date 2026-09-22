begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select has_table('public', 'insights', 'insights exists');
select has_table('public', 'research_refs', 'research_refs exists');

-- insights: hers, derived by the server, read only to her, exactly as
-- threads are.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.insights'::regclass),
  'RLS is enabled on insights'
);
select ok(not has_table_privilege('anon', 'public.insights', 'SELECT'),
  'anon cannot read insights');
select ok(has_table_privilege('authenticated', 'public.insights', 'SELECT'),
  'authenticated can read insights');
select ok(not has_table_privilege('authenticated', 'public.insights', 'INSERT'),
  'authenticated cannot write insights');
select ok(not has_table_privilege('authenticated', 'public.insights', 'UPDATE'),
  'authenticated cannot update insights');
select ok(not has_table_privilege('authenticated', 'public.insights', 'DELETE'),
  'authenticated cannot delete insights');

-- research_refs: reference data about cohorts, never about her, so it has
-- no owner to scope to. It takes the concepts shape: RLS on, one select
-- policy for signed in people, no write policy, and grants that agree.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.research_refs'::regclass),
  'RLS is on for research_refs, as a barrier behind the grants'
);
select policies_are('public', 'research_refs', array['research_refs_read']::name[],
  'research_refs_read is the only policy on research_refs, so nothing permits a write');
select policy_cmd_is('public', 'research_refs', 'research_refs_read', 'SELECT',
  'research_refs_read permits select and nothing else');
select policy_roles_are('public', 'research_refs', 'research_refs_read', array['authenticated']::name[],
  'research_refs_read applies to signed in people only');
select ok(not has_table_privilege('anon', 'public.research_refs', 'SELECT'),
  'anon cannot read research refs');
select ok(not has_table_privilege('authenticated', 'public.research_refs', 'INSERT'),
  'authenticated cannot write research refs');

-- The four parts are columns, and the fourth may never be empty: an insight
-- that has not named what it does not know has not earned the screen.
select throws_ok(
  $$ insert into public.insights (user_id, thread_id, title, what_changed, connected, you_told, not_established)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             'x', 'x', 'x', 'x', '   ') $$,
  '23514',
  null,
  'an insight with nothing in not_established is refused'
);
select throws_ok(
  $$ insert into public.insights (user_id, thread_id, title, what_changed, connected, you_told, not_established, status)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             'x', 'x', 'x', 'x', 'x', 'proven') $$,
  '23514',
  null,
  'a status outside the list is refused'
);

-- The links back: an insight belongs to a thread, and evidence may now
-- point at a research ref, still at exactly one thing.
select fk_ok('public', 'insights', 'thread_id', 'public', 'threads', 'id',
  'thread_id references public.threads (id)');
select has_column('public', 'thread_evidence', 'research_ref_id',
  'evidence can point at a research ref');
select fk_ok('public', 'thread_evidence', 'research_ref_id', 'public', 'research_refs', 'id',
  'research_ref_id references public.research_refs (id)');
select throws_ok(
  $$ insert into public.thread_evidence (user_id, thread_id, role, observation_id, research_ref_id)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid, 'research_context',
             '00000000-0000-0000-0000-0000000000bb'::uuid,
             '00000000-0000-0000-0000-0000000000cc'::uuid) $$,
  '23514',
  null,
  'evidence that points at an observation and a research ref is refused'
);

-- Seeded cases: real rows, two people, different counts on purpose.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.threads (id, user_id, key, title, status, observation_count) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a',
   'cycle_length~sleep_hours', 'Shorter cycles and lower sleep', 'recurring', 2),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b',
   'cycle_length~sleep_hours', 'Shorter cycles and lower sleep', 'recurring', 2);
insert into public.insights (user_id, thread_id, title, what_changed, connected, you_told, not_established) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1',
   'Your two shortest cycles followed your two lowest sleep weeks',
   'Two cycles ran 26 days against a usual 28 to 30.',
   'Each followed a week of lower sleep.',
   'You have not noted anything around these days.',
   'Whether this repeats across your next two cycles. Things that move together are not one causing the other.'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1',
   'An earlier reading, now closed', 'x', 'x', 'x', 'x'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1',
   'Hers, not A''s', 'x', 'x', 'x', 'x');

select is((select status from public.insights where title = 'An earlier reading, now closed'), 'new',
  'an insight is new until the function says otherwise');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*)::int from public.insights), 2,
  'A reads her own two insights');
select is((select count(*)::int from public.insights
             where user_id <> '00000000-0000-0000-0000-00000000000a'), 0,
  'and cannot reach B''s');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.insights), 1,
  'B reads her own one insight');

reset role;

-- An insight goes with its thread.
delete from public.threads where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.insights
             where thread_id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'insights cascade with their thread');

select * from finish();
rollback;

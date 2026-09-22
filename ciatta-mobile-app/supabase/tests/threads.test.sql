begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select has_type('public', 'thread_status', 'the thread status enum exists');
select has_type('public', 'evidence_role', 'the evidence role enum exists');
select has_table('public', 'threads', 'threads exists');
select has_table('public', 'thread_evidence', 'thread_evidence exists');

-- RLS, and only select for her: threads are derived by the server from her
-- changes and links, never written by the client, exactly as temporal_links
-- are. The intelligence function is the one writer.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.threads'::regclass),
  'RLS is enabled on threads'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.thread_evidence'::regclass),
  'RLS is enabled on thread_evidence'
);
select ok(not has_table_privilege('anon', 'public.threads', 'SELECT'),
  'anon cannot read threads');
select ok(has_table_privilege('authenticated', 'public.threads', 'SELECT'),
  'authenticated can read threads');
select ok(not has_table_privilege('authenticated', 'public.threads', 'INSERT'),
  'authenticated cannot write threads');
select ok(not has_table_privilege('authenticated', 'public.threads', 'UPDATE'),
  'authenticated cannot update threads');
select ok(not has_table_privilege('authenticated', 'public.threads', 'DELETE'),
  'authenticated cannot delete threads');
select ok(not has_table_privilege('authenticated', 'public.thread_evidence', 'INSERT'),
  'authenticated cannot write thread evidence');
select ok(has_table_privilege('service_role', 'public.threads', 'INSERT'),
  'service_role can write threads, because the intelligence function is the writer');

-- The key names the relationship, not the occasion, so the same pair seen
-- again updates one thread rather than creating a second.
select col_is_unique('public', 'threads', array['user_id', 'key'],
  'a relationship is recorded once per person');

-- A count of how often something recurred cannot be negative. The ids below
-- reference nothing, so it is worth saying why this raises a check violation
-- rather than a foreign key one: a check is evaluated as the row is formed,
-- a foreign key only once the row is in, so the check always wins.
select throws_ok(
  $$ insert into public.threads (user_id, key, title, status, observation_count)
     values ('00000000-0000-0000-0000-000000000001'::uuid, 'a~b', 'x', 'new', -1) $$,
  '23514',
  null,
  'a negative observation count is refused'
);

-- An evidence row points at exactly one thing. One that pointed at nothing
-- could not be traced, and one that pointed at two could not say which it
-- meant; the whole point of the table is the trace.
select throws_ok(
  $$ insert into public.thread_evidence (user_id, thread_id, role)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid, 'supports') $$,
  '23514',
  null,
  'evidence that points at nothing is refused'
);
select throws_ok(
  $$ insert into public.thread_evidence (user_id, thread_id, role, observation_id, change_id)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid, 'supports',
             '00000000-0000-0000-0000-0000000000bb'::uuid,
             '00000000-0000-0000-0000-0000000000cc'::uuid) $$,
  '23514',
  null,
  'evidence that points at two things is refused'
);

-- Everything above is deliberately unseeded: the checks fire before the
-- foreign keys do. The cases below need real rows.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

insert into public.threads (id, user_id, key, title, status, domains, observation_count) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a',
   'cycle_length~sleep_hours', 'Shorter cycles and lower sleep', 'recurring', '{cycle,sleep}', 2),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a',
   'resting_hr~steps', 'Resting heart rate and steps', 'new', '{recovery,movement}', 2),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b',
   'cycle_length~sleep_hours', 'Shorter cycles and lower sleep', 'new', '{cycle,sleep}', 2);

-- The same key for two different people is two threads, not a collision.
select is((select count(*)::int from public.threads where key = 'cycle_length~sleep_hours'), 2,
  'the same relationship can exist for two people');

-- Evidence can point at an observation, and cascades with its thread.
insert into public.observations (id, user_id, domain, metric, value, occurred_at, provenance, dedupe_key) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a',
   'sleep', 'sleep_hours', 6.2, now(), 'MEASURED', 'th-o1');
select lives_ok($$
  insert into public.thread_evidence (user_id, thread_id, role, observation_id)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1',
          'supports', '00000000-0000-0000-0000-0000000000e1')
$$, 'evidence can point at one observation');

-- The owner select policy, actually exercised, the way temporal_links.test.sql
-- does it: two people with different counts on purpose, so that a dropped
-- predicate cannot come out right by coincidence.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*)::int from public.threads), 2,
  'A reads her own two threads');
select is((select count(*)::int from public.threads
             where user_id <> '00000000-0000-0000-0000-00000000000a'), 0,
  'and cannot reach B''s');
select is((select count(*)::int from public.thread_evidence), 1,
  'A reads her own evidence');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.threads), 1,
  'B reads her own one thread');
select is((select count(*)::int from public.thread_evidence), 0,
  'and none of A''s evidence');

reset role;

-- Deleting a thread takes its evidence with it, so an orphaned trace cannot
-- outlive the thing it was tracing.
delete from public.threads where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.thread_evidence
             where thread_id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'evidence cascades with its thread');

select * from finish();
rollback;

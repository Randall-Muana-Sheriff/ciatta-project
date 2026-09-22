begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- The six tables, each with RLS on and nothing for anon.
select has_table('public', 'recommendations', 'recommendations exists');
select has_table('public', 'considerations', 'considerations exists');
select has_table('public', 'actions', 'actions exists');
select has_table('public', 'outcomes', 'outcomes exists');
select has_table('public', 'learning_events', 'learning_events exists');
select has_table('public', 'insight_views', 'insight_views exists');
select ok((select relrowsecurity from pg_class where oid = 'public.recommendations'::regclass), 'RLS on recommendations');
select ok((select relrowsecurity from pg_class where oid = 'public.considerations'::regclass), 'RLS on considerations');
select ok((select relrowsecurity from pg_class where oid = 'public.actions'::regclass), 'RLS on actions');
select ok((select relrowsecurity from pg_class where oid = 'public.outcomes'::regclass), 'RLS on outcomes');
select ok((select relrowsecurity from pg_class where oid = 'public.learning_events'::regclass), 'RLS on learning_events');
select ok((select relrowsecurity from pg_class where oid = 'public.insight_views'::regclass), 'RLS on insight_views');
select ok(not has_table_privilege('anon', 'public.recommendations', 'SELECT'), 'anon cannot read recommendations');
select ok(not has_table_privilege('anon', 'public.actions', 'SELECT'), 'anon cannot read actions');
select ok(not has_table_privilege('anon', 'public.outcomes', 'SELECT'), 'anon cannot read outcomes');
select ok(not has_table_privilege('anon', 'public.learning_events', 'SELECT'), 'anon cannot read learning events');

-- The server's tables are read only to her.
select ok(not has_table_privilege('authenticated', 'public.recommendations', 'INSERT'), 'authenticated cannot write recommendations');
select ok(not has_table_privilege('authenticated', 'public.learning_events', 'INSERT'), 'authenticated cannot write learning events');
-- The measured half of an outcome is the server's, column by column.
select ok(has_column_privilege('authenticated', 'public.outcomes', 'reported', 'UPDATE'), 'she can update reported');
select ok(not has_column_privilege('authenticated', 'public.outcomes', 'measured', 'UPDATE'), 'she cannot update measured');
select ok(not has_column_privilege('authenticated', 'public.outcomes', 'measured_evidence', 'INSERT'), 'she cannot insert measured evidence');

-- Seed: two people, each with a thread, an insight and a change.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.threads (id, user_id, key, title, status, observation_count) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'cycle_length~sleep_hours', 'Cycle length and sleep', 'new', 2),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'cycle_length~sleep_hours', 'Cycle length and sleep', 'new', 2);
insert into public.insights (id, user_id, thread_id, title, what_changed, connected, you_told, not_established) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'x', 'x', 'x', 'x', 'x'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'x', 'x', 'x', 'x', 'x');
insert into public.changes (id, user_id, metric, from_value, to_value, window_days, deviation, direction, detected_on) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000a', 'steps', 6000, 3000, 90, -1.5, 'lower', current_date);

-- A recommendation points at exactly one thing.
select throws_ok(
  $$ insert into public.recommendations (user_id, type, insight_id, change_id, key, title)
     values ('00000000-0000-0000-0000-00000000000a', 'try', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3', 'k', 'x') $$,
  '23514', null, 'a recommendation grounded in two things is refused');
select throws_ok(
  $$ insert into public.recommendations (user_id, type, key, title)
     values ('00000000-0000-0000-0000-00000000000a', 'try', 'k', 'x') $$,
  '23514', null, 'a recommendation grounded in nothing is refused');
insert into public.recommendations (user_id, type, insight_id, key, title) values
  ('00000000-0000-0000-0000-00000000000a', 'observe', '00000000-0000-0000-0000-0000000000a2', 'observe:a1', 'Watch your next cycle'),
  ('00000000-0000-0000-0000-00000000000b', 'observe', '00000000-0000-0000-0000-0000000000b2', 'observe:b1', 'Watch your next cycle');

-- A lesson that says nothing is refused; a real one lands.
select throws_ok(
  $$ insert into public.learning_events (user_id, type, summary, key)
     values ('00000000-0000-0000-0000-00000000000a', 'pattern_recurred', '  ', 'k') $$,
  '23514', null, 'a learning event with an empty summary is refused');
insert into public.learning_events (user_id, thread_id, type, summary, key) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'pattern_recurred', 'The same combination came back.', 'pattern_recurred:a1:3'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'pattern_recurred', 'The same combination came back.', 'pattern_recurred:b1:3');

-- As A: her own writes, and the job they queue.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ insert into public.actions (user_id, title, kind, metric, wanted)
     values ('00000000-0000-0000-0000-00000000000a', 'A short walk', 'walk', 'steps', 'higher') $$,
  'she can start an action');
select throws_ok(
  $$ insert into public.actions (user_id, title, kind)
     values ('00000000-0000-0000-0000-00000000000a', 'Another walk', 'walk') $$,
  '23505', null, 'a second walk on the same day is the same walk');
select throws_ok(
  $$ insert into public.actions (user_id, title, kind)
     values ('00000000-0000-0000-0000-00000000000b', 'Not hers', 'custom') $$,
  '42501', null, 'she cannot start an action for someone else');
select lives_ok(
  $$ insert into public.outcomes (user_id, action_id, reported, reported_at)
     values ('00000000-0000-0000-0000-00000000000a', (select id from public.actions where kind = 'walk'), 'improved', now()) $$,
  'she can report an outcome');
select lives_ok(
  $$ update public.outcomes set reported = 'unchanged' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'and change what she reported');
select throws_ok(
  $$ update public.outcomes set measured = 'improved' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'but the measured half is refused to her');
select lives_ok(
  $$ insert into public.considerations (user_id, basis_kind, basis_id, status, reason)
     values ('00000000-0000-0000-0000-00000000000a', 'recommendation', (select id from public.recommendations where key = 'observe:a1'), 'dismissed', 'not_relevant') $$,
  'she can record a stance');
select lives_ok(
  $$ insert into public.insight_views (user_id, insight_id)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2') $$,
  'she can record having seen an insight');
select throws_ok(
  $$ insert into public.recommendations (user_id, type, insight_id, key, title)
     values ('00000000-0000-0000-0000-00000000000a', 'try', '00000000-0000-0000-0000-0000000000a2', 'try:x', 'x') $$,
  '42501', null, 'she cannot write a recommendation herself');

-- Isolation: A sees hers, none of B's.
select is((select count(*)::int from public.recommendations), 1, 'A reads her one recommendation');
select is((select count(*)::int from public.learning_events), 1, 'A reads her one learning event');
select is((select count(*)::int from public.actions), 1, 'A reads her one action');
select is((select count(*)::int from public.outcomes), 1, 'A reads her one outcome');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.recommendations where user_id <> '00000000-0000-0000-0000-00000000000b'), 0, 'B cannot reach A''s recommendations');
select is((select count(*)::int from public.actions), 0, 'B sees none of A''s actions');
select is((select count(*)::int from public.outcomes), 0, 'B sees none of A''s outcomes');
select is((select count(*)::int from public.considerations), 0, 'B sees none of A''s considerations');
select is((select count(*)::int from public.insight_views), 0, 'B sees none of A''s views');
reset role;

-- Her action and her report queued one intelligence run, not several.
select is((select count(*)::int from public.jobs
             where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'intelligence' and status = 'pending'), 1,
  'an action and a reported outcome queue one pending intelligence job between them');

select * from finish();
rollback;

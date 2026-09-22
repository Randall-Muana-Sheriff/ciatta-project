begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

-- Every function exists, anon holds none, she holds all.
select has_function('public', 'record_visit', 'record_visit exists');
select has_function('public', 'record_insight_view', 'record_insight_view exists');
select has_function('public', 'set_thread_watch', 'set_thread_watch exists');
select has_function('public', 'accept_recommendation', 'accept_recommendation exists');
select has_function('public', 'dismiss_recommendation', 'dismiss_recommendation exists');
select has_function('public', 'start_action', 'start_action exists');
select has_function('public', 'end_action', 'end_action exists');
select has_function('public', 'report_outcome', 'report_outcome exists');
select has_function('public', 'get_today', 'get_today exists');
select ok(not has_function_privilege('anon', 'public.get_today()', 'EXECUTE'), 'anon cannot read today');
select ok(not has_function_privilege('anon', 'public.set_thread_watch(uuid, boolean)', 'EXECUTE'), 'anon cannot watch');
select ok(has_function_privilege('authenticated', 'public.get_today()', 'EXECUTE'), 'she can read today');
select ok(has_function_privilege('authenticated', 'public.set_thread_watch(uuid, boolean)', 'EXECUTE'), 'she can watch');
select ok(has_function_privilege('authenticated', 'public.start_action(text, text, text, text, text, uuid, uuid)', 'EXECUTE'), 'she can start an action');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.threads (id, user_id, key, title, status, observation_count) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'cycle_length~sleep_hours', 'Cycle length and sleep', 'new', 2),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'cycle_length~sleep_hours', 'Cycle length and sleep', 'new', 2);
insert into public.recommendations (id, user_id, type, thread_id, key, title) values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-00000000000a', 'observe', '00000000-0000-0000-0000-0000000000a1', 'observe:a1', 'Watch your next cycle'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-00000000000a', 'reflect', '00000000-0000-0000-0000-0000000000a1', 'reflect:a1', 'Describe what changed'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-00000000000b', 'observe', '00000000-0000-0000-0000-0000000000b1', 'observe:b1', 'Watch your next cycle');
insert into public.actions (id, user_id, title, kind) values
  ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-00000000000b', 'B walks', 'walk');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- Visits: the first hands back nothing, the second the stamp the first set.
select is(public.record_visit(), null, 'a first visit has no previous stamp');
select ok(public.record_visit() is not null, 'a second visit hands back the first');

-- Today with nothing to say.
select is((public.get_today())->'insight', 'null'::jsonb, 'no live insight reads as null');
select is(jsonb_array_length((public.get_today())->'recommendations'), 2, 'her two offers are listed');
select is(jsonb_array_length((public.get_today())->'actions'), 0, 'no actions yet');

-- An insight arrives; then she looks at it.
reset role;
insert into public.insights (id, user_id, thread_id, title, what_changed, connected, you_told, not_established) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'Cycle length and lower sleep', 'x', 'x', 'x', 'x'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'Hers', 'x', 'x', 'x', 'x');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((public.get_today())->'insight'->>'since', 'new', 'an insight she has not seen is new');
select is((public.get_today())->'insight'->>'thread_status', 'new', 'and carries its thread status');
select throws_ok($$ select public.record_insight_view('00000000-0000-0000-0000-0000000000b2') $$, 'P0002', null,
  'she cannot record a view of an insight that is not hers');
select lives_ok($$ select public.record_insight_view('00000000-0000-0000-0000-0000000000a2') $$, 'she records a view');
select lives_ok($$ select public.record_insight_view('00000000-0000-0000-0000-0000000000a2') $$, 'and another');
select is((select viewed_count from public.insight_views where insight_id = '00000000-0000-0000-0000-0000000000a2'), 2,
  'two views are counted');
select is((public.get_today())->'insight'->>'since', 'unchanged', 'seen and nothing changed reads unchanged');

-- The function moves the insight on; her last look is pushed an hour back
-- because one transaction has one now().
reset role;
update public.insight_views set last_seen_at = now() - interval '1 hour' where insight_id = '00000000-0000-0000-0000-0000000000a2';
update public.insights set status = 'continuing' where id = '00000000-0000-0000-0000-0000000000a2';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((public.get_today())->'insight'->>'since', 'continuing', 'seen again since her last look reads continuing');
reset role;
update public.insights set status = 'updated' where id = '00000000-0000-0000-0000-0000000000a2';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((public.get_today())->'insight'->>'since', 'updated', 'changed since her last look reads updated');
reset role;
update public.insights set status = 'resolved' where id = '00000000-0000-0000-0000-0000000000a2';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((public.get_today())->'insight'->>'since', 'resolved', 'a resolved insight reads resolved');

-- Watching, and unwatching, through the only door the client has.
select throws_ok($$ select public.set_thread_watch('00000000-0000-0000-0000-0000000000b1', true) $$, 'P0002', null,
  'she cannot watch a thread that is not hers');
select lives_ok($$ select public.set_thread_watch('00000000-0000-0000-0000-0000000000a1', true) $$, 'she watches her thread');
select is((select status::text from public.threads where id = '00000000-0000-0000-0000-0000000000a1'), 'watching', 'the thread is watching');
select is((select count(*)::int from public.considerations where basis_kind = 'thread' and status = 'active'), 1, 'her stance is recorded');
select lives_ok($$ select public.set_thread_watch('00000000-0000-0000-0000-0000000000a1', false) $$, 'she stops watching');
select is((select status::text from public.threads where id = '00000000-0000-0000-0000-0000000000a1'), 'recurring', 'a thread seen twice goes back to recurring');
select is((select status from public.considerations where basis_kind = 'thread'), 'dismissed', 'and the stance is closed');

-- Trying something: once a day, ended honestly, reported by her only.
select is(public.start_action('walk', 'A short walk', null, 'steps', 'higher', null, null),
          public.start_action('walk', 'A short walk', null, 'steps', 'higher', null, null),
  'asking twice on one day hands back the same walk');
select is((select count(*)::int from public.actions), 1, 'one action of hers');
select throws_ok($$ select public.end_action((select id from public.actions), 'done') $$, '22023', null,
  'an action ends only as ended or abandoned');
select throws_ok($$ select public.report_outcome('00000000-0000-0000-0000-0000000000b7', 'improved') $$, 'P0002', null,
  'she cannot report on an action that is not hers');
select lives_ok($$ select public.report_outcome((select id from public.actions), 'improved') $$, 'she reports an outcome');
select is((select reported from public.outcomes), 'improved', 'the report is stored');
select is((select measured from public.outcomes), null, 'and the measured half stays untouched');
select lives_ok($$ select public.end_action((select id from public.actions), 'ended') $$, 'she ends the action');
select is((select status from public.actions), 'ended', 'it is ended');

-- Offers: taken up through an action, or turned down with a reason.
select throws_ok($$ select public.dismiss_recommendation('00000000-0000-0000-0000-0000000000a6', 'meh') $$, '22023', null,
  'a dismissal needs a listed reason');
select throws_ok($$ select public.dismiss_recommendation('00000000-0000-0000-0000-0000000000b5', 'not_relevant') $$, 'P0002', null,
  'she cannot dismiss an offer that is not hers');
select lives_ok($$ select public.dismiss_recommendation('00000000-0000-0000-0000-0000000000a6', 'not_relevant') $$, 'she dismisses an offer');
select is((select status from public.recommendations where id = '00000000-0000-0000-0000-0000000000a6'), 'dismissed', 'it is dismissed');
select is((select reason from public.considerations where basis_id = '00000000-0000-0000-0000-0000000000a6'), 'not_relevant', 'with her reason kept');
select lives_ok($$ select public.accept_recommendation('00000000-0000-0000-0000-0000000000a5') $$, 'she accepts the other');
select is(jsonb_array_length((public.get_today())->'recommendations'), 1, 'today lists the accepted offer and not the dismissed one');
select is((public.get_today())->'actions'->0->'outcome'->>'reported', 'improved', 'today lists her action with its outcome');

-- What was learned since her last visit, and nothing older.
reset role;
insert into public.learning_events (user_id, thread_id, type, summary, key, occurred_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'pattern_recurred', 'The same combination came back.', 'k1', now() + interval '1 second'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'pattern_recurred', 'An old lesson.', 'k0', now() - interval '2 days');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(jsonb_array_length((public.get_today())->'learning'), 1, 'only what was learned since her last visit is listed');
reset role;

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_type('public', 'link_relation', 'the relation enum exists');
select has_table('public', 'temporal_links', 'temporal_links exists');

-- RLS, and only select for her: links are derived by the server, never
-- written by the client, exactly as baselines and changes are.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.temporal_links'::regclass),
  'RLS is enabled on temporal_links'
);
select ok(not has_table_privilege('anon', 'public.temporal_links', 'SELECT'),
  'anon cannot read temporal links');
select ok(has_table_privilege('authenticated', 'public.temporal_links', 'SELECT'),
  'authenticated can read temporal links');
select ok(not has_table_privilege('authenticated', 'public.temporal_links', 'INSERT'),
  'authenticated cannot write temporal links');
select ok(not has_table_privilege('authenticated', 'public.temporal_links', 'UPDATE'),
  'authenticated cannot update temporal links');
select ok(not has_table_privilege('authenticated', 'public.temporal_links', 'DELETE'),
  'authenticated cannot delete temporal links');

-- A link never points an observation at itself.
--
-- The ids below reference nothing, so it is worth saying why this raises a
-- check violation rather than a foreign key one. A check constraint is
-- evaluated as the row is formed; a foreign key is an after row trigger
-- that only runs once the row is in. The check therefore always wins, and
-- 23514 is what the ordering of the two guarantees rather than what the
-- data happens to produce.
select throws_ok(
  $$ insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             'same_day', 0, '2026-09-16') $$,
  '23514',
  null,
  'an observation cannot be linked to itself'
);

-- The same pair cannot be recorded twice for the same relation.
select col_is_unique('public', 'temporal_links',
  array['user_id', 'a_observation_id', 'b_observation_id', 'relation'],
  'a pair and relation is recorded once');

-- gap_hours is never negative: A is always the earlier observation, so the
-- gap is a magnitude and a negative one would mean the ordering rule was
-- broken somewhere upstream.
select throws_ok(
  $$ insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             '00000000-0000-0000-0000-0000000000bb'::uuid,
             'same_day', -1, '2026-09-16') $$,
  '23514',
  null,
  'a negative gap is refused'
);

-- Everything above this line is deliberately unseeded: the check constraint
-- is evaluated as the row is formed, before the foreign keys ever fire, so
-- those cases prove what they claim without prerequisites. The cases below
-- need real rows, because an insert that is expected to succeed has to
-- satisfy the foreign keys, and because a uniqueness violation can only be
-- reached by two inserts that both land.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.observations (user_id, domain, metric, value, occurred_at, provenance, dedupe_key) values
  ('00000000-0000-0000-0000-00000000000a', 'activity', 'steps', 1, now(), 'MEASURED', 'tl-o1'),
  ('00000000-0000-0000-0000-00000000000a', 'activity', 'steps', 2, now(), 'MEASURED', 'tl-o2'),
  ('00000000-0000-0000-0000-00000000000a', 'activity', 'steps', 3, now(), 'MEASURED', 'tl-o3'),
  ('00000000-0000-0000-0000-00000000000a', 'activity', 'steps', 4, now(), 'MEASURED', 'tl-o4'),
  ('00000000-0000-0000-0000-00000000000a', 'activity', 'steps', 5, now(), 'MEASURED', 'tl-o5'),
  ('00000000-0000-0000-0000-00000000000a', 'activity', 'steps', 6, now(), 'MEASURED', 'tl-o6');

create temporary view tl_obs as
  select dedupe_key as k, id from public.observations where dedupe_key like 'tl-o%';

-- The gap has to agree with the relation. 168 hours is exactly seven days,
-- so within_7d admits it.
select lives_ok($$
  insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
  select '00000000-0000-0000-0000-00000000000a',
         (select id from tl_obs where k = 'tl-o1'),
         (select id from tl_obs where k = 'tl-o2'),
         'within_7d', 168, '2026-09-16'
$$, 'within_7d accepts a gap of exactly 168 hours');

select throws_ok($$
  insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
  select '00000000-0000-0000-0000-00000000000a',
         (select id from tl_obs where k = 'tl-o3'),
         (select id from tl_obs where k = 'tl-o4'),
         'within_7d', 168.0001, '2026-09-16'
$$, '23514', null, 'within_7d refuses a gap past 168 hours');

-- same_day carries no bound, and that absence is deliberate: a calendar day
-- is 25 or 26 hours across a daylight saving change, so any bound would be
-- a claim about the timezone database rather than about her record. This
-- pins the absence, so that adding a same_day bound later fails here rather
-- than silently rejecting her rows.
select lives_ok($$
  insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
  select '00000000-0000-0000-0000-00000000000a',
         (select id from tl_obs where k = 'tl-o5'),
         (select id from tl_obs where k = 'tl-o6'),
         'same_day', 900, '2026-09-16'
$$, 'same_day is bounded by nothing, on purpose');

-- The pair is recorded once whichever way round it arrives. The plain
-- unique constraint cannot see this, because swapping the two ids changes
-- the column values; the normalised index is what catches it.
select throws_ok($$
  insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
  select '00000000-0000-0000-0000-00000000000a',
         (select id from tl_obs where k = 'tl-o2'),
         (select id from tl_obs where k = 'tl-o1'),
         'within_7d', 5, '2026-09-16'
$$, '23505', null, 'the same pair reversed is refused');

select * from finish();
rollback;

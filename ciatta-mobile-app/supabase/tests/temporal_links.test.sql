begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, period_start, flow, locations, symptoms, stool)
values ('00000000-0000-0000-0000-00000000000a', 'ep-1', now(), '2026-09-14', '2026-09-14T09:00:00Z',
        '{Period,Pain,"Bowel movement"}', '2026-09-14', 'Heavy', '{Pelvis}', '{Bloating,Fatigue}', 4);

select is((select count(*)::int from public.observations), 6,
  'period start, flow, pain, stool and two symptoms become observations');
select is((select value from public.observations where metric = 'pain_episode'), null,
  'pain with no severity has no invented value');
select is((select value_text from public.observations where metric = 'pain_episode'), 'Pelvis',
  'pain keeps where she felt it');
select is((select count(*)::int from public.observations where provenance = 'REPORTED' and source_id is not null), 6,
  'every observation is reported and points at the You source');

update public.episodes set severity = 7 where client_id = 'ep-1';
select is((select value from public.observations where metric = 'pain_episode'), 7::numeric,
  'adding severity later updates the observation');
select is((select count(*)::int from public.observations), 6, 'updating does not duplicate');

select throws_ok($$
  insert into public.observations (user_id, domain, metric, value, occurred_at, provenance, dedupe_key)
  values ('00000000-0000-0000-0000-00000000000a', 'cycle', 'cycle_length', 26, now(), 'DERIVED', 'x')
$$, '42501', null, 'a client cannot write a derived observation');

-- Slice 2 review: the insert grant is per column
-- (20260916100300_observations_column_grants.sql), so the origin columns
-- that record which trigger materialised a row cannot be forged by a client
-- posting straight to the Data API, only by the triggers themselves.
select throws_ok($$
  insert into public.observations (user_id, domain, metric, value, occurred_at, provenance, dedupe_key, origin_table)
  values ('00000000-0000-0000-0000-00000000000a', 'activity', 'steps', 900, now(), 'MEASURED', 'forged-origin', 'episodes')
$$, '42501', null, 'a client cannot name origin_table on an insert');

-- Fix round 1, item 5: a duplicate, a blank and a null symptom must not
-- produce more than one observation (or error on the unique dedupe_key).
insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, symptoms)
values ('00000000-0000-0000-0000-00000000000a', 'ep-dupe-symptoms', now(), '2026-09-14', now(), '{}', '{Bloating,Bloating,"",NULL}');
select is((select count(*)::int from public.observations
  where origin_table = 'episodes' and metric = 'symptom'
  and origin_id = (select id from public.episodes where client_id = 'ep-dupe-symptoms')), 1,
  'duplicate, blank and null symptoms collapse to exactly one observation');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.observations), 0, 'B cannot see A''s observations');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
delete from public.episodes where client_id in ('ep-1', 'ep-dupe-symptoms');
select is((select count(*)::int from public.observations), 0, 'deleting the episode deletes its observations');

select * from finish();
rollback;

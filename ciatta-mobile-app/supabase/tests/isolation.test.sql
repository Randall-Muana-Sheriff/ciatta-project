begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Seed one Storage object for B, as the table owner (bypasses RLS), so A's
-- attempt to read it below is a real cross-owner read, not just an empty table.
insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-00000000000b/report.pdf');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- Inserting a row that claims to belong to B fails, on every Task 2 table and on observations.
select throws_ok($$
  insert into public.raw_inputs (user_id, text, input_mode) values ('00000000-0000-0000-0000-00000000000b', 'x', 'typed')
$$, '42501', null, 'A cannot insert raw_inputs claiming to be B''s');
select throws_ok($$
  insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds)
  values ('00000000-0000-0000-0000-00000000000b', 'ep-forge', now(), '2026-09-14', now(), '{}')
$$, '42501', null, 'A cannot insert an episode claiming to be B''s');
select throws_ok($$
  insert into public.journal_entries (user_id, client_id, text, kind, occurred_at)
  values ('00000000-0000-0000-0000-00000000000b', 'j-forge', 'x', 'Notes', now())
$$, '42501', null, 'A cannot insert a journal entry claiming to be B''s');
select throws_ok($$
  insert into public.medications (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'x')
$$, '42501', null, 'A cannot insert medications claiming to be B''s');
select throws_ok($$
  insert into public.supplements (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'x')
$$, '42501', null, 'A cannot insert supplements claiming to be B''s');
select throws_ok($$
  insert into public.documents (user_id, storage_path)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b/x.pdf')
$$, '42501', null, 'A cannot insert a document claiming to be B''s');
select throws_ok($$
  insert into public.results (user_id, test_name, value, occurred_at)
  values ('00000000-0000-0000-0000-00000000000b', 'x', 1, now())
$$, '42501', null, 'A cannot insert results claiming to be B''s');
select throws_ok($$
  insert into public.observations (user_id, domain, metric, value_text, occurred_at, provenance, dedupe_key)
  values ('00000000-0000-0000-0000-00000000000b', 'x', 'x', 'x', now(), 'REPORTED', 'iso-forge')
$$, '42501', null, 'A cannot insert an observation claiming to be B''s');

-- A's own episode, then try to hand it to B.
insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds)
values ('00000000-0000-0000-0000-00000000000a', 'ep-iso', now(), '2026-09-14', now(), '{}');
select throws_ok($$
  update public.episodes set user_id = '00000000-0000-0000-0000-00000000000b' where client_id = 'ep-iso'
$$, '42501', null, 'A cannot reassign her episode to B');

-- A source_id must belong to the same user as the row it is attached to.
-- She cannot read B's source id through RLS in the first place, so this
-- captures it out of band (as the table owner) to prove the constraint
-- itself -- not RLS's read protection -- is what stops the write, in case
-- the id ever reached her by some other path.
reset role;
create temporary table _iso_b_source as
  select id from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'user_report';
grant select on _iso_b_source to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$
  update public.episodes set source_id = (select id from _iso_b_source) where client_id = 'ep-iso'
$$, '23503', null, 'A cannot attach B''s source to her own episode');

-- B's episode, seeded as the owner (bypasses RLS), so we can prove A's write against it is a no-op.
reset role;
insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, note)
values ('00000000-0000-0000-0000-00000000000b', 'ep-b', now(), '2026-09-14', now(), '{}', 'original');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
update public.episodes set note = 'hacked' where client_id = 'ep-b';
delete from public.episodes where client_id = 'ep-b';

reset role;
select is((select note from public.episodes where client_id = 'ep-b'), 'original', 'A updating B''s episode affects zero rows');
select is((select count(*)::int from public.episodes where client_id = 'ep-b'), 1, 'A deleting B''s episode affects zero rows');

-- Finding 6: the same "affects zero rows" proof, for every other owner-RLS
-- table (episodes already covered above). Each row is seeded as the table
-- owner (bypasses RLS), attacked as A, then checked as postgres.
insert into public.health_sources (user_id, kind, name, status) values
  ('00000000-0000-0000-0000-00000000000b', 'manual', 'B-source', 'active');
insert into public.raw_inputs (user_id, text, input_mode) values
  ('00000000-0000-0000-0000-00000000000b', 'B raw input', 'typed');
insert into public.journal_entries (user_id, client_id, text, kind, occurred_at) values
  ('00000000-0000-0000-0000-00000000000b', 'j-b', 'B note', 'Notes', now());
insert into public.medications (user_id, name, dose) values
  ('00000000-0000-0000-0000-00000000000b', 'B-med', 'B-dose');
insert into public.supplements (user_id, name, dose) values
  ('00000000-0000-0000-0000-00000000000b', 'B-supp', 'B-dose');
insert into public.documents (user_id, storage_path, title) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b/b-doc.pdf', 'B-title');
insert into public.results (user_id, test_name, value, panel, occurred_at) values
  ('00000000-0000-0000-0000-00000000000b', 'B-test', 1, 'B-panel', now());
insert into public.observations (user_id, domain, metric, value_text, occurred_at, provenance, dedupe_key) values
  ('00000000-0000-0000-0000-00000000000b', 'x', 'x', 'B-value', now(), 'REPORTED', 'iso-b-obs');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
update public.health_sources set error = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'B-source';
delete from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'B-source';
update public.raw_inputs set metadata = '{"hacked":true}' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.raw_inputs where user_id = '00000000-0000-0000-0000-00000000000b';
update public.journal_entries set text = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.journal_entries where user_id = '00000000-0000-0000-0000-00000000000b';
update public.medications set dose = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.medications where user_id = '00000000-0000-0000-0000-00000000000b';
update public.supplements set dose = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.supplements where user_id = '00000000-0000-0000-0000-00000000000b';
update public.documents set title = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.documents where user_id = '00000000-0000-0000-0000-00000000000b';
update public.results set panel = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.results where user_id = '00000000-0000-0000-0000-00000000000b';

-- observations has no update/delete policy at all (only select and a
-- provenance-constrained insert), so authenticated has no update/delete
-- grant on it either -- unlike the tables above, the attempt itself errors
-- (42501) rather than silently affecting zero rows.
select throws_ok($$
  update public.observations set value_text = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b'
$$, '42501', null, 'A cannot update B''s observation');
select throws_ok($$
  delete from public.observations where user_id = '00000000-0000-0000-0000-00000000000b'
$$, '42501', null, 'A cannot delete B''s observation');

reset role;
select is((select error from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'B-source'), null,
  'A updating B''s health source affects zero rows');
select is((select count(*)::int from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'B-source'), 1,
  'A deleting B''s health source affects zero rows');
select is((select metadata from public.raw_inputs where user_id = '00000000-0000-0000-0000-00000000000b'), '{}'::jsonb,
  'A updating B''s raw input affects zero rows');
select is((select count(*)::int from public.raw_inputs where user_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'A deleting B''s raw input affects zero rows');
select is((select text from public.journal_entries where user_id = '00000000-0000-0000-0000-00000000000b' and client_id = 'j-b'), 'B note',
  'A updating B''s journal entry affects zero rows');
select is((select count(*)::int from public.journal_entries where user_id = '00000000-0000-0000-0000-00000000000b' and client_id = 'j-b'), 1,
  'A deleting B''s journal entry affects zero rows');
select is((select dose from public.medications where user_id = '00000000-0000-0000-0000-00000000000b'), 'B-dose',
  'A updating B''s medication affects zero rows');
select is((select count(*)::int from public.medications where user_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'A deleting B''s medication affects zero rows');
select is((select dose from public.supplements where user_id = '00000000-0000-0000-0000-00000000000b'), 'B-dose',
  'A updating B''s supplement affects zero rows');
select is((select count(*)::int from public.supplements where user_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'A deleting B''s supplement affects zero rows');
select is((select title from public.documents where user_id = '00000000-0000-0000-0000-00000000000b'), 'B-title',
  'A updating B''s document affects zero rows');
select is((select count(*)::int from public.documents where user_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'A deleting B''s document affects zero rows');
select is((select panel from public.results where user_id = '00000000-0000-0000-0000-00000000000b'), 'B-panel',
  'A updating B''s result affects zero rows');
select is((select count(*)::int from public.results where user_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'A deleting B''s result affects zero rows');
select is((select value_text from public.observations where user_id = '00000000-0000-0000-0000-00000000000b' and dedupe_key = 'iso-b-obs'), 'B-value',
  'B''s observation is unchanged after A''s update attempt');
select is((select count(*)::int from public.observations where user_id = '00000000-0000-0000-0000-00000000000b' and dedupe_key = 'iso-b-obs'), 1,
  'B''s observation still exists after A''s delete attempt');

-- Clean up B's rows from the finding-6 block above, as the table owner --
-- otherwise B legitimately owning one row in each of these tables would
-- make the "B cannot see A's ..." counts below trivially nonzero.
delete from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'B-source';
delete from public.raw_inputs where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.journal_entries where user_id = '00000000-0000-0000-0000-00000000000b' and client_id = 'j-b';
delete from public.medications where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.supplements where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.documents where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.results where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.observations where user_id = '00000000-0000-0000-0000-00000000000b' and dedupe_key = 'iso-b-obs';

-- Give A one row in each of the tables B should not be able to read.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into public.medications (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Ibuprofen');
insert into public.supplements (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Iron');
insert into public.documents (user_id, storage_path) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/doc.pdf');
insert into public.results (user_id, test_name, value, occurred_at) values ('00000000-0000-0000-0000-00000000000a', 'Ferritin', 40, now());
insert into public.raw_inputs (user_id, text, input_mode) values ('00000000-0000-0000-0000-00000000000a', 'felt off today', 'typed');
insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, period_start)
values ('00000000-0000-0000-0000-00000000000a', 'ep-cycle', now(), '2026-09-14', now(), '{Period}', '2026-09-14');
insert into public.journal_entries (user_id, client_id, text, kind, occurred_at)
values ('00000000-0000-0000-0000-00000000000a', 'j-early', 'A early note.', 'Notes', now());

-- A document outside her own folder is refused, even though the row's user_id is correct.
select throws_ok($$
  insert into public.documents (user_id, storage_path)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b/sneaky.pdf')
$$, '23514', null, 'a document outside her own folder is refused');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.medications), 0, 'B cannot see A''s medications');
select is((select count(*)::int from public.supplements), 0, 'B cannot see A''s supplements');
select is((select count(*)::int from public.documents), 0, 'B cannot see A''s documents');
select is((select count(*)::int from public.results), 0, 'B cannot see A''s results');
select is((select count(*)::int from public.raw_inputs), 0, 'B cannot see A''s raw inputs');
select is((select count(*)::int from public.cycle_events), 0, 'B cannot see A''s cycle events');
select is((select count(*)::int from public.journal_entries), 0, 'B cannot see A''s journal entries');

-- Fix round 2: anon now has no grant at all on any of these (round 1 left
-- anon with select, so RLS -- correctly -- returned an empty set; now the
-- Data API role itself has nothing to work with, so every read is a
-- permission error before RLS is ever evaluated).
reset role;
set local role anon;
select throws_ok($$ select count(*)::int from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select count(*)::int from public.health_sources $$, '42501', null, 'anon cannot read health sources');
select throws_ok($$ select count(*)::int from public.raw_inputs $$, '42501', null, 'anon cannot read raw inputs');
select throws_ok($$ select count(*)::int from public.episodes $$, '42501', null, 'anon cannot read episodes');
select throws_ok($$ select count(*)::int from public.journal_entries $$, '42501', null, 'anon cannot read journal entries');
select throws_ok($$ select count(*)::int from public.medications $$, '42501', null, 'anon cannot read medications');
select throws_ok($$ select count(*)::int from public.supplements $$, '42501', null, 'anon cannot read supplements');
select throws_ok($$ select count(*)::int from public.documents $$, '42501', null, 'anon cannot read documents');
select throws_ok($$ select count(*)::int from public.results $$, '42501', null, 'anon cannot read results');
select throws_ok($$ select count(*)::int from public.observations $$, '42501', null, 'anon cannot read observations');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select lives_ok($$
  insert into public.observations (user_id, domain, metric, value_text, occurred_at, provenance, dedupe_key)
  values ('00000000-0000-0000-0000-00000000000a', 'context', 'manual', 'hi', now(), 'REPORTED', 'iso-reported')
$$, 'A can insert a REPORTED observation');
select throws_ok($$
  insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, provenance)
  values ('00000000-0000-0000-0000-00000000000a', 'ep-derived', now(), '2026-09-14', now(), '{}', 'DERIVED')
$$, '23514', null, 'an episode with provenance DERIVED is refused');

-- Storage: A cannot write into B's folder, nor read the object seeded there earlier.
select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-00000000000b/sneaky.pdf')
$$, '42501', null, 'A cannot insert a storage object under B''s folder');
select is((select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-00000000000b/report.pdf'), 0,
  'A cannot read B''s storage object');

-- The journal trigger writes a context/note observation, and removes it when the note is deleted.
insert into public.journal_entries (user_id, client_id, text, kind, occurred_at)
values ('00000000-0000-0000-0000-00000000000a', 'j-iso', 'Feeling anxious.', 'Notes', now());
create temporary table _iso_j_iso as select id from public.journal_entries where client_id = 'j-iso';
select is((select value_text from public.observations where origin_table = 'journal_entries' and domain = 'context' and metric = 'note'
  and origin_id = (select id from _iso_j_iso)),
  'Feeling anxious.', 'the journal trigger writes a context note observation');
delete from public.journal_entries where client_id = 'j-iso';
select is((select count(*)::int from public.observations where origin_table = 'journal_entries'
  and origin_id = (select id from _iso_j_iso)), 0,
  'deleting the note removes its observation');

-- Fix round 1, item 4: an episode and a note that point at her own You
-- source must not block account deletion (the cascade from auth.users into
-- health_sources sets their source_id to null, which used to re-fire the
-- observation triggers for a user whose account was mid-deletion).
-- Real content (a Pain kind and a symptom), so this episode actually
-- produces observations at insert time -- otherwise the account-deletion
-- cascade below never re-fires the trigger with anything to reinsert, and
-- this regression test would pass even without the fix.
insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, symptoms, source_id)
values ('00000000-0000-0000-0000-00000000000a', 'ep-src', now(), '2026-09-14', now(), '{Pain}', '{Bloating}',
        (select id from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'user_report'));
insert into public.journal_entries (user_id, client_id, text, kind, occurred_at, source_id)
values ('00000000-0000-0000-0000-00000000000a', 'j-src', 'Sourced note.', 'Notes', now(),
        (select id from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'user_report'));

reset role;
select lives_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'deleting the account with sourced rows still succeeds');
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.health_sources where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.episodes where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.journal_entries where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.observations where user_id = '00000000-0000-0000-0000-00000000000a'),
  0, 'deleting the account leaves zero rows even with a source_id set');

select * from finish();
rollback;

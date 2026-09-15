begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, locations)
  values ('00000000-0000-0000-0000-00000000000a', 'ep-1', now(), '2026-09-14', '2026-09-14T09:00:00Z', '{Pain}', '{Pelvis}')
$$, 'A saves a pain episode with no severity');
select is((select severity from public.episodes where client_id = 'ep-1'), null, 'severity stays unknown');

insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, severity)
values ('00000000-0000-0000-0000-00000000000a', 'ep-1', now(), '2026-09-14', '2026-09-14T09:00:00Z', '{Pain}', 6)
on conflict (user_id, client_id) do update set severity = excluded.severity;
select is((select count(*)::int from public.episodes where client_id = 'ep-1'), 1, 'saving twice keeps one episode');

select is((select count(*)::int from public.pain_events), 1, 'the pain view shows her pain episode');
select is((select count(*)::int from public.cycle_events), 0, 'no bleeding means no cycle event');

select lives_ok($$
  insert into public.journal_entries (user_id, client_id, text, kind, occurred_at)
  values ('00000000-0000-0000-0000-00000000000a', 'j-1', 'Slept badly.', 'Notes', now())
$$, 'A writes a note');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.episodes), 0, 'B cannot see A''s episodes');
select is((select count(*)::int from public.pain_events), 0, 'B cannot see A''s episodes through a view');

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.episodes) + (select count(*)::int from public.journal_entries), 0,
  'deleting the account deletes her record');

select * from finish();
rollback;

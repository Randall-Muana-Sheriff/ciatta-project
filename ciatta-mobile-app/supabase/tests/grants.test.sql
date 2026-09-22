begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- No function in this schema is callable by either Data API role, whether it
-- was granted to the role directly or to PUBLIC.
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and has_function_privilege('anon', p.oid, 'execute')),
  '', 'anon can execute no function in public');

-- Signed in people may call exactly the loop RPCs Slice 4 added
-- (20260923100100_loop_rpcs.sql), each with its own revoke and grant, and
-- nothing else. A new grant to authenticated must be added to this list on
-- purpose; one that appears here by accident fails the test.
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and has_function_privilege('authenticated', p.oid, 'execute')),
  'accept_recommendation, dismiss_recommendation, end_action, get_today, record_insight_view, record_visit, report_outcome, set_thread_watch, start_action',
  'authenticated can execute exactly the loop RPCs named here, and nothing else');

-- And no execute grant is left waiting for the next function this project
-- adds: the default privileges of the role these migrations run as carry
-- nothing for either Data API role, nor for PUBLIC (grantee 0), which both
-- of them are members of.
select is(
  (select count(*)::int
   from pg_default_acl d, aclexplode(d.defaclacl) a
   where d.defaclnamespace = 'public'::regnamespace
     and d.defaclobjtype = 'f'
     and d.defaclrole = 'postgres'::regrole
     and a.privilege_type = 'EXECUTE'
     and a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)),
  0, 'no default execute grant is waiting for the next function added here');

select * from finish();
rollback;

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

-- fhir_observation is the one deliberate exception, and it is named here so
-- that it stays the only one. It renders a single observation she already
-- owns as a FHIR resource, and it is security invoker: RLS on observations
-- decides which rows it can reach, so granting it to her adds no read she
-- did not already have. Every other function in this schema stays server
-- only, and a second name appearing in this list is a regression rather
-- than a precedent.
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and p.proname <> 'fhir_observation'
     and has_function_privilege('authenticated', p.oid, 'execute')),
  '', 'authenticated can execute no function in public except fhir_observation');

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

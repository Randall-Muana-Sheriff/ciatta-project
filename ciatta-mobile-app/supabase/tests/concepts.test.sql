begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_type('public', 'code_system', 'the code system enum exists');
select has_table('public', 'concepts', 'concepts exists');

-- Reference data, not her data: no user_id column at all.
select hasnt_column('public', 'concepts', 'user_id',
  'concepts carries no user_id, because a LOINC code is the same fact for everyone');

-- Readable by a signed in user, writable only by the server.
select ok(has_table_privilege('authenticated', 'public.concepts', 'SELECT'),
  'authenticated can read concepts');
select ok(not has_table_privilege('authenticated', 'public.concepts', 'INSERT'),
  'authenticated cannot write concepts');
select ok(not has_table_privilege('authenticated', 'public.concepts', 'UPDATE'),
  'authenticated cannot update concepts');
select ok(not has_table_privilege('anon', 'public.concepts', 'SELECT'),
  'anon cannot read concepts');

-- One row per code within a system.
select col_is_unique('public', 'concepts', array['system', 'code'],
  'a code is recorded once per system');

-- A concept with no display text is useless and must not be storable.
select col_not_null('public', 'concepts', 'display', 'display is required');
select col_not_null('public', 'concepts', 'code', 'code is required');
select col_not_null('public', 'concepts', 'system', 'system is required');

-- seeded_at records when UMLS last confirmed this row, which is how a stale
-- vocabulary is found later. It is nullable because a hand entered concept
-- has never been confirmed by UMLS at all, and pretending otherwise would
-- be the same fabrication this project keeps removing.
select col_is_null('public', 'concepts', 'seeded_at',
  'seeded_at is nullable, because a concept UMLS has never confirmed has no such date');

-- Reference data carries no RLS on purpose, and that must not drift. A policy
-- here could only be `using (true)`, which asserts a scoping this table does
-- not have. If concepts ever gains an owner, change this assertion
-- deliberately rather than letting a policy appear by muscle memory.
select ok(
  not (select relrowsecurity from pg_class where oid = 'public.concepts'::regclass),
  'RLS is off on concepts, because reference data has no owner to scope it to'
);
select policies_are('public', 'concepts', array[]::name[],
  'no policy exists on concepts, so the grant is the whole access control story');

-- The revoke covers DELETE too, and a future additive grant must fail here
-- rather than at run time.
select ok(not has_table_privilege('authenticated', 'public.concepts', 'DELETE'),
  'authenticated cannot delete concepts');

-- The seeder runs as the service role, so its write access is load bearing.
select ok(has_table_privilege('service_role', 'public.concepts', 'INSERT'),
  'service_role can insert concepts');
select ok(has_table_privilege('service_role', 'public.concepts', 'UPDATE'),
  'service_role can update concepts');
select ok(has_table_privilege('service_role', 'public.concepts', 'DELETE'),
  'service_role can delete concepts');

select * from finish();
rollback;

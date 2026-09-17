begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

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

-- The link from her record to the vocabulary.
select has_column('public', 'observations', 'concept_id', 'observations can carry a concept');
select col_is_null('public', 'observations', 'concept_id',
  'concept_id is nullable, because an unmapped observation is ordinary, not broken');
-- fk_ok rather than col_is_fk on purpose: col_is_fk asserts only that the
-- column sits in some foreign key, so a later migration could repoint it at
-- another table and this file would stay green. The target is the claim worth
-- holding, so the target is what is named here.
select fk_ok('public', 'observations', 'concept_id', 'public', 'concepts', 'id',
  'concept_id references public.concepts (id)');

-- The metric string is untouched. Anything reading it today keeps working.
select has_column('public', 'observations', 'metric', 'the metric string stays');

-- The lookup, and it is server only like every other function here.
select has_function('public', 'concept_for', 'concept_for exists');
select ok(not has_function_privilege('authenticated', 'public.concept_for(public.code_system, text)', 'EXECUTE'),
  'authenticated cannot execute concept_for');
-- The positive beside the negative. Three assertions that nobody may execute
-- this would all pass on a revoke shipped without its grant, while the only
-- caller that matters quietly lost the function.
select ok(has_function_privilege('service_role', 'public.concept_for(public.code_system, text)', 'EXECUTE'),
  'service_role can execute concept_for, because the seeder is the caller that matters');

select * from finish();
rollback;

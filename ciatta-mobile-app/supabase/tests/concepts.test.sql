begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

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

select has_function('public', 'fhir_observation', 'fhir_observation exists');

-- Seed one user, one concept, one observation.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'fhir@example.com') on conflict do nothing;
insert into public.concepts (id, system, code, display, domain, seeded_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'loinc', '8867-4', 'Heart rate', 'vitals', now())
  on conflict do nothing;
insert into public.observations (id, user_id, domain, metric, value, unit, occurred_at, provenance, dedupe_key, concept_id)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
        'vitals', 'heart_rate', 62, 'count/min', '2026-09-10T08:00:00Z', 'MEASURED', 'fhirtest:1',
        '00000000-0000-0000-0000-0000000000c1');

select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') ->> 'resourceType',
  'Observation',
  'it renders a FHIR Observation resource'
);

select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{code,coding,0,code}',
  '8867-4',
  'the LOINC code travels in code.coding'
);

select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{code,coding,0,system}',
  'http://loinc.org',
  'the coding system is the LOINC url, not the internal enum value'
);

select is(
  (public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{valueQuantity,value}')::numeric,
  62::numeric,
  'the value travels as a quantity'
);

-- Provenance has no home in FHIR, so it travels as an extension rather than
-- being dropped. A measured fact and a reported one must not flatten into
-- the same resource.
select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{extension,0,valueString}',
  'MEASURED',
  'provenance survives the translation'
);

-- An observation with no concept still renders, with no code rather than a
-- fabricated one.
insert into public.observations (id, user_id, domain, metric, value, unit, occurred_at, provenance, dedupe_key)
values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
        'symptom', 'bloating', 3, null, '2026-09-11T08:00:00Z', 'REPORTED', 'fhirtest:2');

-- Both halves, on purpose. Asking only whether the coding is absent cannot
-- tell "correctly absent" from "never rendered at all": this function returns
-- SQL NULL for an id that matches no row, and NULL carries no coding either.
-- The first assertion pins that the resource exists before the second one
-- says what it does not contain.
select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b2') ->> 'resourceType',
  'Observation',
  'an unmapped observation still renders as a resource'
);

select ok(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b2') #> '{code,coding}' is null,
  'an unmapped observation renders with no coding rather than an invented one'
);

-- FHIR value[x] is a choice type: at most one of valueQuantity, valueString
-- and the rest may be present. This schema permits both columns at once, and
-- public.episode_observations() actually writes pain episodes that way, the
-- severity in value and the locations in value_text. Neither row above has
-- both set, which is why nothing here caught it. The quantity is the
-- measurement, so the quantity wins, and the text stays with the resource as
-- a note rather than being dropped.
insert into public.observations (id, user_id, domain, metric, value, value_text, unit, occurred_at, provenance, dedupe_key)
values ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1',
        'pain', 'pain_episode', 7, 'Lower back', 'of 10', '2026-09-12T08:00:00Z', 'REPORTED', 'fhirtest:3');

select is(
  (public.fhir_observation('00000000-0000-0000-0000-0000000000b3') #>> '{valueQuantity,value}')::numeric,
  7::numeric,
  'when a row carries both, the quantity is the value'
);

select ok(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b3') -> 'valueString' is null,
  'and no second value[x] appears beside it, because value[x] is a choice'
);

select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b3') #>> '{note,0,text}',
  'Lower back',
  'the text it displaced survives as a note rather than being dropped'
);

-- Isolation, proven rather than asserted.
--
-- The migration revokes execute from public, which is where authenticated
-- would otherwise inherit it, so she cannot call this function today and
-- nothing consumes it yet. The grant below is made inside this transaction
-- and rolls back with it, so it changes nothing that ships. It is here
-- because the claim worth holding is about RLS rather than about the grant:
-- security invoker means the function sees exactly the rows its caller may
-- see, and the only way to show that is to call it as her. service_role
-- cannot stand in, because it carries bypassrls and would see both women's
-- rows whatever the policy said.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f2', 'fhirb@example.com') on conflict do nothing;
insert into public.observations (id, user_id, domain, metric, value, unit, occurred_at, provenance, dedupe_key, concept_id)
values ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000f2',
        'vitals', 'heart_rate', 71, 'count/min', '2026-09-13T08:00:00Z', 'MEASURED', 'fhirtest:4',
        '00000000-0000-0000-0000-0000000000c1');
grant execute on function public.fhir_observation(uuid) to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') ->> 'resourceType',
  'Observation',
  'she can render her own observation'
);
select ok(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b4') is null,
  'she gets nothing back for another woman''s observation id'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b4') ->> 'resourceType',
  'Observation',
  'the other woman can render her own observation'
);
select ok(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') is null,
  'and gets nothing back for the first woman''s observation id'
);
reset role;

select * from finish();
rollback;

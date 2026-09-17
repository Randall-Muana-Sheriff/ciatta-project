-- The standard vocabulary her record is described in.
--
-- Every other table in this schema holds one woman's information and carries
-- RLS with an owner policy. This one does not, and the departure is
-- deliberate: a LOINC code for heart rate is the same fact for every person
-- alive, so there is no owner to scope it to. It is reference data. She can
-- read it, only the server writes it, and anon holds nothing, which is the
-- same shape baselines already has minus the per user filter.
--
-- The four systems are the ones the architecture document names and the ones
-- the UMLS Metathesaurus serves: LOINC for measurements and laboratory
-- results, SNOMED CT for symptoms, findings and conditions, RxNorm for
-- medications, and UCUM for units.
create type public.code_system as enum ('loinc', 'snomed', 'rxnorm', 'ucum');

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  system public.code_system not null,
  code text not null,
  display text not null,
  -- The domain this concept belongs to in her record: vitals, activity,
  -- sleep, symptom, medication, result. Free text rather than an enum
  -- because the set grows with what she logs, and a migration to add a
  -- value is a poor trade for a column nothing branches on.
  domain text,
  -- The UMLS Concept Unique Identifier. This is the join that lets one term
  -- be recognised across vocabularies, and storing it is what makes the
  -- crosswalk a local lookup rather than a network call on every question.
  cui text,
  -- When UMLS last confirmed this row. Nullable on purpose: a concept
  -- entered by hand has never been confirmed by UMLS, and writing a date
  -- there would assert a confirmation that never happened.
  seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system, code)
);
create index concepts_cui on public.concepts (cui) where cui is not null;
create index concepts_domain on public.concepts (domain);

create trigger concepts_touch before update on public.concepts
  for each row execute function public.touch_updated_at();

revoke all on public.concepts from anon, authenticated;
grant select on public.concepts to authenticated;
grant all on public.concepts to service_role;

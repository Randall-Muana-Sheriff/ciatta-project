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
  -- sleep, symptom, medication, result. Free text rather than an enum or a
  -- check constraint, and the reason is where the value comes from rather
  -- than whether anything reads it. Code does branch on this column. What
  -- it never does is take the value from her: every domain is written by
  -- the seeder from a single checked in list, so a constrained column would
  -- force a migration each time that vocabulary grows while the only thing
  -- it defends against is a typo in one file under review, not anything
  -- that can happen at run time.
  domain text,
  -- The UMLS Concept Unique Identifier, the join that would let one term be
  -- recognised across vocabularies.
  --
  -- Provisioned and not yet populated. Nothing writes this column today: the
  -- seeder's row shape has no cui field, and its upsert sends system, code,
  -- display, domain and seeded_at only, so the value is null in every row and
  -- the partial index below currently covers nothing. Nothing may read a null
  -- here as evidence that a concept has no CUI, because no attempt to learn
  -- one has ever been made.
  --
  -- What will populate it is a crosswalk fetch in the seeding function.
  -- umls.ts already carries crosswalkUrl and parseCrosswalk, which build and
  -- read that request, and they have no fetching companion and no caller yet.
  -- When a seeded concept's CUI is fetched and stored here, a crosswalk
  -- becomes a local lookup rather than a network call per question. Until
  -- then it is neither, and this comment says so rather than describing the
  -- capability as though it shipped.
  cui text,
  -- When UMLS last confirmed this row. Nullable on purpose: a concept
  -- entered by hand has never been confirmed by UMLS, and writing a date
  -- there would assert a confirmation that never happened.
  seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system, code)
);
-- Partial, so while cui is null in every row this index holds nothing and
-- costs nothing. It is created now rather than later because the column is
-- the right shape and the cost of carrying it empty is nil.
create index concepts_cui on public.concepts (cui) where cui is not null;
create index concepts_domain on public.concepts (domain);

create trigger concepts_touch before update on public.concepts
  for each row execute function public.touch_updated_at();

revoke all on public.concepts from anon, authenticated;
grant select on public.concepts to authenticated;
grant all on public.concepts to service_role;

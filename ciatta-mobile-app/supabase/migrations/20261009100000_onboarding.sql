-- What she tells Ciatta before there is any data to interpret.
--
-- Onboarding is the one moment the record is empty on purpose, so everything
-- written here is REPORTED: her own account of herself, never measured and
-- never inferred. The provenance column on conditions carries that, and the
-- intelligence layer must keep treating it as her report rather than as a
-- finding, exactly as it does for an episode she logs by hand.

-- Marks the end of the first session rather than the start of it. Null means
-- she has not finished onboarding, which is also true of someone who began it
-- and closed the app, and that is the behaviour wanted: an unfinished first
-- session resumes rather than being skipped.
--
-- A timestamp rather than a boolean, because "when did she tell us this" is a
-- question the record will be asked later, and a boolean cannot answer it.
alter table public.profiles add column onboarded_at timestamptz;

-- Her intent and her starting context, as she gave it.
--
-- jsonb rather than columns, and the reason is the same one that put
-- cycle_profile in jsonb beside it: this shape is still being learned. The
-- fields below are what the first build writes, and a question added to the
-- flow next month should not need a migration to store its answer.
--
--   intents     text[]  what she came for. Several at once is normal: noticing
--                       a change and preparing for an appointment are not
--                       alternatives.
--   ageRange    text    a range, not a birthday. The interpretation needs the
--                       decade; the exact date is an identifier we have no use
--                       for, so it is not collected.
--   lifeStage   text    perimenopause, postpartum, and so on. Optional.
--   cycle       object  only when a cycle is relevant to her, which the flow
--                       decides from lifeStage and intents rather than asking
--                       everyone.
--   goals       text[]  what she wants to be different.
--   skipped     text[]  which steps she passed over. Kept because a question
--                       she declined is not the same as a question never put
--                       to her, and the reflection screen must not describe a
--                       declined answer as missing data it could go and find.
comment on column public.profiles.onboarded_at is 'When she finished the first session. Null means onboarding is unfinished and should resume, which includes someone who started and closed the app.';

alter table public.profiles add column onboarding jsonb not null default '{}';
comment on column public.profiles.onboarding is 'Her intent and starting context as she reported it: intents, ageRange, lifeStage, cycle, goals, skipped. jsonb because the question set is still being learned, the same reason cycle_profile beside it is jsonb. Everything here is REPORTED, never measured.';

-- Conditions and surgeries, as she reports them.
--
-- A table rather than another jsonb field, and the distinction is about who
-- reads it. intents and ageRange are read by the onboarding flow and by copy;
-- a condition is read by the intelligence layer, which has to ask "does she
-- have endometriosis" against every woman's record and cannot do that through
-- a json blob without scanning all of them.
--
-- Surgeries share the table rather than getting their own, because they are
-- the same shape: a named thing, with a date she may or may not remember, that
-- changes how a later finding should be read. kind keeps them apart.
create type public.condition_kind as enum ('condition', 'surgery');

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.condition_kind not null default 'condition',
  -- Her words. No vocabulary constraint and no concept link in this slice:
  -- forcing "endo" to resolve to a SNOMED code before it can be saved would
  -- lose the entry when it does not resolve, and losing what she typed is
  -- worse than storing it unmapped. The concept layer can map it later.
  name text not null,
  -- REPORTED by default because she is the source. An import from a health
  -- record would write IMPORTED, and the two must stay distinguishable: one
  -- is her account, the other a document's.
  provenance public.provenance not null default 'REPORTED',
  -- unknown is the default rather than active, because "she listed it" does
  -- not establish that it is current, and assuming active would be the
  -- backend inventing a clinical fact she did not give.
  status text not null default 'unknown' check (status in ('active', 'resolved', 'unknown')),
  -- Nullable, and usually null. Asking a woman the month she had surgery
  -- fifteen years ago is a question that costs her more than the answer is
  -- worth, so the flow offers it and never requires it.
  occurred_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conditions_user on public.conditions (user_id);
create index conditions_user_kind on public.conditions (user_id, kind);

-- She writes these herself, so unlike the server derived tables she gets the
-- full set of owner policies: she can add a condition, correct it, and remove
-- one she added by mistake. enable_owner_rls is the right helper here for
-- exactly that reason, where it was the wrong one for baselines.
select public.enable_owner_rls('conditions');

revoke all on public.conditions from anon, authenticated;
grant select, insert, update, delete on public.conditions to authenticated;
grant all on public.conditions to service_role;

comment on table public.conditions is 'Conditions, surgeries and reported symptoms, kept apart by kind. Her words, unmapped: a name that does not resolve to a standard concept is still stored, because losing what she typed is worse than storing it unmapped.';
comment on column public.conditions.status is 'active, resolved or unknown. Defaults to unknown: that she listed something does not establish it is current, and defaulting to active would invent a clinical fact she did not give.';

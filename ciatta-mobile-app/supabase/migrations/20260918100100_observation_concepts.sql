-- The link from her record to the standard vocabulary.
--
-- Additive on purpose. observations.metric is not dropped, not renamed and
-- not migrated away: the concept sits beside it, and everything reading the
-- metric string today keeps working. A rewrite of a live table holding her
-- health information is not a thing to do for tidiness.
--
-- Nullable, and it stays that way. Every row already in her record predates
-- this slice, and an observation whose metric has no standard concept is an
-- ordinary thing rather than a broken row. A not null column would force
-- something fabricated onto every unmapped row, which is the fault this
-- project keeps taking out.
alter table public.observations
  add column concept_id uuid references public.concepts (id);

create index observations_concept on public.observations (concept_id) where concept_id is not null;

-- Resolving a code to a concept id, for the ingest paths that know the code
-- rather than the row.
create function public.concept_for(p_system public.code_system, p_code text) returns uuid
language sql stable security invoker set search_path = '' as $$
  select id from public.concepts where system = p_system and code = p_code;
$$;
revoke execute on function public.concept_for(public.code_system, text) from public, anon, authenticated;
grant execute on function public.concept_for(public.code_system, text) to service_role;

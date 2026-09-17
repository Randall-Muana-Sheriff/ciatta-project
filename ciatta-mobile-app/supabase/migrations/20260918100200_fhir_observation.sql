-- One stored observation, rendered as a FHIR R4 Observation resource.
--
-- This is the representation the architecture document asks her data to be
-- exchanged in, so an export or a hand off to a clinic speaks a standard
-- shape rather than this schema's column names.
--
-- security invoker, so the function sees exactly the rows its caller may
-- see. Called as her it can only ever render her own observations, because
-- RLS on observations still applies underneath. That is why there is no user
-- check written here: adding one would imply the RLS underneath is not
-- trusted, and it is.
create function public.fhir_observation(p_observation_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'resourceType', 'Observation',
    'id', o.id,
    'status', 'final',
    'effectiveDateTime', to_char(o.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'code', case when c.id is null then null else jsonb_build_object(
      'coding', jsonb_build_array(jsonb_build_object(
        -- The published url for each system, not this schema's enum value.
        -- A FHIR resource carrying "loinc" where a reader expects
        -- "http://loinc.org" is not a FHIR resource anyone else can read.
        'system', case c.system
                    when 'loinc'  then 'http://loinc.org'
                    when 'snomed' then 'http://snomed.info/sct'
                    when 'rxnorm' then 'http://www.nlm.nih.gov/research/umls/rxnorm'
                    when 'ucum'   then 'http://unitsofmeasure.org'
                  end,
        'code', c.code,
        'display', c.display
      )),
      'text', c.display
    ) end,
    'valueQuantity', case when o.value is null then null else jsonb_build_object(
      'value', o.value,
      'unit', o.unit
    ) end,
    'valueString', o.value_text,
    -- Provenance has no field in FHIR Observation, and dropping it would
    -- flatten a measurement and something she reported into the same
    -- resource. It travels as an extension so the distinction survives
    -- leaving this database.
    'extension', jsonb_build_array(jsonb_build_object(
      'url', 'https://ciatta.io/fhir/StructureDefinition/provenance',
      'valueString', o.provenance::text
    ))
  ))
  from public.observations o
  left join public.concepts c on c.id = o.concept_id
  where o.id = p_observation_id;
$$;
revoke execute on function public.fhir_observation(uuid) from public, anon;
-- She may render her own observations; RLS decides which those are.
grant execute on function public.fhir_observation(uuid) to authenticated, service_role;

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
    -- value[x] is a choice type in FHIR: at most one of valueQuantity,
    -- valueString and the rest may appear on a resource. This schema permits
    -- both columns at once, and episode_observations() writes pain episodes
    -- exactly that way, the severity in value and the locations in
    -- value_text, so emitting the two independently produced a resource no
    -- conforming reader accepts. The quantity is the measurement, so the
    -- quantity wins.
    'valueQuantity', case when o.value is null then null else jsonb_build_object(
      'value', o.value,
      'unit', o.unit
    ) end,
    'valueString', case when o.value is not null then null else o.value_text end,
    -- The text the quantity displaced, carried rather than dropped, because
    -- it is hers and it was recorded. A note is free text commentary, which
    -- is a weaker claim than value[x] makes, and that is the honest place
    -- for it: this function cannot know what the text describes. For a pain
    -- episode it is the body site, and FHIR has bodySite for that, but the
    -- same column also holds the word Reported when no location was given,
    -- and writing that into bodySite would assert a body site that is not
    -- one.
    'note', case when o.value is not null and o.value_text is not null
                 then jsonb_build_array(jsonb_build_object('text', o.value_text))
            end,
    -- Provenance has no field in FHIR Observation, and dropping it would
    -- flatten a measurement and something she reported into the same
    -- resource. It travels as an extension so the distinction survives
    -- leaving this database.
    --
    -- Debt, recorded at the line so the next reader finds it here rather
    -- than in a report. A FHIR extension url is meant to be the resolvable
    -- canonical identifier of the StructureDefinition that defines the
    -- extension, and nothing serves anything at the url below. A clinic
    -- receiving this resource sees the string MEASURED with no way to learn
    -- what the vocabulary is or what its other values are, so a distinction
    -- this record went to trouble to preserve flattens one step further
    -- downstream instead. What is owed is serving that definition, covering
    -- MEASURED, REPORTED, RECORDED and IMPORTED. The fuller answer is FHIR's
    -- own Provenance resource, which models who or what asserted a fact and
    -- which receiving systems already understand, but that means emitting a
    -- second resource rather than a field, which is a modelling change this
    -- slice is not making.
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
-- service_role only, for now, and the omission of authenticated is the
-- point. Granting this to her would make it the first function in public
-- reachable on the Data API at /rest/v1/rpc/, and no caller needs that yet:
-- nothing consumes this function today. That she may render her own
-- observations and that RLS decides which rows that reaches is sound, and
-- the security invoker above is what makes it true, but an invariant held
-- since the first slice is not spent ahead of a caller. When an export path
-- needs the grant it goes in then, with the reason recorded at that moment.
-- The test proves the RLS confinement now, under a grant that rolls back.
grant execute on function public.fhir_observation(uuid) to service_role;

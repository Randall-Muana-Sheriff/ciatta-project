-- Two fixes to what a provider connection is, from the branch review.
--
-- 1. A connection is her provider's FHIR server, not a directory row. The
--    carried directory numbers its rows (epic-brand-5, epic-facility-812),
--    and those numbers change when the directory does, so keying on them
--    let one hospital become two connections, or let a different hospital
--    overwrite hers. endpoint_id becomes the server address, host
--    lowercased and without a trailing slash, the same as connectionKey()
--    in the function. Where she already has two connections to one
--    server, the most recently updated is kept, and the older ones go with
--    their records and labs: both read the same chart, and the newest holds
--    the latest sync of it.
--
-- 2. A provider lab names its connection, with on delete cascade. Before,
--    labs were found by a source_ref prefix, so a sync still running when
--    she removed the provider could write a lab after the removal, and it
--    would stay in her labs for good. Now that write fails on the foreign
--    key, and removal takes the labs in the same statement.

with keyed as (
  select
    id,
    user_id,
    updated_at,
    lower(coalesce(substring(rtrim(fhir_base_url, '/') from '^[A-Za-z][A-Za-z0-9+.-]*://[^/]+'), ''))
      || coalesce(substring(rtrim(fhir_base_url, '/') from '^[A-Za-z][A-Za-z0-9+.-]*://[^/]+(/.*)$'), '') as key
  from public.provider_connections
),
ranked as (
  select id, key, row_number() over (partition by user_id, key order by updated_at desc, id) as n
  from keyed
),
dropped as (
  select id from ranked where n > 1
),
gone_labs as (
  delete from public.results r
  using dropped d
  where r.source = 'provider' and r.source_ref like d.id::text || ':%'
)
delete from public.provider_connections c using dropped d where c.id = d.id;

update public.provider_connections
set endpoint_id =
  lower(coalesce(substring(rtrim(fhir_base_url, '/') from '^[A-Za-z][A-Za-z0-9+.-]*://[^/]+'), ''))
  || coalesce(substring(rtrim(fhir_base_url, '/') from '^[A-Za-z][A-Za-z0-9+.-]*://[^/]+(/.*)$'), '');

alter table public.results
  add column connection_id uuid references public.provider_connections (id) on delete cascade;

update public.results r
set connection_id = c.id
from public.provider_connections c
where r.source = 'provider' and r.source_ref like c.id::text || ':%' and r.user_id = c.user_id;

create index results_connection on public.results (connection_id) where connection_id is not null;

comment on column public.results.connection_id is
  'The provider connection a lab came from. Removing the connection removes its labs, and a lab cannot be written for a connection that is gone.';
comment on column public.provider_connections.endpoint_id is
  'Her provider''s FHIR server address, host lowercased and without a trailing slash. One server is one connection, whichever directory row she picked.';

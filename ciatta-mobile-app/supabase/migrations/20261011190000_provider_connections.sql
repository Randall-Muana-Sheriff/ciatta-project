-- Connecting a provider, and what comes back.
--
-- Two tables. One records that she linked a hospital; the other holds what
-- that hospital sent. Both are hers alone, by the same rule every other
-- table here follows: a woman must only ever be able to read her own
-- health information.
--
-- The token columns are the reason this needs care beyond the usual.
--
--   The refresh token is the keys to her chart for six or twelve months.
--   It is never sent to the phone. The app holds a connection id; the
--   edge function holds the token and uses it server side. No select
--   policy exposes these columns to her client, and the grant below is
--   column scoped so a future broadened policy still cannot leak them.
--
--   Nothing here is a secret Ciatta owns. The client is public and uses
--   PKCE, so there is no client secret in this schema, in the app, or in
--   the function. If one ever appears, something has gone wrong.

create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Which endpoint, as the directory gave it. Stored rather than
  -- referenced: a vendor directory changes under us, and a connection
  -- must still say which hospital it was to even after the row it came
  -- from is gone.
  endpoint_id text not null,
  endpoint_name text not null,
  organization text,
  fhir_base_url text not null,
  vendor text not null check (vendor in ('epic', 'cerner', 'athena', 'other')),
  portal_name text,

  -- requested  she started, and has not come back yet
  -- connected  tokens held, nothing fetched yet
  -- active     records have arrived
  -- expired    the refresh token is past its life, she must reconnect
  -- revoked    she disconnected it
  -- error      the provider refused, and last_error says what she is told
  status text not null default 'requested'
    check (status in ('requested', 'connected', 'active', 'expired', 'revoked', 'error')),

  -- Never read by the phone. See the grant below.
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  -- The patient id the provider issued inside their own system, which is
  -- what every subsequent query is scoped to.
  fhir_patient_id text,

  last_synced_at timestamptz,
  last_error text,
  record_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One connection per hospital per person. Reconnecting updates rather
  -- than stacking a second row she would then see twice.
  unique (user_id, endpoint_id)
);

create index provider_connections_user on public.provider_connections (user_id, status);

create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.provider_connections (id) on delete cascade,

  -- Type and id at the provider, so a re sync updates rather than
  -- duplicates. This is why fhirMap refuses a resource with no id.
  source_id text not null,
  kind text not null check (kind in ('lab', 'condition', 'medication', 'allergy', 'immunization', 'procedure', 'vital')),

  -- The provider's own words and the provider's own value, with its unit
  -- already in it. Never recomputed here.
  name text not null,
  value text,
  -- The lab's own flag. Null means the lab did not flag it, which is not
  -- the same as normal, and nothing in the app may render it as normal.
  flag text check (flag is null or flag in ('high', 'low', 'abnormal')),
  effective_on date,
  status text,

  -- The resource as it arrived, kept so a mapping fixed later can be
  -- re run over what was already fetched without asking the hospital
  -- again.
  raw jsonb,

  created_at timestamptz not null default now(),
  unique (user_id, connection_id, source_id)
);

create index clinical_records_user_kind on public.clinical_records (user_id, kind, effective_on desc);

-- ── Row level security ────────────────────────────────────────────────

alter table public.provider_connections enable row level security;
alter table public.clinical_records enable row level security;

create policy provider_connections_own on public.provider_connections
  for select using ((select auth.uid()) = user_id);

comment on policy provider_connections_own on public.provider_connections is
  'Select only, and only her own. Writes are refused to the client entirely: a connection is created and advanced by the edge function holding the tokens, so there is no path by which the app can mark a connection active or point one at a different hospital.';

create policy clinical_records_own on public.clinical_records
  for select using ((select auth.uid()) = user_id);

comment on policy clinical_records_own on public.clinical_records is
  'Select only, and only her own. Nothing the client writes may land here: every row in this table is something a hospital said, and a row the app could insert would be a lab result the app made up.';

-- ── Grants ────────────────────────────────────────────────────────────

-- Column scoped on purpose. Even if a future policy were widened by
-- mistake, the tokens are not in the grant and cannot be selected.
grant select (
  id, user_id, endpoint_id, endpoint_name, organization, fhir_base_url, vendor, portal_name,
  status, fhir_patient_id, last_synced_at, last_error, record_count, created_at, updated_at
) on public.provider_connections to authenticated;

grant select on public.clinical_records to authenticated;

grant all on public.provider_connections to service_role;
grant all on public.clinical_records to service_role;

comment on column public.provider_connections.refresh_token is
  'Six to twelve months of access to her chart. Never granted to authenticated and never sent to the device. Only the edge function reads this, and only to call the provider.';

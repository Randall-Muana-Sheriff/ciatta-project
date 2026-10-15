-- Providers and insurers through Fasten Connect, beside the direct SMART
-- connection.
--
-- A Fasten connection is a row in provider_connections like any other, so
-- its records, labs, removal and the Providers list all work as they do.
-- What differs is how it is reached: Fasten holds the portal tokens, and
-- Ciatta holds only Fasten's id for the connection, used server side with
-- Ciatta's private key. That id is kept from her client, as the tokens are.
--
-- Which person a Fasten connection belongs to is never taken from the app.
-- The fasten-connect function issues a one time external id to her, Fasten
-- echoes it in its signed webhook, and the webhook binds the connection to
-- whoever the external id was issued to.

alter table public.provider_connections
  add column source text not null default 'smart' check (source in ('smart', 'fasten')),
  add column fasten_org_connection_id text unique,
  add column fasten_export_task_id text;

alter table public.provider_connections alter column fhir_base_url drop not null;
alter table public.provider_connections
  add constraint provider_connections_smart_server check (source <> 'smart' or fhir_base_url is not null);

alter table public.provider_connections drop constraint provider_connections_vendor_check;
alter table public.provider_connections
  add constraint provider_connections_vendor_check check (vendor in ('epic', 'cerner', 'athena', 'other', 'fasten'));

-- Added to the column scoped grant. The two Fasten columns are not, so
-- they cannot be selected by her client even by mistake.
grant select (source) on public.provider_connections to authenticated;

comment on column public.provider_connections.fasten_org_connection_id is
  'Fasten''s id for this connection. With Ciatta''s private key it reads her records, so it is never granted to authenticated and never sent to the device.';

-- One per tap of "Other providers and insurers". Service role only.
create table public.fasten_connect_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  external_id text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index fasten_connect_requests_expiry on public.fasten_connect_requests (expires_at);

alter table public.fasten_connect_requests enable row level security;
revoke all on public.fasten_connect_requests from public, anon, authenticated;
grant all on public.fasten_connect_requests to service_role;

-- Webhook ids already handled. Fasten retries a delivery it is not sure
-- landed, and a retry must not import the same export twice over a
-- removal she made in between.
create table public.fasten_webhook_events (
  webhook_id text primary key,
  received_at timestamptz not null default now()
);

alter table public.fasten_webhook_events enable row level security;
revoke all on public.fasten_webhook_events from public, anon, authenticated;
grant all on public.fasten_webhook_events to service_role;

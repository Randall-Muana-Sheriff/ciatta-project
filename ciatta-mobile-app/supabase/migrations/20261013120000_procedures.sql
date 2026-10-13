-- Procedures she adds herself, with the day it happened. Procedures her
-- providers send live in clinical_records; this holds the ones she knows
-- about that no connected provider has sent. The date is what makes a
-- before and after possible, so it is required.
create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  provenance public.provenance not null default 'REPORTED',
  name text not null check (length(trim(name)) > 0),
  performed_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

select public.enable_owner_rls('procedures');
revoke all on public.procedures from anon, authenticated;
grant select, insert, update, delete on public.procedures to authenticated;
grant all on public.procedures to service_role;

-- Her care: the requests she makes of her own clinicians (a refill, labs,
-- her records, a question, a referral) and the clinicians on her care
-- team. Ciatta drafts a request from her record; she sends it herself,
-- through her clinician's portal or by phone, and marks where it stands.
-- Ciatta never contacts anyone. Hers alone under the owner policies.
create table public.care_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  kind text not null check (kind in ('refill', 'labs', 'records', 'question', 'referral')),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null default '' check (length(body) <= 4000),
  clinician text check (clinician is null or length(clinician) <= 120),
  status text not null default 'draft' check (status in ('draft', 'sent', 'answered', 'closed')),
  sent_on date,
  answered_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

select public.enable_owner_rls('care_requests');
revoke all on public.care_requests from anon, authenticated;
grant select, insert, update, delete on public.care_requests to authenticated;
grant all on public.care_requests to service_role;

create table public.care_team (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  name text not null check (length(trim(name)) between 1 and 120),
  role text check (role is null or length(role) <= 120),
  organization text check (organization is null or length(organization) <= 160),
  phone text check (phone is null or length(phone) <= 40),
  email text check (email is null or length(email) <= 200),
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

select public.enable_owner_rls('care_team');
revoke all on public.care_team from anon, authenticated;
grant select, insert, update, delete on public.care_team to authenticated;
grant all on public.care_team to service_role;

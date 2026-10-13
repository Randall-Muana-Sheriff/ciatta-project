-- Referrals she is tracking: who to, why, who referred her, and the steps
-- from referred to seen, each with the day she marked it. Ciatta prepares
-- each next step (what to ask her insurer, what to say when she calls);
-- it never contacts anyone. Hers alone under the owner policies.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  specialty text not null check (length(trim(specialty)) between 1 and 120),
  clinician text check (clinician is null or length(clinician) <= 120),
  reason text check (reason is null or length(reason) <= 500),
  referred_by text check (referred_by is null or length(referred_by) <= 120),
  referred_on date,
  -- { referred?, insurance?, requested?, scheduled?, seen? : ISO day }
  steps jsonb not null default '{}' check (
    jsonb_typeof(steps) = 'object'
    and steps - array['referred', 'insurance', 'requested', 'scheduled', 'seen'] = '{}'::jsonb
  ),
  scheduled_for date,
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

select public.enable_owner_rls('referrals');
revoke all on public.referrals from anon, authenticated;
grant select, insert, update, delete on public.referrals to authenticated;
grant all on public.referrals to service_role;

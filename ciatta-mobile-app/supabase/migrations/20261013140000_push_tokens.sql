-- Her phones, for the push that tells her something changed in her
-- record, and whether she wants it.
--
-- A token is only an address for Expo's push service; it says nothing
-- about her. The intelligence function reads tokens under service_role
-- after a run that found something new or changed, and sends only if
-- notify_findings is on (Profile, Settings, New Findings).
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null check (length(token) between 10 and 300),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

select public.enable_owner_rls('push_tokens');
revoke all on public.push_tokens from anon, authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

alter table public.profiles add column notify_findings boolean not null default true;

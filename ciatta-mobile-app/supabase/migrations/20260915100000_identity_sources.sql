-- Identity and sources: who she is, and where her information comes from.

create type public.source_kind as enum ('apple_health', 'health_connect', 'lab', 'document', 'manual', 'user_report');
create type public.source_status as enum ('requested', 'connected', 'active', 'refused', 'disconnected', 'error', 'unsupported');
create type public.provenance as enum ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED', 'DOCUMENT', 'DERIVED', 'INFERRED', 'RESEARCH');

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Owner only access for a table with a user_id column: she reads and writes
-- her own rows and nobody else's. Used by every later migration.
create function public.enable_owner_rls(t text) returns void
language plpgsql set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', t);
  execute format('create policy "owner select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
  execute format('create policy "owner insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
  execute format('create policy "owner update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  execute format('create policy "owner delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
end $$;
revoke execute on function public.enable_owner_rls(text) from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  cycle_profile jsonb,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "owner select" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "owner update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.health_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.source_kind not null,
  name text not null,
  status public.source_status not null,
  last_synced_at timestamptz,
  error text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, name)
);
create index health_sources_user on public.health_sources (user_id);
select public.enable_owner_rls('health_sources');

-- A new account gets a profile and the source that stands for her own reports.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  full_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
begin
  insert into public.profiles (id, first_name) values (new.id, nullif(split_part(full_name, ' ', 1), ''));
  insert into public.health_sources (user_id, kind, name, status) values (new.id, 'user_report', 'You', 'active');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

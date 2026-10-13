-- Period products she used, and when.
--
-- One row per use: what went in, its size, when, and when it came out with
-- how full it was. How often she changes and at what absorbency is the
-- picture a clinician asks for when judging heavy bleeding, so these are
-- facts she logged, never inferred.
--
-- At most one use is open at a time. The app closes the open use when a
-- new one starts; the partial unique index below makes the database refuse
-- a second open use even if the app ever tried.
create table public.product_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  provenance public.provenance not null default 'REPORTED',
  product text not null check (product in ('Pad', 'Tampon', 'Cup', 'Disc', 'Period underwear')),
  size text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  fullness text check (fullness in ('Not full', 'Partly full', 'Soaked', 'Leaked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  check (ended_at is null or ended_at >= started_at)
);

create unique index product_uses_one_open on public.product_uses (user_id) where ended_at is null;
create index product_uses_user_started on public.product_uses (user_id, started_at desc);

select public.enable_owner_rls('product_uses');
revoke all on public.product_uses from anon, authenticated;
grant select, insert, update, delete on public.product_uses to authenticated;
grant all on public.product_uses to service_role;

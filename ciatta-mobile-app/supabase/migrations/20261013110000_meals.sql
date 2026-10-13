-- Meals she logged, most of them from a photo scan.
--
-- items is the list of foods with each one's estimate and whether she
-- corrected it ({ name, portion, kcal, protein_g, carbs_g, fat_g, at,
-- from: 'estimated' | 'reported' }). The four totals are kept beside it
-- for querying a day. provenance is INFERRED while any figure is still the
-- scan's estimate, REPORTED once every figure is hers. The photo stays on
-- her phone; photo holds only its local reference, as other attachments do.
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  provenance public.provenance not null default 'INFERRED',
  eaten_at timestamptz not null default now(),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  kcal numeric check (kcal >= 0),
  protein_g numeric check (protein_g >= 0),
  carbs_g numeric check (carbs_g >= 0),
  fat_g numeric check (fat_g >= 0),
  photo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  constraint meals_provenance_check check (provenance in ('INFERRED', 'REPORTED'))
);
create index meals_user_eaten on public.meals (user_id, eaten_at desc);

select public.enable_owner_rls('meals');
revoke all on public.meals from anon, authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant all on public.meals to service_role;

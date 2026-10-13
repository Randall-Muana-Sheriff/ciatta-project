-- The weather, air and daylight around her, one row per day.
--
-- Background, never about her body. Written only by the environment
-- server function under service_role, from a rough area the phone rounded
-- to about 10 km; the coordinates are never stored. She reads her rows.
-- Weather and daylight length come from Apple WeatherKit; air quality and
-- pollen from Open-Meteo's air quality API. Pollen is Europe only and is
-- null elsewhere, as is anything a source did not give.
create table public.environment_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  provenance public.provenance not null default 'IMPORTED',
  temp_max_c numeric,
  temp_min_c numeric,
  humidity_mean numeric check (humidity_mean is null or humidity_mean between 0 and 1),
  condition text,
  daylight_minutes numeric check (daylight_minutes is null or daylight_minutes between 0 and 1440),
  pm2_5 numeric check (pm2_5 is null or pm2_5 >= 0),
  us_aqi numeric check (us_aqi is null or us_aqi >= 0),
  pollen_grass numeric check (pollen_grass is null or pollen_grass >= 0),
  pollen_tree numeric check (pollen_tree is null or pollen_tree >= 0),
  pollen_weed numeric check (pollen_weed is null or pollen_weed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.environment_days enable row level security;
create policy "owner select" on public.environment_days for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.environment_days from anon, authenticated;
grant select on public.environment_days to authenticated;
grant all on public.environment_days to service_role;

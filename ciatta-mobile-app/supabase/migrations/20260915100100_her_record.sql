-- Her record: what she reports, notes, takes, and the documents her results came from.
-- Every detail column is nullable. Null means unknown, never none.

create table public.raw_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  input_mode text not null check (input_mode in ('typed', 'spoken', 'selected', 'photo')),
  parse_status text not null default 'pending' check (parse_status in ('pending', 'parsed', 'failed')),
  parser text check (parser in ('ai', 'device')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  source_id uuid references public.health_sources (id) on delete set null,
  provenance public.provenance not null default 'REPORTED',
  raw_input_id uuid references public.raw_inputs (id) on delete set null,
  logged_at timestamptz not null,
  occurred_on date not null,
  occurred_at timestamptz not null,
  kinds text[] not null default '{}',
  period_start date,
  period_end date,
  flow text,
  all_day boolean not null default false,
  start_hour numeric,
  end_hour numeric,
  states text[] not null default '{}',
  pattern text,
  locations text[] not null default '{}',
  sensations text[] not null default '{}',
  severity smallint check (severity between 0 and 10),
  affect text[] not null default '{}',
  trajectory text[] not null default '{}',
  changes text[] not null default '{}',
  day_impact text[] not null default '{}',
  symptoms text[] not null default '{}',
  context text[] not null default '{}',
  triggers text[] not null default '{}',
  flare_up_user_reported boolean,
  helped text[] not null default '{}',
  helped_amount text,
  note text not null default '',
  note_context text[] not null default '{}',
  stool smallint check (stool between 1 and 7),
  bowel_pain text,
  bowel_flags text[] not null default '{}',
  "similar" boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  source_id uuid references public.health_sources (id) on delete set null,
  provenance public.provenance not null default 'REPORTED',
  text text not null,
  kind text not null check (kind in ('Notes', 'Symptoms', 'Context')),
  tag text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.health_sources (id) on delete set null,
  provenance public.provenance not null default 'REPORTED',
  name text not null,
  dose text,
  started_on date,
  stopped_on date,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplements (like public.medications including all);
alter table public.supplements add foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.supplements add foreign key (source_id) references public.health_sources (id) on delete set null;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.health_sources (id) on delete set null,
  provenance public.provenance not null default 'DOCUMENT',
  storage_path text not null,
  title text,
  doc_type text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'extracted', 'failed')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.health_sources (id) on delete set null,
  provenance public.provenance not null default 'IMPORTED',
  document_id uuid references public.documents (id) on delete set null,
  test_name text not null,
  panel text,
  value numeric,
  value_text text,
  unit text,
  reference_low numeric,
  reference_high numeric,
  provider text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (value is not null or value_text is not null)
);

do $$
declare t text;
begin
  foreach t in array array['raw_inputs', 'episodes', 'journal_entries', 'medications', 'supplements', 'documents', 'results'] loop
    perform public.enable_owner_rls(t);
    execute format('create index %I on public.%I (user_id, occurred_at desc)', t || '_user_time', t);
  end loop;
end $$;

-- Views read through her own permissions, so RLS still applies.
create view public.cycle_events with (security_invoker = true) as
  select * from public.episodes where period_start is not null;
create view public.pain_events with (security_invoker = true) as
  select * from public.episodes where 'Pain' = any (kinds);

-- Her documents live under a folder named after her id.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;
create policy "owner reads documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "owner adds documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "owner removes documents" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));

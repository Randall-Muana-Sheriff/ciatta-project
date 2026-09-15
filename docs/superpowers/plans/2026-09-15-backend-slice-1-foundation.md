# Backend Slice 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every person a real, private, persistent record: sign in, her cycle episodes, cycle profile, notes and sources stored in Supabase, a normalized observation for everything she logs, working export and delete, and a demo mode that keeps today's sample data completely separate.

**Architecture:** Three Postgres migrations (identity and sources, her record, observations) with owner only RLS, tested with pgTAP on a local Supabase stack. In the app, a session provider decides the mode (signed out, demo, real) and hands screens a `Repo`: `demoRepo` serves `sample.ts`, `realRepo` reads and writes Supabase. Screens keep their layout; where real data does not exist yet they show a plain empty note instead of sample values.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, `@supabase/supabase-js` 2, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, Supabase CLI with OrbStack, Postgres 17, pgTAP, Deno edge functions, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md` (sections 2, 4, 5.1 to 5.3, 7, 8, 9 Slice 1, 10)

## Global Constraints

- Never use an em dash, en dash or hyphen in user facing copy. Run every remote or templated string through `displayCopy()` in `src/lib/displayCopy.ts` before it renders. Compound words become separate words.
- No product name "Ciatta" in any user facing copy.
- Keep Jost and the current look: new UI reuses `src/ui/kit.tsx` and `src/ui/chrome.tsx` components and `C`, `font`, `GUTTER`, `RADIUS` from `src/theme.ts`.
- Do not change navigation, tabs, screen hierarchy or card architecture.
- Real mode never shows sample data. Demo mode never writes to Supabase.
- Null means unknown. Never write a default value (severity, flow, time) the person did not give.
- The service role key never appears in the app. Only edge functions use it.
- Every schema change is a migration file in `ciatta-mobile-app/supabase/migrations`. Nothing is applied to the live project (`pghlquiwqnknpveyssui`) until Task 11, and Task 11 waits for the user's explicit go ahead.
- Tests: `npm test` (from `ciatta-mobile-app`) for TypeScript; `supabase test db` for SQL. Both must pass at the end of every task.
- Commit after each task with a message ending in:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01JSvawNVMbPeuzNciSz1AGj`.
- Never commit `ciatta-visual-assets/` or `.env`.

## Prerequisite (the user, before Task 1)

OrbStack or Docker Desktop installed and running (`docker info` succeeds). The Supabase CLI is already logged in.

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260915100000_identity_sources.sql` | enums, `touch_updated_at`, `enable_owner_rls`, `profiles`, `health_sources`, new user trigger |
| `supabase/migrations/20260915100100_her_record.sql` | `raw_inputs`, `episodes`, `journal_entries`, `medications`, `supplements`, `documents`, `results`, views, Storage bucket |
| `supabase/migrations/20260915100200_observations.sql` | `observations`, triggers from episodes and journal entries |
| `supabase/tests/*.test.sql` | pgTAP: RLS isolation, cascade, idempotency, observation writing |
| `supabase/functions/delete-account/index.ts` | deletes her Storage files, then her auth user (everything cascades) |
| `src/data/rows.ts` | pure mapping between app types and database rows |
| `src/data/outbox.ts` | episodes that failed to save, retried later |
| `src/data/deviceImport.ts` | one time import of `ciatta.cycle.v1` |
| `src/data/repo.ts` | `Repo` type, `demoRepo`, `realRepo` |
| `src/data/adapter.ts` | `dataFor(mode, firstName)`: what each screen reads in each mode |
| `src/data/account.ts` | export and delete |
| `src/lib/supabase.ts`, `socialAuth.ts`, `googleAuthConfig.ts`, `userFacingError.ts` | restored from `9fe1b55` |
| `src/state/session.tsx` | `SessionProvider`, `useSession`, `useData` |
| `src/screens/SignInScreen.tsx` | Apple, Google, look around first |

---

### Task 1: Local stack and the identity migration

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260915100000_identity_sources.sql`
- Create: `ciatta-mobile-app/supabase/tests/identity.test.sql`
- Create: `ciatta-mobile-app/supabase/seed.sql` (empty file with a comment; `config.toml` already points at it)

**Interfaces:**
- Produces: enums `public.source_kind`, `public.source_status`, `public.provenance`; functions `public.touch_updated_at()`, `public.enable_owner_rls(t text)`; tables `public.profiles`, `public.health_sources`. Every new user gets a profile and a `user_report` source named `You`.

- [ ] **Step 1: Start the local stack**

Run (from `ciatta-mobile-app`): `supabase start`
Expected: prints `API URL: http://127.0.0.1:54321` and a `service_role key`. If it says Docker is not running, stop and report BLOCKED.

- [ ] **Step 2: Write the failing test**

`supabase/tests/identity.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', '{"full_name":"Ada Lovelace"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{}');

select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Ada',
  'a profile is created with the first name from sign in');
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null,
  'no name given means no name stored');
select is((select count(*)::int from public.health_sources
  where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'user_report' and name = 'You'), 1,
  'every person starts with the You source');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'A sees only her own profile');
select is((select count(*)::int from public.health_sources), 1, 'A sees only her own sources');
update public.profiles set first_name = 'Mallory' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok(
  $$ insert into public.health_sources (user_id, kind, name, status)
     values ('00000000-0000-0000-0000-00000000000b', 'manual', 'Sneaky', 'active') $$,
  '42501', null, 'A cannot add a source to B');
select lives_ok(
  $$ insert into public.health_sources (user_id, kind, name, status)
     values ('00000000-0000-0000-0000-00000000000a', 'apple_health', 'Apple Health', 'unsupported') $$,
  'A can add her own source');

reset role;
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null,
  'A could not rename B');

select * from finish();
rollback;
```

- [ ] **Step 3: Run it to verify it fails**

Run: `supabase test db`
Expected: FAIL, `relation "public.profiles" does not exist`.

- [ ] **Step 4: Write the migration**

`supabase/migrations/20260915100000_identity_sources.sql`:

```sql
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
```

`supabase/seed.sql`:

```sql
-- No seed data. Demo mode reads the sample record inside the app, never the database.
```

- [ ] **Step 5: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: `identity.test.sql .. ok`, `All tests successful.`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260915100000_identity_sources.sql supabase/tests/identity.test.sql supabase/seed.sql
git commit -m "Add profiles and health sources with owner only access"
```

---

### Task 2: Her record

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260915100100_her_record.sql`
- Create: `ciatta-mobile-app/supabase/tests/records.test.sql`

**Interfaces:**
- Consumes: `public.enable_owner_rls`, `public.provenance`, `public.health_sources` (Task 1).
- Produces: tables `raw_inputs`, `episodes` (unique `(user_id, client_id)`), `journal_entries` (unique `(user_id, client_id)`), `medications`, `supplements`, `documents`, `results`; views `cycle_events`, `pain_events`; private Storage bucket `documents` with files under `<user id>/`.

`episodes` columns match `EpisodeRow` in Task 4 exactly: `client_id, logged_at, occurred_on, occurred_at, kinds, period_start, period_end, flow, all_day, start_hour, end_hour, states, pattern, locations, sensations, severity, affect, trajectory, changes, day_impact, symptoms, context, triggers, flare_up_user_reported, helped, helped_amount, note, note_context, stool, bowel_pain, bowel_flags, similar, metadata`.

- [ ] **Step 1: Write the failing test**

`supabase/tests/records.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, locations)
  values ('00000000-0000-0000-0000-00000000000a', 'ep-1', now(), '2026-09-14', '2026-09-14T09:00:00Z', '{Pain}', '{Pelvis}')
$$, 'A saves a pain episode with no severity');
select is((select severity from public.episodes where client_id = 'ep-1'), null, 'severity stays unknown');

insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, severity)
values ('00000000-0000-0000-0000-00000000000a', 'ep-1', now(), '2026-09-14', '2026-09-14T09:00:00Z', '{Pain}', 6)
on conflict (user_id, client_id) do update set severity = excluded.severity;
select is((select count(*)::int from public.episodes where client_id = 'ep-1'), 1, 'saving twice keeps one episode');

select is((select count(*)::int from public.pain_events), 1, 'the pain view shows her pain episode');
select is((select count(*)::int from public.cycle_events), 0, 'no bleeding means no cycle event');

select lives_ok($$
  insert into public.journal_entries (user_id, client_id, text, kind, occurred_at)
  values ('00000000-0000-0000-0000-00000000000a', 'j-1', 'Slept badly.', 'Notes', now())
$$, 'A writes a note');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.episodes), 0, 'B cannot see A''s episodes');
select is((select count(*)::int from public.pain_events), 0, 'B cannot see A''s episodes through a view');

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.episodes) + (select count(*)::int from public.journal_entries), 0,
  'deleting the account deletes her record');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: FAIL, `relation "public.episodes" does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260915100100_her_record.sql`:

```sql
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
  similar boolean not null default false,
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
```

- [ ] **Step 4: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: `All tests successful.` (identity and records).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915100100_her_record.sql supabase/tests/records.test.sql
git commit -m "Add her record: episodes, notes, medications, documents, results"
```

---

### Task 3: Observations

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260915100200_observations.sql`
- Create: `ciatta-mobile-app/supabase/tests/observations.test.sql`

**Interfaces:**
- Consumes: `episodes`, `journal_entries`, `health_sources`, `provenance` (Tasks 1 and 2).
- Produces: table `public.observations` (unique `(user_id, dedupe_key)`). Saving, changing or deleting an episode or a note rewrites its observations in the same transaction. Metric names: `cycle/period_start`, `cycle/flow`, `pain/pain_episode`, `gut/stool_type`, `symptom/symptom`, `context/note`. Clients may insert only `MEASURED`, `REPORTED`, `RECORDED` or `IMPORTED`; `DERIVED`, `INFERRED` and `RESEARCH` are written only by the server.

- [ ] **Step 1: Write the failing test**

`supabase/tests/observations.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into public.episodes (user_id, client_id, logged_at, occurred_on, occurred_at, kinds, period_start, flow, locations, symptoms, stool)
values ('00000000-0000-0000-0000-00000000000a', 'ep-1', now(), '2026-09-14', '2026-09-14T09:00:00Z',
        '{Period,Pain,"Bowel movement"}', '2026-09-14', 'Heavy', '{Pelvis}', '{Bloating,Fatigue}', 4);

select is((select count(*)::int from public.observations), 6,
  'period start, flow, pain, stool and two symptoms become observations');
select is((select value from public.observations where metric = 'pain_episode'), null,
  'pain with no severity has no invented value');
select is((select value_text from public.observations where metric = 'pain_episode'), 'Pelvis',
  'pain keeps where she felt it');
select is((select count(*)::int from public.observations where provenance = 'REPORTED' and source_id is not null), 6,
  'every observation is reported and points at the You source');

update public.episodes set severity = 7 where client_id = 'ep-1';
select is((select value from public.observations where metric = 'pain_episode'), 7::numeric,
  'adding severity later updates the observation');
select is((select count(*)::int from public.observations), 6, 'updating does not duplicate');

select throws_ok($$
  insert into public.observations (user_id, domain, metric, value, occurred_at, provenance, dedupe_key)
  values ('00000000-0000-0000-0000-00000000000a', 'cycle', 'cycle_length', 26, now(), 'DERIVED', 'x')
$$, '42501', null, 'a client cannot write a derived observation');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.observations), 0, 'B cannot see A''s observations');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
delete from public.episodes where client_id = 'ep-1';
select is((select count(*)::int from public.observations), 0, 'deleting the episode deletes its observations');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: FAIL, `relation "public.observations" does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260915100200_observations.sql`:

```sql
-- The common language the intelligence reads. Domain tables stay the rich record;
-- each of their rows writes its observations here in the same transaction.

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain text not null,
  metric text not null,
  value numeric,
  value_text text,
  unit text,
  occurred_at timestamptz not null,
  source_id uuid references public.health_sources (id) on delete set null,
  provenance public.provenance not null,
  data_quality text not null default 'ok' check (data_quality in ('ok', 'partial', 'low')),
  origin_table text,
  origin_id uuid,
  dedupe_key text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  check (value is not null or value_text is not null)
);
create index observations_metric on public.observations (user_id, domain, metric, occurred_at desc);
create index observations_origin on public.observations (origin_table, origin_id);
create index observations_source on public.observations (source_id);

alter table public.observations enable row level security;
create policy "owner select" on public.observations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owner adds facts" on public.observations for insert to authenticated
  with check (user_id = (select auth.uid()) and provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED'));
create trigger observations_touch before update on public.observations
  for each row execute function public.touch_updated_at();

create function public.you_source(uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.health_sources where user_id = uid and kind = 'user_report' order by created_at limit 1
$$;

-- Runs with definer rights because the row that fired it already passed her RLS.
create function public.episode_observations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  src uuid;
  s text;
begin
  delete from public.observations where origin_table = 'episodes' and origin_id = old.id;
  if tg_op = 'DELETE' then return old; end if;

  src := public.you_source(new.user_id);

  if new.period_start is not null then
    insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'cycle', 'period_start', new.period_start::text, new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':period_start');
  end if;
  if new.flow is not null then
    insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'cycle', 'flow', new.flow, new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':flow');
  end if;
  if 'Pain' = any (new.kinds) then
    insert into public.observations (user_id, domain, metric, value, value_text, unit, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'pain', 'pain_episode', new.severity, coalesce(nullif(array_to_string(new.locations, ', '), ''), 'Reported'),
            case when new.severity is null then null else 'of 10' end,
            new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':pain_episode');
  end if;
  if new.stool is not null then
    insert into public.observations (user_id, domain, metric, value, unit, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'gut', 'stool_type', new.stool, 'Bristol type', new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':stool_type');
  end if;
  foreach s in array new.symptoms loop
    insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'symptom', 'symptom', s, new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':symptom:' || s);
  end loop;
  return new;
end $$;
create trigger episodes_observations after insert or update or delete on public.episodes
  for each row execute function public.episode_observations();

create function public.journal_observations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.observations where origin_table = 'journal_entries' and origin_id = old.id;
  if tg_op = 'DELETE' then return old; end if;
  insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
  values (new.user_id, 'context', 'note', new.text, new.occurred_at, public.you_source(new.user_id), new.provenance,
          'journal_entries', new.id, 'journal_entries:' || new.id);
  return new;
end $$;
create trigger journal_observations after insert or update or delete on public.journal_entries
  for each row execute function public.journal_observations();
```

Note for the implementer: on `INSERT`, `old` is null, so the first `delete` matches nothing. That is intended.

- [ ] **Step 4: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: `All tests successful.` (three files).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915100200_observations.sql supabase/tests/observations.test.sql
git commit -m "Write a normalized observation for everything she logs"
```

---

### Task 4: Row mapping

**Files:**
- Create: `ciatta-mobile-app/src/data/rows.ts`
- Test: `ciatta-mobile-app/src/data/rows.test.ts`

**Interfaces:**
- Consumes: `Episode`, `normalizeEpisode`, `parseDay`, `shortDate` from `src/data/cycleLog.ts`; `EntryKind`, `SourceKind` from `src/data/sample.ts` (types only).
- Produces:
  - `type EpisodeRow` (columns listed in Task 2)
  - `episodeToRow(e: Episode, extra?: Record<string, unknown>): EpisodeRow`
  - `rowToEpisode(r: EpisodeRow): Episode`
  - `type JournalRow = { client_id: string; text: string; kind: EntryKind; tag: string | null; occurred_at: string }`
  - `type JournalView = { count: number; since: string; months: { month: string; items: { text: string; date: string; tag: string; kind: EntryKind; usedInInsight: boolean }[] }[] }`
  - `journalView(rows: JournalRow[]): JournalView`
  - `type SourceRow = { kind: DbSourceKind; name: string; status: DbSourceStatus; last_synced_at: string | null; created_at: string }`
  - `type SourceView = { name: string; kind: SourceKind; status: string; facts: { label: string; value: string }[] }`
  - `sourceView(r: SourceRow): SourceView`

- [ ] **Step 1: Write the failing tests**

`src/data/rows.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { episodeToRow, journalView, rowToEpisode, sourceView } from './rows';

const now = new Date(2026, 8, 15, 10, 0);

test('an episode survives the round trip to a row and back', () => {
  const ep = formToEpisode(
    { ...emptyForm(), kinds: ['Pain'], day: 1, start: 9.5, locations: ['Pelvis'], severity: null, stool: null },
    false,
    now,
  );
  assert.deepEqual(rowToEpisode(episodeToRow(ep)), ep);
});

test('a known start time sets when it happened', () => {
  const ep = formToEpisode({ ...emptyForm(), kinds: ['Pain'], day: 0, start: 9.5 }, false, now);
  const row = episodeToRow(ep);
  assert.equal(new Date(row.occurred_at).getHours(), 9);
  assert.equal(new Date(row.occurred_at).getMinutes(), 30);
  assert.equal(row.metadata.time_known, true);
});

test('an unknown time is marked as unknown, not invented', () => {
  const ep = formToEpisode({ ...emptyForm(), kinds: ['Period'], periodStart: 2, allDay: true }, false, now);
  const row = episodeToRow(ep, { imported_from: 'device' });
  assert.equal(row.metadata.time_known, false);
  assert.equal(row.metadata.imported_from, 'device');
  assert.equal(row.severity, null);
  assert.equal(row.flow, null);
});

test('notes group by month, newest first', () => {
  const view = journalView([
    { client_id: 'j1', text: 'Stressful stretch at work.', kind: 'Context', tag: null, occurred_at: '2026-03-14T12:00:00Z' },
    { client_id: 'j2', text: 'Slept through four nights.', kind: 'Notes', tag: 'Sleep', occurred_at: '2026-07-03T12:00:00Z' },
  ]);
  assert.equal(view.count, 2);
  assert.equal(view.since, 'Since March');
  assert.deepEqual(view.months.map((m) => m.month), ['July 2026', 'March 2026']);
  assert.deepEqual(view.months[0].items[0], {
    text: 'Slept through four nights.', date: '3 Jul', tag: 'Sleep', kind: 'Notes', usedInInsight: false,
  });
  assert.equal(view.months[1].items[0].tag, 'Context');
});

test('no notes reads as no notes', () => {
  assert.deepEqual(journalView([]), { count: 0, since: 'No entries yet', months: [] });
});

test('a source row reads the way Profile shows sources', () => {
  const v = sourceView({ kind: 'user_report', name: 'You', status: 'active', last_synced_at: null, created_at: '2026-09-15T08:00:00Z' });
  assert.deepEqual(v, {
    name: 'You', kind: 'logged', status: 'Active',
    facts: [{ label: 'Since', value: '15 Sep' }, { label: 'Last updated', value: 'Not yet' }],
  });
  assert.equal(sourceView({ kind: 'apple_health', name: 'Apple Health', status: 'unsupported', last_synced_at: null, created_at: '2026-09-15T08:00:00Z' }).status, 'Not available yet');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module './rows'`.

- [ ] **Step 3: Implement**

`src/data/rows.ts`:

```ts
import { type Episode, normalizeEpisode, parseDay, shortDate } from './cycleLog';
import type { EntryKind, SourceKind } from './sample';

// The shapes the database stores, and the app types they come from. Pure, so
// both modes and the tests share one mapping.

export type EpisodeRow = {
  client_id: string;
  logged_at: string;
  occurred_on: string;
  occurred_at: string;
  kinds: string[];
  period_start: string | null;
  period_end: string | null;
  flow: string | null;
  all_day: boolean;
  start_hour: number | null;
  end_hour: number | null;
  states: string[];
  pattern: string | null;
  locations: string[];
  sensations: string[];
  severity: number | null;
  affect: string[];
  trajectory: string[];
  changes: string[];
  day_impact: string[];
  symptoms: string[];
  context: string[];
  triggers: string[];
  flare_up_user_reported: boolean | null;
  helped: string[];
  helped_amount: string | null;
  note: string;
  note_context: string[];
  stool: number | null;
  bowel_pain: string | null;
  bowel_flags: string[];
  similar: boolean;
  metadata: Record<string, unknown>;
};

const HOUR = 3600000;

// When the time is unknown the row still needs a moment to sort by; midday of
// the day she gave, marked as unknown so nothing reads it as a real time.
export function episodeToRow(e: Episode, extra: Record<string, unknown> = {}): EpisodeRow {
  const timeKnown = !e.allDay && e.start != null;
  const at = new Date(parseDay(e.date).getTime() + (timeKnown ? (e.start as number) : 12) * HOUR);
  return {
    client_id: e.id,
    logged_at: e.loggedAt,
    occurred_on: e.date,
    occurred_at: at.toISOString(),
    kinds: e.kinds,
    period_start: e.periodStart,
    period_end: e.periodEnd,
    flow: e.flow,
    all_day: e.allDay,
    start_hour: e.start,
    end_hour: e.end,
    states: e.states,
    pattern: e.pattern,
    locations: e.locations,
    sensations: e.sensations,
    severity: e.severity,
    affect: e.affect,
    trajectory: e.trajectory,
    changes: e.changes,
    day_impact: e.dayImpact,
    symptoms: e.symptoms,
    context: e.context,
    triggers: e.triggers,
    flare_up_user_reported: e.flareUpUserReported,
    helped: e.helped,
    helped_amount: e.helpedAmount,
    note: e.note,
    note_context: e.noteContext,
    stool: e.stool,
    bowel_pain: e.bowelPain,
    bowel_flags: e.bowelFlags,
    similar: e.similar,
    metadata: { ...extra, time_known: timeKnown },
  };
}

export function rowToEpisode(r: EpisodeRow): Episode {
  return normalizeEpisode({
    id: r.client_id,
    loggedAt: new Date(r.logged_at).toISOString(),
    date: r.occurred_on,
    kinds: r.kinds,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    flow: r.flow,
    allDay: r.all_day,
    start: r.start_hour == null ? null : Number(r.start_hour),
    end: r.end_hour == null ? null : Number(r.end_hour),
    states: r.states,
    pattern: r.pattern,
    locations: r.locations,
    sensations: r.sensations,
    severity: r.severity,
    affect: r.affect,
    trajectory: r.trajectory,
    changes: r.changes,
    dayImpact: r.day_impact,
    symptoms: r.symptoms,
    context: r.context,
    triggers: r.triggers,
    flareUpUserReported: r.flare_up_user_reported,
    helped: r.helped,
    helpedAmount: r.helped_amount,
    note: r.note,
    noteContext: r.note_context,
    stool: r.stool,
    bowelPain: r.bowel_pain,
    bowelFlags: r.bowel_flags,
    similar: r.similar,
  });
}

// ── Notes ──────────────────────────────────────────────────────

export type JournalRow = { client_id: string; text: string; kind: EntryKind; tag: string | null; occurred_at: string };

export type JournalView = {
  count: number;
  since: string;
  months: { month: string; items: { text: string; date: string; tag: string; kind: EntryKind; usedInInsight: boolean }[] }[];
};

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function journalView(rows: JournalRow[]): JournalView {
  if (rows.length === 0) return { count: 0, since: 'No entries yet', months: [] };
  const sorted = [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const months: JournalView['months'] = [];
  for (const r of sorted) {
    const d = new Date(r.occurred_at);
    const month = `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
    let group = months.find((m) => m.month === month);
    if (!group) {
      group = { month, items: [] };
      months.push(group);
    }
    group.items.push({ text: r.text, date: shortDate(d), tag: r.tag ?? r.kind, kind: r.kind, usedInInsight: false });
  }
  const oldest = new Date(sorted[sorted.length - 1].occurred_at);
  return { count: rows.length, since: `Since ${MONTHS_LONG[oldest.getMonth()]}`, months };
}

// ── Sources ────────────────────────────────────────────────────

export type DbSourceKind = 'apple_health' | 'health_connect' | 'lab' | 'document' | 'manual' | 'user_report';
export type DbSourceStatus = 'requested' | 'connected' | 'active' | 'refused' | 'disconnected' | 'error' | 'unsupported';

export type SourceRow = { kind: DbSourceKind; name: string; status: DbSourceStatus; last_synced_at: string | null; created_at: string };
export type SourceView = { name: string; kind: SourceKind; status: string; facts: { label: string; value: string }[] };

const KIND_VIEW: Record<DbSourceKind, SourceKind> = {
  apple_health: 'measured',
  health_connect: 'measured',
  lab: 'lab',
  document: 'lab',
  manual: 'logged',
  user_report: 'logged',
};

const STATUS_LABEL: Record<DbSourceStatus, string> = {
  requested: 'Requested',
  connected: 'Connected',
  active: 'Active',
  refused: 'Refused',
  disconnected: 'Disconnected',
  error: 'Needs attention',
  unsupported: 'Not available yet',
};

export function sourceView(r: SourceRow): SourceView {
  return {
    name: r.name,
    kind: KIND_VIEW[r.kind],
    status: STATUS_LABEL[r.status],
    facts: [
      { label: 'Since', value: shortDate(new Date(r.created_at)) },
      { label: 'Last updated', value: r.last_synced_at ? shortDate(new Date(r.last_synced_at)) : 'Not yet' },
    ],
  };
}
```

If `EntryKind` or `SourceKind` is not exported from `sample.ts`, export it there (a type only change).

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass (71 existing plus 6 new). If the round trip test fails on `loggedAt`, check that `formToEpisode` writes `toISOString()`; the mapping normalizes the database format back to it.

- [ ] **Step 5: Commit**

```bash
git add src/data/rows.ts src/data/rows.test.ts src/data/sample.ts
git commit -m "Map episodes, notes and sources to database rows"
```

---

### Task 5: Restore the Supabase client and sign in helpers

**Files:**
- Create: `ciatta-mobile-app/src/lib/supabase.ts`
- Create: `ciatta-mobile-app/src/lib/socialAuth.ts`
- Create: `ciatta-mobile-app/src/lib/googleAuthConfig.ts`
- Create: `ciatta-mobile-app/src/lib/userFacingError.ts`
- Test: `ciatta-mobile-app/src/lib/googleAuthConfig.test.ts`, `ciatta-mobile-app/src/lib/userFacingError.test.ts`

**Interfaces:**
- Produces: `supabase` (client), `signInWithApple(): Promise<{ fullName: string | null }>`, `signInWithGoogle(): Promise<{ fullName: string | null }>`, `isAppleSignInAvailable(): Promise<boolean>`, `class SocialAuthCancelled`, `userFacingError(error: unknown, fallback: string): string`.

- [ ] **Step 1: Restore the files from git**

```bash
git show 9fe1b55:ciatta-mobile-app/src/lib/googleAuthConfig.ts > src/lib/googleAuthConfig.ts
git show 9fe1b55:ciatta-mobile-app/src/lib/googleAuthConfig.test.ts > src/lib/googleAuthConfig.test.ts
git show 9fe1b55:ciatta-mobile-app/src/lib/userFacingError.ts > src/lib/userFacingError.ts
git show 9fe1b55:ciatta-mobile-app/src/lib/socialAuth.ts > src/lib/socialAuth.ts
```

- [ ] **Step 2: Convert the restored test to node:test**

Open `src/lib/googleAuthConfig.test.ts`. If it doesn't use `import { test } from 'node:test'` and `node:assert/strict`, rewrite its cases in that style, keeping every case. Then run `npm test` and expect the googleAuthConfig cases to pass.

- [ ] **Step 3: Write the userFacingError tests**

`src/lib/userFacingError.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { userFacingError } from './userFacingError';

test('technical failures never reach the screen', () => {
  assert.equal(userFacingError(new Error('PGRST301 JWT expired'), 'That did not save.'), 'That did not save.');
  assert.equal(userFacingError({ message: 'new row violates row-level security policy' }, 'That did not save.'), 'That did not save.');
});

test('a lost connection says what to do', () => {
  assert.equal(userFacingError(new Error('Network request failed'), 'x'), 'Check your connection and try again.');
});

test('a cancel is not an error', () => {
  assert.equal(userFacingError(new Error('The user canceled the sign in'), 'x'), '');
});

test('fallback copy has no dashes', () => {
  assert.equal(userFacingError('', 'Sign in did not finish — try again.').includes('—'), false);
});
```

- [ ] **Step 4: Write the client**

`src/lib/supabase.ts`:

```ts
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and restart Metro.');
}

// The anon key is public by design; Row Level Security keeps each record private.
export const supabase = createClient(url, anonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

- [ ] **Step 5: Trim socialAuth to what this app uses**

In `src/lib/socialAuth.ts`, delete `seedProfileName` (Task 7 seeds the name). Keep `SocialAuthCancelled`, `isAppleSignInAvailable`, `signInWithApple`, `signInWithGoogle`. Replace the em dashes in comments with commas. Confirm the imports resolve: `./supabase`, `./googleAuthConfig`, `./userFacingError`, and `./displayCopy` inside userFacingError.

- [ ] **Step 6: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts src/lib/socialAuth.ts src/lib/googleAuthConfig.ts src/lib/googleAuthConfig.test.ts src/lib/userFacingError.ts src/lib/userFacingError.test.ts
git commit -m "Restore the Supabase client and Apple and Google sign in"
```

---

### Task 6: Repo, outbox and device import

**Files:**
- Create: `ciatta-mobile-app/src/data/outbox.ts`, `src/data/deviceImport.ts`, `src/data/repo.ts`
- Test: `ciatta-mobile-app/src/data/outbox.test.ts`, `src/data/deviceImport.test.ts`, `src/data/repo.test.ts`

**Interfaces:**
- Consumes: everything in `rows.ts` (Task 4); `normalizeProfile`, `CycleProfile` from `src/lib/cycleProfile.ts`; `journal`, `sources` from `sample.ts`.
- Produces:
  - `type KV = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void> }`
  - `enqueue(kv: KV, e: Episode): Promise<void>`, `flush(kv: KV, save: (e: Episode) => Promise<void>): Promise<number>`, `OUTBOX_KEY = 'ciatta.outbox.v1'`
  - `importDeviceRecord(kv: KV, save: (e: Episode, extra: Record<string, unknown>) => Promise<void>, saveProfile: (p: CycleProfile) => Promise<void>): Promise<number>`, `DEVICE_KEY = 'ciatta.cycle.v1'`, `IMPORTED_KEY = 'ciatta.cycle.v1.imported'`
  - `type Repo`, `demoRepo(): Repo`, `realRepo(db: SupabaseClient, userId: string): Repo`

```ts
export type Repo = {
  mode: 'demo' | 'real';
  loadEpisodes(): Promise<Episode[]>;
  saveEpisode(e: Episode, extra?: Record<string, unknown>): Promise<void>;
  loadCycleProfile(): Promise<CycleProfile | null>;
  saveCycleProfile(p: CycleProfile): Promise<void>;
  loadJournal(): Promise<JournalView>;
  addJournal(text: string, kind: EntryKind): Promise<void>;
  loadSources(): Promise<SourceView[]>;
  firstName(): Promise<string | null>;
};
```

- [ ] **Step 1: Write the failing tests**

`src/data/outbox.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { enqueue, flush, type KV, OUTBOX_KEY } from './outbox';

export function memoryKV(seed: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => void (data[k] = v),
    removeItem: async (k) => void delete data[k],
  };
}

const ep = (ms: number) => formToEpisode({ ...emptyForm(), kinds: ['Pain'] }, false, new Date(ms));

test('a failed save waits once, however often it is queued', async () => {
  const kv = memoryKV();
  await enqueue(kv, ep(1));
  await enqueue(kv, ep(1));
  assert.equal(JSON.parse(kv.data[OUTBOX_KEY]).length, 1);
});

test('flush sends what it can and keeps the rest', async () => {
  const kv = memoryKV();
  await enqueue(kv, ep(1));
  await enqueue(kv, ep(2));
  const sent = await flush(kv, async (e) => {
    if (e.id === 'ep-2') throw new Error('offline');
  });
  assert.equal(sent, 1);
  assert.deepEqual(JSON.parse(kv.data[OUTBOX_KEY]).map((e: { id: string }) => e.id), ['ep-2']);
  assert.equal(await flush(kv, async () => {}), 1);
  assert.equal(kv.data[OUTBOX_KEY], undefined);
});
```

`src/data/deviceImport.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { DEVICE_KEY, IMPORTED_KEY, importDeviceRecord } from './deviceImport';
import { memoryKV } from './outbox.test';

const own = formToEpisode({ ...emptyForm(), kinds: ['Period'], periodStart: 3 }, false, new Date(2026, 8, 15));
const saved = JSON.stringify({ episodes: [own, { ...own, id: 'sample-3' }], profile: { situations: [] } });

test('her own episodes are imported once, sample ones never', async () => {
  const kv = memoryKV({ [DEVICE_KEY]: saved });
  const got: { id: string; extra: Record<string, unknown> }[] = [];
  const n = await importDeviceRecord(kv, async (e, extra) => void got.push({ id: e.id, extra }), async () => {});
  assert.equal(n, 1);
  assert.deepEqual(got, [{ id: own.id, extra: { imported_from: 'device' } }]);
  assert.equal(kv.data[DEVICE_KEY], undefined);
  assert.equal(kv.data[IMPORTED_KEY], saved);
  assert.equal(await importDeviceRecord(kv, async () => assert.fail('imported twice'), async () => {}), 0);
});

test('a failed import keeps the device record for next time', async () => {
  const kv = memoryKV({ [DEVICE_KEY]: saved });
  await assert.rejects(importDeviceRecord(kv, async () => { throw new Error('offline'); }, async () => {}));
  assert.equal(kv.data[DEVICE_KEY], saved);
});
```

`src/data/repo.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { demoRepo } from './repo';
import { journal, sources } from './sample';

test('demo mode serves the sample and keeps writes in memory', async () => {
  const repo = demoRepo();
  assert.equal(repo.mode, 'demo');
  assert.deepEqual(await repo.loadSources(), sources);
  assert.equal((await repo.loadJournal()).count, journal.count);
  await repo.addJournal('Tired today.', 'Notes');
  assert.equal((await repo.loadJournal()).count, journal.count + 1);
  const ep = formToEpisode({ ...emptyForm(), kinds: ['Pain'] }, false, new Date(2026, 8, 15));
  await repo.saveEpisode(ep);
  assert.deepEqual((await repo.loadEpisodes()).map((e) => e.id), [ep.id]);
  assert.equal(await repo.firstName(), 'Maya');
  assert.equal(demoRepo().mode, 'demo');
  assert.deepEqual(await demoRepo().loadEpisodes(), [], 'a fresh demo starts clean');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL, missing modules `./outbox`, `./deviceImport`, `./repo`.

- [ ] **Step 3: Implement the outbox and import**

`src/data/outbox.ts`:

```ts
import type { Episode } from './cycleLog';

// Storage with the AsyncStorage shape, so tests can pass a plain object.
export type KV = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Episodes that could not be saved yet. Saving is an upsert on the episode's
// own id, so sending one twice is harmless.
export const OUTBOX_KEY = 'ciatta.outbox.v1';

async function read(kv: KV): Promise<Episode[]> {
  const raw = await kv.getItem(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as Episode[]) : [];
}

export async function enqueue(kv: KV, e: Episode): Promise<void> {
  const list = await read(kv);
  if (!list.some((x) => x.id === e.id)) await kv.setItem(OUTBOX_KEY, JSON.stringify([...list, e]));
}

export async function flush(kv: KV, save: (e: Episode) => Promise<void>): Promise<number> {
  const list = await read(kv);
  const left: Episode[] = [];
  for (const e of list) {
    try {
      await save(e);
    } catch {
      left.push(e);
    }
  }
  if (left.length) await kv.setItem(OUTBOX_KEY, JSON.stringify(left));
  else await kv.removeItem(OUTBOX_KEY);
  return list.length - left.length;
}
```

`src/data/deviceImport.ts`:

```ts
import { type CycleProfile, normalizeProfile } from '../lib/cycleProfile';
import { type Episode, normalizeEpisode } from './cycleLog';
import type { KV } from './outbox';

// What this phone saved before accounts existed. Imported once into her real
// record, then kept under another key so it is never imported twice.
export const DEVICE_KEY = 'ciatta.cycle.v1';
export const IMPORTED_KEY = 'ciatta.cycle.v1.imported';

export async function importDeviceRecord(
  kv: KV,
  save: (e: Episode, extra: Record<string, unknown>) => Promise<void>,
  saveProfile: (p: CycleProfile) => Promise<void>,
): Promise<number> {
  const raw = await kv.getItem(DEVICE_KEY);
  if (!raw) return 0;
  const saved = JSON.parse(raw) as { episodes?: Episode[]; profile?: unknown };
  const episodes = (saved.episodes ?? []).filter((e) => !e.id.startsWith('sample-')).map(normalizeEpisode);
  for (const e of episodes) await save(e, { imported_from: 'device' });
  const profile = normalizeProfile(saved.profile);
  if (profile) await saveProfile(profile);
  await kv.setItem(IMPORTED_KEY, raw);
  await kv.removeItem(DEVICE_KEY);
  return episodes.length;
}
```

- [ ] **Step 4: Implement the repo**

`src/data/repo.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import { type CycleProfile, normalizeProfile } from '../lib/cycleProfile';
import type { Episode } from './cycleLog';
import { episodeToRow, type EpisodeRow, type JournalRow, type JournalView, journalView, rowToEpisode, type SourceRow, sourceView, type SourceView } from './rows';
import { type EntryKind, journal, person, sources } from './sample';

// Where screens get their record. Demo serves the sample person and keeps
// nothing; real reads and writes her own rows, protected by RLS.
export type Repo = {
  mode: 'demo' | 'real';
  loadEpisodes(): Promise<Episode[]>;
  saveEpisode(e: Episode, extra?: Record<string, unknown>): Promise<void>;
  loadCycleProfile(): Promise<CycleProfile | null>;
  saveCycleProfile(p: CycleProfile): Promise<void>;
  loadJournal(): Promise<JournalView>;
  addJournal(text: string, kind: EntryKind): Promise<void>;
  loadSources(): Promise<SourceView[]>;
  firstName(): Promise<string | null>;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function demoRepo(): Repo {
  let own: Episode[] = [];
  let view: JournalView = journal;
  return {
    mode: 'demo',
    loadEpisodes: async () => own,
    saveEpisode: async (e) => {
      own = [...own.filter((x) => x.id !== e.id), e];
    },
    loadCycleProfile: async () => null,
    saveCycleProfile: async () => {},
    loadJournal: async () => view,
    addJournal: async (text, kind) => {
      const d = new Date();
      const month = `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
      const item = { text, date: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`, tag: kind, kind, usedInInsight: false };
      const rest = view.months.filter((m) => m.month !== month);
      const current = view.months.find((m) => m.month === month);
      view = { ...view, count: view.count + 1, months: [{ month, items: [item, ...(current?.items ?? [])] }, ...rest] };
    },
    loadSources: async () => sources,
    firstName: async () => person.firstName,
  };
}

function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

export function realRepo(db: SupabaseClient, userId: string): Repo {
  return {
    mode: 'real',
    async loadEpisodes() {
      const rows = must(await db.from('episodes').select('*').order('occurred_at')) as EpisodeRow[];
      return rows.map(rowToEpisode);
    },
    async saveEpisode(e, extra = {}) {
      must(await db.from('episodes').upsert({ ...episodeToRow(e, extra), user_id: userId }, { onConflict: 'user_id,client_id' }));
    },
    async loadCycleProfile() {
      const row = must(await db.from('profiles').select('cycle_profile').eq('id', userId).maybeSingle()) as { cycle_profile: unknown } | null;
      return normalizeProfile(row?.cycle_profile);
    },
    async saveCycleProfile(p) {
      must(await db.from('profiles').update({ cycle_profile: p }).eq('id', userId));
    },
    async loadJournal() {
      const rows = must(await db.from('journal_entries').select('client_id, text, kind, tag, occurred_at')) as JournalRow[];
      return journalView(rows);
    },
    async addJournal(text, kind) {
      must(await db.from('journal_entries').insert({ user_id: userId, client_id: `j-${Date.now()}`, text, kind, occurred_at: new Date().toISOString() }));
    },
    async loadSources() {
      const rows = must(await db.from('health_sources').select('kind, name, status, last_synced_at, created_at').order('created_at')) as SourceRow[];
      return rows.map(sourceView);
    },
    async firstName() {
      const row = must(await db.from('profiles').select('first_name').eq('id', userId).maybeSingle()) as { first_name: string | null } | null;
      return row?.first_name ?? null;
    },
  };
}
```

If `normalizeProfile` returns `null` for `undefined` input it already fits `CycleProfile | null`. If its return type differs, adapt only the call sites here.

- [ ] **Step 5: Run the tests**

Run: `npx tsc --noEmit && npm test`
Expected: all pass. `repo.test.ts` must not import `src/lib/supabase.ts` (it would need the React Native runtime); `repo.ts` imports only the `SupabaseClient` type.

- [ ] **Step 6: Commit**

```bash
git add src/data/outbox.ts src/data/outbox.test.ts src/data/deviceImport.ts src/data/deviceImport.test.ts src/data/repo.ts src/data/repo.test.ts
git commit -m "Add demo and real record access, with a retry outbox and a one time device import"
```

---

### Task 7: Session, sign in screen and the gate

**Files:**
- Create: `ciatta-mobile-app/src/state/session.tsx`
- Create: `ciatta-mobile-app/src/screens/SignInScreen.tsx`
- Modify: `ciatta-mobile-app/App.tsx`

**Interfaces:**
- Consumes: `supabase`, `signInWithApple`, `signInWithGoogle`, `isAppleSignInAvailable`, `SocialAuthCancelled`, `userFacingError` (Task 5); `demoRepo`, `realRepo`, `Repo` (Task 6).
- Produces:
  - `type Mode = 'loading' | 'signedOut' | 'demo' | 'real'`
  - `SessionProvider`
  - `useSession(): { mode: Mode; userId: string | null; repo: Repo | null; firstName: string | null; enterDemo(): void; signOut(): Promise<void> }`
  - `useRepo(): Repo` (throws outside a demo or real session)

- [ ] **Step 1: Write the session provider**

`src/state/session.tsx`:

```tsx
import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { demoRepo, realRepo, type Repo } from '../data/repo';
import { supabase } from '../lib/supabase';

export type Mode = 'loading' | 'signedOut' | 'demo' | 'real';

type SessionValue = {
  mode: Mode;
  userId: string | null;
  repo: Repo | null;
  firstName: string | null;
  enterDemo: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

// One place decides whose record the app is showing: nobody yet, the example
// person, or hers.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [demo, setDemo] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const repo = useMemo(() => (demo ? demoRepo() : userId ? realRepo(supabase, userId) : null), [demo, userId]);
  const mode: Mode = demo ? 'demo' : session === undefined ? 'loading' : userId ? 'real' : 'signedOut';

  useEffect(() => {
    setFirstName(null);
    repo?.firstName().then(setFirstName).catch(() => {});
  }, [repo]);

  const value = useMemo<SessionValue>(
    () => ({
      mode,
      userId,
      repo,
      firstName,
      enterDemo: () => setDemo(true),
      signOut: async () => {
        if (demo) setDemo(false);
        else await supabase.auth.signOut();
      },
    }),
    [mode, userId, repo, firstName, demo],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export function useRepo(): Repo {
  const { repo } = useSession();
  if (!repo) throw new Error('useRepo needs a demo or signed in session');
  return repo;
}
```

- [ ] **Step 2: Write the sign in screen**

`src/screens/SignInScreen.tsx`:

```tsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle, SocialAuthCancelled } from '../lib/socialAuth';
import { supabase } from '../lib/supabase';
import { userFacingError } from '../lib/userFacingError';
import { useSession } from '../state/session';
import { C, font, GUTTER, RADIUS } from '../theme';
import { TextButton } from '../ui/chrome';
import { images } from '../ui/images';
import { SecondaryButton } from '../ui/kit';

// Apple only gives a name the first time, so it is kept straight away, and
// never over a name she already has.
async function keepFirstName(fullName: string | null) {
  const first = fullName?.trim().split(' ')[0];
  const { data } = await supabase.auth.getUser();
  if (!first || !data.user) return;
  await supabase.from('profiles').update({ first_name: first }).eq('id', data.user.id).is('first_name', null);
}

export function SignInScreen() {
  const { enterDemo } = useSession();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    isAppleSignInAvailable().then(setApple);
  }, []);

  const run = (signIn: () => Promise<{ fullName: string | null }>) => async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { fullName } = await signIn();
      await keepFirstName(fullName);
    } catch (e) {
      if (!(e instanceof SocialAuthCancelled)) setError(userFacingError(e, 'That sign in did not go through. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.body}>
      <View style={s.hero} pointerEvents="none">
        <Image source={images.horizon} style={s.heroImg} resizeMode="cover" />
      </View>
      <View style={s.pad}>
        <Text style={[font('title1'), { color: C.text }]} accessibilityRole="header">
          Keep what you log
        </Text>
        <Text style={[font('body'), s.lede]}>
          Sign in so your cycles, notes and sources are saved to a record only you can see, and carried forward each time you come back.
        </Text>
        <View style={s.buttons}>
          {apple ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={RADIUS}
              style={s.apple}
              onPress={run(signInWithApple)}
            />
          ) : null}
          <SecondaryButton label="Continue with Google" onPress={run(signInWithGoogle)} />
        </View>
        {error ? (
          <Text style={[font('footnote'), s.error]} accessibilityLiveRegion="polite">
            {displayCopy(error)}
          </Text>
        ) : null}
        <View style={s.demo}>
          <Text style={[font('footnote'), { color: C.secondary }]}>Not ready? See how it works with an example person. Nothing you do there is saved.</Text>
          <TextButton label="Look Around First" onPress={enterDemo} />
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  body: { paddingBottom: 48, flexGrow: 1, justifyContent: 'flex-end' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  heroImg: { width: '100%', height: '100%', opacity: 0.5 },
  pad: { paddingHorizontal: GUTTER, paddingTop: 280 },
  lede: { color: C.secondary, marginTop: 10, lineHeight: 25 },
  buttons: { gap: 12, marginTop: 28 },
  apple: { height: 50 },
  error: { color: C.tint, marginTop: 12 },
  demo: { marginTop: 32, gap: 6, alignItems: 'flex-start' },
});
```

- [ ] **Step 3: Gate the app**

In `App.tsx`, replace the returned tree and imports:

```tsx
import { View } from 'react-native';

import { Root } from './src/Root';
import { SignInScreen } from './src/screens/SignInScreen';
import { CycleStoreProvider } from './src/state/cycleStore';
import { SessionProvider, useSession } from './src/state/session';
import { C } from './src/theme';

// Signed out sees sign in; the example person and her own record each get a
// fresh store, so nothing carries from one into the other.
function Gate() {
  const { mode, userId } = useSession();
  if (mode === 'loading') return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (mode === 'signedOut') return <SignInScreen />;
  return (
    <CycleStoreProvider key={`${mode}:${userId ?? ''}`}>
      <Root />
    </CycleStoreProvider>
  );
}
```

and render:

```tsx
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
```

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no errors; all tests pass.

- [ ] **Step 5: Look at it**

Run the app in the iOS simulator (Metro is already running, or run `npx expo start`). The sign in screen shows. Tap Look Around First: the tabs open on the sample person exactly as before. Take one screenshot of each and include the paths in the report.

- [ ] **Step 6: Commit**

```bash
git add src/state/session.tsx src/screens/SignInScreen.tsx App.tsx
git commit -m "Add sign in, a demo mode, and a session gate"
```

---

### Task 8: Real mode never shows sample data

**Files:**
- Create: `ciatta-mobile-app/src/data/adapter.ts`, `src/data/adapter.test.ts`
- Modify: `src/lib/engine.ts` (only if Step 2 fails), `src/lib/engine.test.ts`
- Modify: `src/state/session.tsx` (add `useData`)
- Modify: `src/state/insights.ts`, `src/state/cycleStore.tsx` (only the `loadDays` line and sample intervention), `src/screens/TodayScreen.tsx`, `MyHealthScreen.tsx`, `SleepScreen.tsx`, `SymptomsScreen.tsx`, `MedicationsScreen.tsx`, `HealthRecordsScreen.tsx`, `InsightScreen.tsx`, `JourneyScreen.tsx`, `ProfileScreen.tsx` (identity and overview only), `src/ui/HealthDashboard.tsx`, `src/ui/BodySystemView.tsx`
- Modify: `src/ui/kit.tsx` (add `EmptyNote`)

**Interfaces:**
- Consumes: `useSession` (Task 7).
- Produces:
  - `type Data = { mode: 'demo' | 'real'; days: Day[]; person: { firstName: string } | null; today: TodayCopy; records: typeof records | null; sleep: typeof sleep | null; symptoms: typeof symptoms | null; medications: typeof medications | null; journey: typeof journey | null; insight: typeof insight | null; profile: typeof profile | null }`
  - `dataFor(mode: 'demo' | 'real', firstName: string | null): Data`
  - `useData(): Data` exported from `src/state/session.tsx`
  - `EmptyNote({ text }: { text: string })` in `src/ui/kit.tsx`

- [ ] **Step 1: Write the failing tests**

`src/data/adapter.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dataFor } from './adapter';
import { loadDays } from './daily';
import * as sample from './sample';

test('real mode carries no sample data', () => {
  const d = dataFor('real', 'Ada');
  assert.deepEqual(d.days, []);
  for (const key of ['records', 'sleep', 'symptoms', 'medications', 'journey', 'insight', 'profile'] as const) {
    assert.equal(d[key], null, `${key} must be empty in real mode`);
  }
  assert.deepEqual(d.person, { firstName: 'Ada' });
  assert.notEqual(d.today.headline, sample.today.headline);
});

test('real mode without a name greets without one', () => {
  assert.equal(dataFor('real', null).person, null);
});

test('demo mode is the sample, unchanged', () => {
  const d = dataFor('demo', null);
  assert.equal(d.days, loadDays());
  assert.equal(d.records, sample.records);
  assert.equal(d.today, sample.today);
  assert.equal(d.person?.firstName, sample.person.firstName);
});
```

Append to `src/lib/engine.test.ts`:

```ts
test('with no data the engine says only the opening line', () => {
  const out = buildInsights({
    days: [], episodes: [], windows: [], summaries: [], signals: [], cycleObservations: [],
    draws: [], interventions: [], watching: {}, opening: 'Nothing to compare yet.',
  });
  assert.deepEqual(out.ranked, []);
  assert.equal(out.today.lead, null);
  assert.equal(out.today.text, 'Nothing to compare yet.');
});
```

(Adjust the imports at the top of `engine.test.ts` if `buildInsights` isn't already imported. If `EngineInput` needs other required fields, pass their empty values.)

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL for `./adapter` missing. The engine test may pass already; if it throws (for example `Math.min` over an empty list in `sustained` or `movementSummary`), fix the engine so every function returns its empty or null result for empty input. Change nothing else.

- [ ] **Step 3: Implement the adapter**

`src/data/adapter.ts`:

```ts
import { type Day, loadDays } from './daily';
import * as sample from './sample';

// What each screen reads, per mode. Demo is the sample person; real is only
// what her record holds, and a piece her record can't supply yet is null.
export type TodayCopy = typeof sample.today;

export type Data = {
  mode: 'demo' | 'real';
  days: Day[];
  person: { firstName: string } | null;
  today: TodayCopy;
  records: typeof sample.records | null;
  sleep: typeof sample.sleep | null;
  symptoms: typeof sample.symptoms | null;
  medications: typeof sample.medications | null;
  journey: typeof sample.journey | null;
  insight: typeof sample.insight | null;
  profile: typeof sample.profile | null;
};

const REAL_TODAY_TEXT = {
  headline: 'Nothing to compare yet.',
  kicker: 'Your record starts with what you log',
  brief: 'As your cycles, notes and sources build up, what changes will show here with the evidence behind it.',
};

export function dataFor(mode: 'demo' | 'real', firstName: string | null): Data {
  if (mode === 'demo') {
    return {
      mode,
      days: loadDays(),
      person: { firstName: sample.person.firstName },
      today: sample.today,
      records: sample.records,
      sleep: sample.sleep,
      symptoms: sample.symptoms,
      medications: sample.medications,
      journey: sample.journey,
      insight: sample.insight,
      profile: sample.profile,
    };
  }
  return {
    mode,
    days: [],
    person: firstName ? { firstName } : null,
    today: { ...sample.today, ...REAL_TODAY_TEXT },
    records: null,
    sleep: null,
    symptoms: null,
    medications: null,
    journey: null,
    insight: null,
    profile: null,
  };
}
```

Check every field of `sample.today`. Any field besides `headline`, `kicker` and `brief` that states a claim about the person must also be overridden in `REAL_TODAY_TEXT` with neutral copy, or cleared.

Add to `src/state/session.tsx`:

```tsx
import { type Data, dataFor } from '../data/adapter';

export function useData(): Data {
  const { mode, firstName } = useSession();
  return useMemo(() => dataFor(mode === 'real' ? 'real' : 'demo', firstName), [mode, firstName]);
}
```

Add to `src/ui/kit.tsx`:

```tsx
// What a screen shows while her record has nothing for it yet.
export function EmptyNote({ text }: { text: string }) {
  return <Text style={[font('body'), { color: C.secondary, lineHeight: 25 }]}>{displayCopy(text)}</Text>;
}
```

(Import `displayCopy` in `kit.tsx` if it isn't imported.)

- [ ] **Step 4: Bind every sample reader to `useData()`**

Replace each `import { x } from '../data/sample'` value import (type imports stay) and each `loadDays()` call with `useData()`:

| File | Change |
|---|---|
| `src/state/insights.ts` | `const { days, records, today } = useData();` then pass `days`, `draws: records?.draws ?? []`, `opening: today.brief`; add `days` and `records` to the memo deps |
| `src/state/cycleStore.tsx` | `estimateFertility({ ..., days })` takes `days` from `useData()`; the `sample-walk` intervention exists only when `repo.mode === 'demo'` (Task 9 wires the repo) |
| `TodayScreen.tsx` | `const { person, today, days } = useData();`; `cycleTrend(windows, days)`; greeting renders `${greeting(now)}, ${person.firstName}.` when `person` exists, else `${greeting(now)}.` |
| `MyHealthScreen.tsx`, `HealthDashboard.tsx` | read `days`, `records`, `medications` from `useData()`; a section whose data is null is not rendered |
| `SleepScreen`, `SymptomsScreen`, `MedicationsScreen`, `HealthRecordsScreen`, `InsightScreen` | when the piece is null, return `<DetailScreen title="<same title>" onBack={nav.back}><EmptyNote text="Nothing here yet. This fills in as you log and connect sources." /></DetailScreen>` |
| `JourneyScreen.tsx` | lanes built from episodes stay; anything read from `journey` (including the "Something changed" card and the hard coded lane) renders only when `journey` is not null |
| `BodySystemView.tsx` | read `profile` from `useData()`; when null, systems with no reading show as having nothing logged |
| `ProfileScreen.tsx` | the identity block shows `firstName` (or nothing) instead of `profile.name`, `profile.age` and `profile.born` when `profile` is null; the Overview, Health Info, Biomarkers and Care segments render `CycleGroup` plus `<EmptyNote text="Nothing here yet. This fills in as you log and connect sources." />` when `profile` is null. Settings is Task 10 |

Keep every layout and style unchanged. Make no other edits.

- [ ] **Step 5: Verify no sample value reads remain outside the adapter**

Run: `grep -rn "from '../data/sample'\|from './sample'" src | grep -v "import type" | grep -v "\.test\." | grep -v "src/data/adapter.ts\|src/data/repo.ts\|src/data/rows.ts\|src/data/cycleLog.ts\|src/data/daily.ts"`
Expected: no output. Every remaining import is `import type`.

Run: `grep -rn "loadDays()" src | grep -v "\.test\." | grep -v "src/data/adapter.ts\|src/data/daily.ts"`
Expected: no output.

- [ ] **Step 6: Typecheck, test, look**

Run: `npx tsc --noEmit && npm test`
Expected: all pass. In the simulator, Look Around First still shows the full sample person on every tab. Report the screenshots.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "Read every screen through one adapter so her record never mixes with the sample"
```

---

### Task 9: Cycle store and notes on the repo

**Files:**
- Modify: `ciatta-mobile-app/src/state/cycleStore.tsx`
- Modify: `ciatta-mobile-app/src/screens/JournalScreen.tsx`
- Modify: `ciatta-mobile-app/src/lib/cycleProfile.ts` (only if Step 1 needs `EMPTY_PROFILE`)

**Interfaces:**
- Consumes: `useRepo`, `useData` (Tasks 7 and 8); `enqueue`, `flush` (Task 6); `importDeviceRecord` (Task 6).
- Produces: the `useCycle()` store keeps its exact shape. In real mode `episodes` are only hers, loaded from and saved to Supabase; in demo mode the sample record stands around in memory episodes as today.

- [ ] **Step 1: An empty cycle profile for a new person**

Check `normalizeProfile({ situations: [] })` in `src/lib/cycleProfile.ts`. If it returns a valid profile with no situations and fertility off, use that as the real mode start. Otherwise export `EMPTY_PROFILE: CycleProfile` next to `SAMPLE_PROFILE`, with no situations and every optional field at its unknown value, and add a test in `cycleProfile.test.ts`:

```ts
test('a new person starts with no situation and no fertility estimate', () => {
  assert.deepEqual(EMPTY_PROFILE.situations, []);
  assert.equal(fertilityOn(EMPTY_PROFILE), false);
});
```

- [ ] **Step 2: Rewire the provider**

In `src/state/cycleStore.tsx`, keep the `Store` type and `useCycle`/`useCycleInsights` exactly. Replace the storage logic in `CycleStoreProvider` with:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

import { importDeviceRecord } from '../data/deviceImport';
import { enqueue, flush } from '../data/outbox';
import { useData, useRepo } from './session';

// The watch flags and planned actions stay on this phone until Slice 4 turns
// them into threads and actions. Real mode only; the demo keeps nothing.
const LOOP_KEY = 'ciatta.loop.v1';

export function CycleStoreProvider({ children }: { children: ReactNode }) {
  const repo = useRepo();
  const real = repo.mode === 'real';
  const [own, setOwn] = useState<Episode[]>([]);
  const episodes = useMemo(() => (real ? own : recordEpisodes(own)), [own, real]);
  const [watching, setWatchingMap] = useState<Record<string, boolean>>({});
  const [interventions, setInterventions] = useState<Intervention[]>(real ? [] : sampleInterventions);
  const [draft, setDraft] = useState<Draft>({ mode: 'new', form: {} });
  const [focus, setFocus] = useState<string | null>(null);
  const [profile, setProfileState] = useState<CycleProfile>(real ? EMPTY_PROFILE : SAMPLE_PROFILE);
  const loaded = useRef(false);

  useEffect(() => {
    if (!real) return;
    let alive = true;
    (async () => {
      try {
        await importDeviceRecord(AsyncStorage, (e, extra) => repo.saveEpisode(e, extra), (p) => repo.saveCycleProfile(p));
      } catch {
        // The device record stays in place and is tried again next launch.
      }
      await flush(AsyncStorage, (e) => repo.saveEpisode(e)).catch(() => 0);
      const [mine, savedProfile, loop] = await Promise.all([
        repo.loadEpisodes().catch(() => [] as Episode[]),
        repo.loadCycleProfile().catch(() => null),
        AsyncStorage.getItem(LOOP_KEY).catch(() => null),
      ]);
      if (!alive) return;
      setOwn(mine);
      if (savedProfile) setProfileState(savedProfile);
      if (loop) {
        const saved = JSON.parse(loop) as { watching?: Record<string, boolean>; interventions?: Intervention[] };
        if (saved.watching) setWatchingMap(saved.watching);
        if (saved.interventions) setInterventions(saved.interventions);
      }
      loaded.current = true;
    })();
    return () => {
      alive = false;
    };
  }, [real, repo]);

  useEffect(() => {
    if (!real || !loaded.current) return;
    AsyncStorage.setItem(LOOP_KEY, JSON.stringify({ watching, interventions })).catch(() => {});
  }, [real, watching, interventions]);

  const store = useMemo<Store>(
    () => ({
      episodes,
      add: (episode) => {
        setOwn((list) => [...list.filter((e) => e.id !== episode.id), episode]);
        repo.saveEpisode(episode).catch(() => enqueue(AsyncStorage, episode));
      },
      draft,
      startDraft: (next) => setDraft({ mode: 'new', form: {}, ...next }),
      watching,
      setWatching: (id, on) => setWatchingMap((w) => ({ ...w, [id]: on })),
      interventions,
      accept: (kind) => {
        const date = isoDay(new Date());
        setInterventions((list) =>
          list.some((v) => v.kind === kind && v.date === date) ? list : [...list, { id: `${kind}-${Date.now()}`, kind, date }],
        );
      },
      focus,
      setFocus,
      profile,
      setProfile: (next) => {
        setProfileState(next);
        repo.saveCycleProfile(next).catch(() => {});
      },
    }),
    [episodes, draft, watching, interventions, focus, profile, repo],
  );

  return <CycleContext.Provider value={store}>{children}</CycleContext.Provider>;
}
```

In `useCycleInsights`, take `days` from `useData()` for `estimateFertility` (from Task 8) and add `days` to the memo deps. Remove the old `KEY` constant and the old AsyncStorage load and save effects. The device key is now read only by `importDeviceRecord`.

Known limit, stated in the report: a cycle profile change that fails to save is kept on screen but is not retried. The outbox covers episodes only.

- [ ] **Step 3: Notes from the repo, and Add an Entry**

In `src/screens/JournalScreen.tsx`:
- Replace the `journal` import with state loaded from `useRepo().loadJournal()` on mount (`const [journal, setJournal] = useState<JournalView | null>(null)`; while null, render the screen with no groups).
- "Add an Entry" opens an inline composer above the button: a `TextInput` (multiline, `font('subhead')`, `color: C.text`, `placeholderTextColor={C.muted}`, placeholder `"What are you noticing?"`, styled with the existing `j.card` style) and a `PrimaryButton` labelled `Save Entry`, disabled while the text is blank or saving.
- Saving calls `repo.addJournal(text.trim(), filter === 'All' ? 'Notes' : filter)`, then reloads the journal, clears and closes the composer. On failure, show `userFacingError(e, 'That entry did not save. Try again.')` under the composer in `font('footnote')`, `color: C.tint`.
- When `journal.count === 0`, render `<EmptyNote text="No notes yet. Anything you write here is saved as yours." />` above the button.

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 5: Look, in demo**

In the simulator, Look Around First: log a pain episode and add a note. Both appear. Sign out from Profile (Task 10 wires the button; until then, reload the app) and confirm the demo starts clean.

- [ ] **Step 6: Commit**

```bash
git add src/state/cycleStore.tsx src/screens/JournalScreen.tsx src/lib/cycleProfile.ts src/lib/cycleProfile.test.ts
git commit -m "Save episodes, the cycle profile and notes to her record"
```

---

### Task 10: Profile settings, export and delete

**Files:**
- Create: `ciatta-mobile-app/src/data/account.ts`
- Create: `ciatta-mobile-app/supabase/functions/delete-account/index.ts`
- Modify: `ciatta-mobile-app/src/screens/ProfileScreen.tsx` (the `Settings` component only)

**Interfaces:**
- Consumes: `supabase` (Task 5); `useSession`, `useRepo` (Task 7); `SourceView` (Task 4).
- Produces: `exportAndShare(userId: string): Promise<void>`, `deleteAccount(): Promise<void>`, `EXPORT_TABLES`; the edge function `delete-account`.

- [ ] **Step 1: Account helpers**

`src/data/account.ts`:

```ts
import { Share } from 'react-native';

import { supabase } from '../lib/supabase';

// Everything she owns, read as her, so RLS guarantees it is only hers.
export const EXPORT_TABLES = [
  'profiles', 'health_sources', 'raw_inputs', 'episodes', 'journal_entries',
  'medications', 'supplements', 'documents', 'results', 'observations',
] as const;

export async function exportAndShare(userId: string): Promise<void> {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: userId };
  for (const table of EXPORT_TABLES) {
    const query = table === 'profiles' ? supabase.from(table).select('*').eq('id', userId) : supabase.from(table).select('*');
    const { data, error } = await query;
    if (error) throw error;
    out[table] = data ?? [];
  }
  await Share.share({ message: JSON.stringify(out, null, 2), title: 'Your data' });
}

// Deletes her files, then her account; every row cascades from the account.
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await supabase.auth.signOut();
}
```

- [ ] **Step 2: The delete function**

`supabase/functions/delete-account/index.ts`:

```ts
// Deletes the caller's own account and everything that belongs to it. The
// user id comes only from the caller's verified token, never the request.
// Every table references auth.users on delete cascade, so removing her files
// and then her auth user removes everything.
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Not signed in' }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await caller.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401);
  const uid = who.user.id;

  const admin = createClient(url, serviceKey);
  try {
    for (;;) {
      const { data: files, error } = await admin.storage.from('documents').list(uid, { limit: 100 });
      if (error) throw error;
      if (!files?.length) break;
      const { error: removeError } = await admin.storage.from('documents').remove(files.map((f) => `${uid}/${f.name}`));
      if (removeError) throw removeError;
    }
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw error;
    return json({ deleted: true });
  } catch (e) {
    console.error('delete-account failed', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Delete did not finish' }, 500);
  }
});
```

- [ ] **Step 3: Test the function locally**

Run: `supabase functions serve delete-account` in one terminal (background). In another:

```bash
eval "$(supabase status -o env)"
TOKEN=$(curl -s "$API_URL/auth/v1/signup" -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' -d '{"email":"del@test.local","password":"a-long-password-123"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).access_token))')
curl -s -X POST "$API_URL/functions/v1/delete-account" -H "Authorization: Bearer $TOKEN"
```

Expected: `{"deleted":true}`. Then `supabase db query "select count(*) from auth.users where email = 'del@test.local'"` (or psql on port 54322) returns 0. If local email signup is disabled, enable it in `supabase/config.toml` under `[auth.email]` for local only and report it. Put the commands you ran in the report.

- [ ] **Step 4: Wire Settings**

In `ProfileScreen.tsx` `Settings`:
- Sources: `const [list, setList] = useState<SourceView[]>([])`, loaded from `useRepo().loadSources()` on mount, replacing `sources`. Keep the `Expandable` rendering as is.
- Connect a Source: sets a notice shown under the button in `font('footnote')`, `color: C.secondary`:
  - demo: `"This is an example person. Sign in to connect your own sources."`
  - real: `"Apple Health connects in the next update. Until then, everything you log here is saved to your record."`
- Download Your Data: real mode calls `exportAndShare(userId)`; on failure, set the Privacy and Data group's `footer` to `userFacingError(e, 'Your data did not download. Try again.')`. Demo mode sets the footer to `"The example person has no data to download."`
- Sign Out: `useSession().signOut()`.
- Delete Account and Data: shown only in real mode. On press:

```ts
Alert.alert('Delete your account?', 'Your record, notes, sources and files are deleted for good. This cannot be undone.', [
  { text: 'Cancel', style: 'cancel' },
  {
    text: 'Delete',
    style: 'destructive',
    onPress: () => deleteAccount().catch((e) => setAccountNote(userFacingError(e, 'Your account was not deleted. Try again.'))),
  },
]);
```

  `accountNote` renders as the last ListGroup's `footer`.
- "Who Can See This", "Share with a Clinician" and "Manage access" keep `notYet`. They belong to later slices.

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit && npm test && supabase test db`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/data/account.ts supabase/functions/delete-account/index.ts src/screens/ProfileScreen.tsx supabase/config.toml
git commit -m "Make sources, sign out, export and delete real"
```

---

### Task 11: Push to the live project (controller, after the user says go)

Do not start this task without the user's explicit go ahead in the conversation. The user approved the cleanup in principle; the push itself still waits for "go".

- [ ] **Step 1: Confirm the live project is still empty**

Use the Supabase MCP `list_tables` on `pghlquiwqnknpveyssui`, schema `public`. Expected: `[]`. If anything exists, stop and ask.

- [ ] **Step 2: Clear the old migration history**

MCP `execute_sql`:

```sql
delete from supabase_migrations.schema_migrations where version < '20260915000000';
```

This is the same as `supabase migration repair --status reverted` for the 30 versions whose files were removed in `d422a01`. Nothing else in the schema changes.

- [ ] **Step 3: Delete the orphaned functions**

```bash
supabase functions delete understanding-engine --project-ref pghlquiwqnknpveyssui
supabase functions delete provider-search --project-ref pghlquiwqnknpveyssui
```

- [ ] **Step 4: Link and push**

```bash
supabase link --project-ref pghlquiwqnknpveyssui
supabase db push
```

`link` asks for the database password. If it prompts, ask the user to run it with `! supabase link --project-ref pghlquiwqnknpveyssui`.
Expected: the three migrations apply.

- [ ] **Step 5: Deploy delete-account**

```bash
supabase functions deploy delete-account --project-ref pghlquiwqnknpveyssui
```

- [ ] **Step 6: Verify**

- MCP `get_advisors` (security): expect no `rls_disabled_in_public` and no `security_definer_view` findings. Fix any finding with a new migration before continuing.
- MCP `list_tables`: the ten tables exist with RLS enabled.
- In the simulator, sign in with Apple. Then:
  - Log a period, and add a note.
  - Force quit, relaunch: both are still there.
  - Profile shows the You source.
  - Download Your Data opens the share sheet.
  - Delete with a throwaway account returns to sign in.

Report each result with a screenshot.

- [ ] **Step 7: Rebuild note**

Sign in needs no native rebuild (both packages are already in the dev client). Record in the report whether the phone build needs a rebuild for any other reason.

---

## Self review

- Spec coverage for Slice 1:
  - §2 local stack, sign in, cleanup: Tasks 1, 7, 11.
  - §4 modes, device import, empty notes: Tasks 6, 8, 9.
  - §5.1 to 5.3: Tasks 1 to 3.
  - §7 Profile, Cycle, Journal rows: Tasks 8, 9, 10.
  - §8 export and delete: Task 10.
  - §10 RLS and cascade tests: Tasks 1 to 3.
  - Health sources "Connect a Source" is honest and unsupported until Slice 2 brings HealthKit.
- Deviation from the spec, ruled: export runs client side under RLS instead of an `export-data` function. It gives the same guarantee (only her rows) with one less server surface. The spec is updated in this plan's commit.
- Deviation, ruled: watch flags and planned actions stay on the phone in real mode until Slice 4 replaces them with `threads` and `actions`.
- Names used across tasks are consistent:
  - `episodeToRow`, `rowToEpisode`, `journalView`, `sourceView`
  - `Repo`, `demoRepo`, `realRepo`, `useRepo`, `useData`, `dataFor`
  - `enqueue`, `flush`, `importDeviceRecord`, `EMPTY_PROFILE`

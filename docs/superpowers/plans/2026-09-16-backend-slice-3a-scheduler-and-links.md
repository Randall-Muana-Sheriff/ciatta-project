# Backend Slice 3a: Scheduler and Evidence Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the baselines pipeline run unattended, and add the temporal links table that Slice 3b's threads will rest on.

**Architecture:** `pg_cron` calls a plain SQL function every five minutes; that function reads the service role key from Vault and fires asynchronous HTTP posts at the already deployed `baselines` edge function through `pg_net`, draining the job queue. A second nightly job enqueues a reconciliation pass for anyone whose record changed but whose job was somehow missed. Separately, a `temporal_links` table records that two things in her record happened near each other in time, computed by the same edge function run, with the relation named and never a cause implied.

**Tech Stack:** Supabase Postgres 17, `pg_cron` 1.6.4 (installed), `pg_net` 0.20.4 (available, not yet installed), `supabase_vault` 0.3.1 (installed), Deno edge functions, pgTAP, `tsx --test` with `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md` (section 5.4 Intelligence, section 6 Intelligence pipeline)

**Prior ledger:** `.superpowers/sdd/2026-09-16-backend-slice-2-health-data/progress.md` carries the rulings this plan inherits, including the two open questions it closes.

## Global Constraints

- Never represent an inference as a measured fact.
- Missing data is unknown. Never convert missing information into "none", and never into zero.
- A user must only be able to access their own data. Never expose another user's health information.
- The service role key never appears in `src/`, and never in plaintext in any table a non superuser can read, `cron.job` included.
- No raw personal health information in production logs. Log ids, counts and error names only.
- No diagnosis, no prescription, no causation claimed from correlation. A temporal link records proximity in time and nothing more.
- Every new database function gets its own `revoke execute ... from public, anon, authenticated`. Revoke then grant, never additive.
- Every new table holding her data gets RLS and an owner select policy.
- No em dash, en dash or hyphen in user facing copy. Compound words become separate words ("heart rate", not "heart-rate"). Remote or templated strings render through `displayCopy()` in `src/lib/displayCopy.ts`.
- The product name never appears in user facing copy.
- Do not redesign the frontend, replace the navigation, or invent a new product direction. This slice adds no screens.
- Migrations are written as new files. Never edit a migration already applied to the live project; the live project currently holds all sixteen through `20260916100400`.

---

### Task 1: The scheduler

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260917100000_scheduler.sql`
- Create: `ciatta-mobile-app/supabase/tests/scheduler.test.sql`
- Modify: `ciatta-mobile-app/supabase/config.toml` (the `[functions.baselines]` block)

**Interfaces:**
- Consumes: `public.claim_baselines_job()`, `public.enqueue_job(uuid, text)` from Slice 2 (`20260915100900_jobs.sql`, `20260916100000_claim_baselines_job.sql`).
- Produces: `public.baselines_tick()` returns integer (the number of posts fired), and `public.enqueue_baselines_reconciliation()` returns integer (the number of users enqueued). Both service role only.

**Context the implementer needs.**

The `baselines` edge function is already deployed and live. It claims **one** job per request and returns `{processed: false}` when the queue is empty. So draining a queue of N jobs takes N requests. `pg_net` is asynchronous: `net.http_post` queues a request and returns immediately with an id, it does not wait for the response. That is what makes firing ten posts in one tick cheap.

The function requires the service role key as its bearer token and refuses everything else with a 401. That key must not be written into the cron command, because `cron.job` stores the command as plain text and anyone who can read that table would read the key. It goes in Vault, and the tick function reads it there.

**Ruling recorded, deviating from the spec.** Section 6 says "pg_cron runs a nightly reconciliation and a morning refresh". A morning refresh alone would leave a sync at 9am unprocessed until the next morning. This schedules a drain every five minutes instead, which subsumes the morning refresh, and keeps the nightly reconciliation as the safety net the spec intends. If the five minute drain is ever too costly, the interval is one number in one migration.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/supabase/tests/scheduler.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- The extensions this rests on are actually installed.
select has_extension('pg_cron', 'pg_cron is installed');
select has_extension('net', 'pg_net is installed');

-- Both functions exist.
select has_function('public', 'baselines_tick', 'baselines_tick exists');
select has_function('public', 'enqueue_baselines_reconciliation', 'reconciliation enqueuer exists');

-- Neither Data API role can call them. This is the whole security of the
-- scheduler: baselines_tick reads the service role key out of Vault.
select ok(not has_function_privilege('anon', 'public.baselines_tick()', 'EXECUTE'),
  'anon cannot execute baselines_tick');
select ok(not has_function_privilege('authenticated', 'public.baselines_tick()', 'EXECUTE'),
  'authenticated cannot execute baselines_tick');
select ok(not has_function_privilege('anon', 'public.enqueue_baselines_reconciliation()', 'EXECUTE'),
  'anon cannot execute the reconciliation enqueuer');
select ok(not has_function_privilege('authenticated', 'public.enqueue_baselines_reconciliation()', 'EXECUTE'),
  'authenticated cannot execute the reconciliation enqueuer');

-- Both cron jobs are scheduled.
select ok(
  exists (select 1 from cron.job where jobname = 'baselines-drain'),
  'the five minute drain is scheduled'
);
select ok(
  exists (select 1 from cron.job where jobname = 'baselines-reconcile'),
  'the nightly reconciliation is scheduled'
);

-- The key is not sitting in the cron command in plaintext. This is the
-- failure this design exists to prevent, so it is asserted rather than
-- assumed: the command calls a function and carries no bearer token.
select ok(
  not exists (select 1 from cron.job where command ilike '%bearer%' or command ilike '%service_role%' or command ilike '%eyJ%'),
  'no cron command carries a key or a bearer token'
);

-- The reconciliation enqueues one job per user who has any daily_metrics
-- row, and the one pending job index collapses duplicates.
select lives_ok(
  $$ select public.enqueue_baselines_reconciliation() $$,
  'the reconciliation enqueuer runs without error on an empty database'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: FAIL. `pg_net` is not installed, neither function exists, neither cron job exists.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20260917100000_scheduler.sql`:

```sql
-- Slice 2 shipped the baselines function and the job queue that feeds it,
-- and nothing called it: jobs enqueued on every device sync and sat
-- pending forever, so nobody's baselines were ever computed. This is the
-- caller.
--
-- pg_cron cannot make an HTTP request on its own, so pg_net provides the
-- post. pg_net is asynchronous: net.http_post queues the request and
-- returns an id immediately rather than waiting for the response, which is
-- why firing a batch of posts in one tick costs almost nothing.
create extension if not exists pg_net with schema extensions;

-- The service role key lives in Vault, never in the cron command. cron.job
-- stores its command as plain text, so a key written there would be
-- readable by anyone who could read that table. The secret is created by
-- the deploy step (see the plan's Task 5), not by this migration, because a
-- migration file lives in git and a key must never be committed.
--
-- baselines_tick fires up to `batch` posts at the baselines function. Each
-- post claims at most one job, so `batch` is the most jobs one tick can
-- drain. It returns the number of posts fired, never the number of jobs
-- processed: pg_net is asynchronous, so this function cannot know what
-- happened downstream, and it must not claim otherwise.
create function public.baselines_tick(batch integer default 10) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  service_key text;
  project_url text;
  fired integer := 0;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key';
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url';

  -- No secret configured is not an error worth raising from a cron job
  -- every five minutes; it is a state to report. Nothing is posted.
  if service_key is null or project_url is null then
    return 0;
  end if;

  for i in 1..batch loop
    perform extensions.http_post(
      url := project_url || '/functions/v1/baselines',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      timeout_milliseconds := 30000
    );
    fired := fired + 1;
  end loop;

  return fired;
end $$;
revoke execute on function public.baselines_tick(integer) from public, anon, authenticated;

-- The nightly safety net. A job is normally enqueued by the trigger on
-- daily_metrics, so this exists for the case where that did not happen: a
-- failed job that exhausted its attempts, a row written before the trigger
-- existed, a restore. It enqueues one baselines job per person who has any
-- daily_metrics row at all; jobs_one_pending collapses anyone who already
-- has one waiting, so running it twice in a row is harmless.
--
-- Returns the number of users considered, not the number of rows inserted:
-- the insert is deliberately silent about conflicts, so the count of new
-- jobs is not knowable without a second query nobody needs.
create function public.enqueue_baselines_reconciliation() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  considered integer := 0;
begin
  for considered in
    select count(distinct user_id) from public.daily_metrics
  loop
    exit;
  end loop;

  perform public.enqueue_job(user_id, 'baselines')
  from (select distinct user_id from public.daily_metrics) as owners;

  return considered;
end $$;
revoke execute on function public.enqueue_baselines_reconciliation() from public, anon, authenticated;

-- Every five minutes rather than the spec's morning refresh: a sync at 9am
-- should not wait until tomorrow to be processed. This subsumes the
-- morning refresh and keeps the nightly reconciliation below.
select cron.schedule(
  'baselines-drain',
  '*/5 * * * *',
  $$ select public.baselines_tick(10) $$
);

-- 03:15 UTC, off the hour so it does not land with every other nightly job
-- in the region.
select cron.schedule(
  'baselines-reconcile',
  '15 3 * * *',
  $$ select public.enqueue_baselines_reconciliation() $$
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS, and the whole suite still green (190 assertions before this task; 202 after).

If `extensions.http_post` is not found, check where `pg_net` actually installed its functions on this Postgres: `select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = 'http_post';`. Use whatever schema that query reports, and say in your report which one it was rather than leaving the discrepancy silent.

- [ ] **Step 5: Restore the platform JWT gate**

In `ciatta-mobile-app/supabase/config.toml`, change the `[functions.baselines]` block from `verify_jwt = false` to `verify_jwt = true`.

The reason, recorded during the Slice 2 push: the live project issues both key eras, and a legacy service role key is itself a project signed JWT, so `verify_jwt = true` admits the scheduler while keeping a platform level gate in front of unauthenticated traffic. The function's own constant time bearer check stays exactly as it is. This is defence in depth, not a replacement.

Update the comment at the top of `supabase/functions/baselines/index.ts` that currently says "supabase/config.toml sets verify_jwt = false for this function, so the bearer check below is the only gate in front of that." It is no longer the only gate. Say what is true: the platform verifies the token is a valid project JWT, and this check verifies it is the service role key specifically.

- [ ] **Step 6: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260917100000_scheduler.sql ciatta-mobile-app/supabase/tests/scheduler.test.sql ciatta-mobile-app/supabase/config.toml ciatta-mobile-app/supabase/functions/baselines/index.ts
git commit -m "Run the baselines pipeline on a schedule instead of never"
```

---

### Task 2: Make the scheduler's work visible

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260917100100_scheduler_observability.sql`
- Modify: `ciatta-mobile-app/supabase/tests/scheduler.test.sql`

**Interfaces:**
- Consumes: `public.baselines_tick(integer)` from Task 1.
- Produces: view `public.scheduler_health` (service role only) with columns `jobname text, last_run timestamptz, last_status text, failures_24h bigint, pending_jobs bigint, oldest_pending timestamptz`.

**Why this is its own task.** A scheduler nobody can inspect is a scheduler nobody can trust. When someone asks in a month whether baselines are running, the answer must come from a query rather than from an assumption. `cron.job_run_details` records every run; `net._http_response` records what the posts came back with; `public.jobs` says whether the queue is draining. This view joins the three into one honest answer.

- [ ] **Step 1: Write the failing test**

Append to `ciatta-mobile-app/supabase/tests/scheduler.test.sql`, and change `select plan(12);` to `select plan(16);`:

```sql
-- The health view exists and is server only.
select has_view('public', 'scheduler_health', 'scheduler_health exists');
select ok(not has_table_privilege('anon', 'public.scheduler_health', 'SELECT'),
  'anon cannot read scheduler health');
select ok(not has_table_privilege('authenticated', 'public.scheduler_health', 'SELECT'),
  'authenticated cannot read scheduler health');

-- It answers on an empty database rather than erroring, because the first
-- person to ask "is this running" will ask before it has ever run.
select lives_ok(
  $$ select * from public.scheduler_health $$,
  'scheduler health answers before the first run'
);
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: FAIL with the view not existing.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20260917100100_scheduler_observability.sql`:

```sql
-- One query that answers "is the baselines pipeline actually running, and
-- is it keeping up". Three facts live in three places: cron.job_run_details
-- says whether the tick fired and whether it errored, net._http_response
-- says what the edge function answered, and public.jobs says whether the
-- queue is draining. A person debugging this at 2am should not have to
-- know that.
--
-- security_invoker so the view carries no privileges of its own: it is
-- readable only by a role that can already read the tables underneath,
-- which is service_role and the superuser, and neither Data API role is
-- granted anything below.
create view public.scheduler_health
with (security_invoker = true) as
select
  j.jobname,
  max(d.start_time) as last_run,
  (array_agg(d.status order by d.start_time desc))[1] as last_status,
  count(*) filter (
    where d.status <> 'succeeded' and d.start_time > now() - interval '24 hours'
  ) as failures_24h,
  (select count(*) from public.jobs where status = 'pending') as pending_jobs,
  (select min(created_at) from public.jobs where status = 'pending') as oldest_pending
from cron.job j
left join cron.job_run_details d on d.jobid = j.jobid
where j.jobname in ('baselines-drain', 'baselines-reconcile')
group by j.jobname;

revoke all on public.scheduler_health from anon, authenticated;
grant select on public.scheduler_health to service_role;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS, 206 assertions.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260917100100_scheduler_observability.sql ciatta-mobile-app/supabase/tests/scheduler.test.sql
git commit -m "Answer whether the pipeline is running with a query, not a guess"
```

---

### Task 3: The temporal links table

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260917100200_temporal_links.sql`
- Create: `ciatta-mobile-app/supabase/tests/temporal_links.test.sql`

**Interfaces:**
- Consumes: `public.observations` (Slice 1), `public.enable_owner_rls(text)` (Slice 1).
- Produces: table `public.temporal_links` with columns `id uuid, user_id uuid, a_observation_id uuid, b_observation_id uuid, relation public.link_relation, gap_hours numeric, occurred_on date, created_at timestamptz, updated_at timestamptz`, and enum `public.link_relation` with values `same_day, within_24h, within_3d, within_7d, before, after, recurring`.

**What this table is and is not.** It records that two things in her record happened near each other in time. That is all it records. It is the raw material a thread is later built from, and the wording module in Slice 3b will say "occurred alongside" and "followed", never "caused". The enum values come verbatim from spec section 5.4.

**The ordering rule, which matters for deduplication.** A link between A and B is the same link as one between B and A. Without a rule, the same pair lands twice. The rule: `a_observation_id` is always the earlier observation by `occurred_at`, and ties break on the smaller uuid. `relation` then describes B relative to A, which is why `before` and `after` can both exist in the enum without ambiguity.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/supabase/tests/temporal_links.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_type('public', 'link_relation', 'the relation enum exists');
select has_table('public', 'temporal_links', 'temporal_links exists');

-- RLS, and only select for her: links are derived by the server, never
-- written by the client, exactly as baselines and changes are.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.temporal_links'::regclass),
  'RLS is enabled on temporal_links'
);
select ok(not has_table_privilege('anon', 'public.temporal_links', 'SELECT'),
  'anon cannot read temporal links');
select ok(has_table_privilege('authenticated', 'public.temporal_links', 'SELECT'),
  'authenticated can read temporal links');
select ok(not has_table_privilege('authenticated', 'public.temporal_links', 'INSERT'),
  'authenticated cannot write temporal links');
select ok(not has_table_privilege('authenticated', 'public.temporal_links', 'UPDATE'),
  'authenticated cannot update temporal links');
select ok(not has_table_privilege('authenticated', 'public.temporal_links', 'DELETE'),
  'authenticated cannot delete temporal links');

-- A link never points an observation at itself.
select throws_ok(
  $$ insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             'same_day', 0, '2026-09-16') $$,
  '23514',
  null,
  'an observation cannot be linked to itself'
);

-- The same pair cannot be recorded twice for the same relation.
select col_is_unique('public', 'temporal_links',
  array['user_id', 'a_observation_id', 'b_observation_id', 'relation'],
  'a pair and relation is recorded once');

-- gap_hours is never negative: A is always the earlier observation, so the
-- gap is a magnitude and a negative one would mean the ordering rule was
-- broken somewhere upstream.
select throws_ok(
  $$ insert into public.temporal_links (user_id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on)
     values ('00000000-0000-0000-0000-000000000001'::uuid,
             '00000000-0000-0000-0000-0000000000aa'::uuid,
             '00000000-0000-0000-0000-0000000000bb'::uuid,
             'same_day', -1, '2026-09-16') $$,
  '23514',
  null,
  'a negative gap is refused'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: FAIL, the type and table do not exist.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20260917100200_temporal_links.sql`:

```sql
-- Two things in her record happened near each other in time. That is the
-- whole claim this table makes. It is the raw material a thread is built
-- from in the next slice, and the wording that ever reaches her will say
-- "occurred alongside" or "followed", never "caused".
--
-- The values are the spec's, verbatim (section 5.4).
create type public.link_relation as enum (
  'same_day', 'within_24h', 'within_3d', 'within_7d', 'before', 'after', 'recurring'
);

create table public.temporal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- a is always the earlier observation by occurred_at, ties broken on the
  -- smaller uuid. Without that rule the same pair lands twice, once from
  -- each side. relation describes b relative to a.
  a_observation_id uuid not null references public.observations (id) on delete cascade,
  b_observation_id uuid not null references public.observations (id) on delete cascade,
  relation public.link_relation not null,
  gap_hours numeric not null,
  -- The day the later of the two happened, for indexing a person's recent
  -- links without joining back to observations.
  occurred_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, a_observation_id, b_observation_id, relation),
  constraint temporal_links_distinct_check check (a_observation_id <> b_observation_id),
  -- a is the earlier observation, so the gap is a magnitude. A negative one
  -- means the ordering rule was broken upstream, which is a bug rather than
  -- a datum, and it should fail loudly here rather than quietly skew a
  -- later thread.
  constraint temporal_links_gap_check check (gap_hours >= 0)
);
create index temporal_links_user_day on public.temporal_links (user_id, occurred_on desc);
create index temporal_links_a on public.temporal_links (a_observation_id);
create index temporal_links_b on public.temporal_links (b_observation_id);

-- Server derived, exactly like baselines and changes: she reads her own
-- rows and never writes them. enable_owner_rls is the wrong helper here for
-- the same reason it was wrong for baselines, it would hand her insert,
-- update and delete policies she must not have.
alter table public.temporal_links enable row level security;
create policy "owner select" on public.temporal_links for select to authenticated
  using (user_id = (select auth.uid()));
create trigger temporal_links_touch before update on public.temporal_links
  for each row execute function public.touch_updated_at();
revoke all on public.temporal_links from anon, authenticated;
grant select on public.temporal_links to authenticated;
grant all on public.temporal_links to service_role;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS, 217 assertions.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260917100200_temporal_links.sql ciatta-mobile-app/supabase/tests/temporal_links.test.sql
git commit -m "Record that two things happened near each other, and nothing more"
```

---

### Task 4: Computing the links

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/baselines/links.ts`
- Create: `ciatta-mobile-app/src/data/links.test.ts`
- Modify: `ciatta-mobile-app/supabase/functions/baselines/index.ts` (inside `runJob`, after the temperature pass)

**Interfaces:**
- Consumes: nothing from earlier tasks at the type level; it is pure.
- Produces:
  - `export type LinkInput = { id: string; metric: string; occurredAt: string }`
  - `export type BuiltLink = { a_observation_id: string; b_observation_id: string; relation: Relation; gap_hours: number; occurred_on: string }`
  - `export type Relation = 'same_day' | 'within_24h' | 'within_3d' | 'within_7d'`
  - `export function buildLinks(observations: LinkInput[], maxPairs?: number): BuiltLink[]`

**Why the file sits beside `compute.ts`.** That file is plain TypeScript with no Deno or Supabase imports precisely so a `node:test` suite can exercise it directly while the Deno function imports it by relative path. This follows the same pattern, and the test lives in `src/data/` with the other tests of edge function logic, exactly as `src/data/baselines.test.ts` does.

**The rules, stated once so they are not guessed at.**

1. Only pairs of observations with **different metrics** are linked. Two step counts on consecutive days are not a relationship, they are a series.
2. The relation is the **narrowest** that fits: same calendar day wins over within 24 hours, which wins over within 3 days, which wins over within 7 days. A pair is recorded once, at its narrowest relation.
3. `a` is the earlier observation by `occurredAt`; ties break on the smaller `id`. `gap_hours` is always positive or zero.
4. `occurred_on` is the calendar day of the **later** observation.
5. Pairs more than 7 days apart are not links and are not recorded.
6. `before` and `after` are in the database enum because the spec names them, but this task does not produce them. They belong to a directional relationship between a thread and an event, which Slice 3b builds. Do not invent a use for them here.
7. There is a cap. A person with 500 observations across 90 days has up to 124,750 pairs; almost all are noise, and writing them would make the table useless as well as slow. `maxPairs` defaults to 2000, and the function returns the **narrowest** links first, so the cap discards the weakest rather than an arbitrary slice.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/src/data/links.test.ts`:

```ts
// buildLinks lives beside the baselines edge function (a Deno file imports
// it by relative path) but is plain TypeScript with no Deno or Supabase
// imports, so this suite exercises it directly under node:test, the same
// arrangement as src/data/baselines.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildLinks, type LinkInput } from '../../supabase/functions/baselines/links';

const at = (id: string, metric: string, iso: string): LinkInput => ({ id, metric, occurredAt: iso });

test('two different metrics on the same calendar day are linked as same_day', () => {
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-10T06:00:00.000Z'),
    at('b', 'resting_hr', '2026-09-10T07:30:00.000Z'),
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].relation, 'same_day');
  assert.equal(links[0].a_observation_id, 'a');
  assert.equal(links[0].b_observation_id, 'b');
  assert.equal(links[0].occurred_on, '2026-09-10');
});

test('the same metric is never linked to itself across days: that is a series, not a relationship', () => {
  const links = buildLinks([
    at('a', 'steps', '2026-09-10T06:00:00.000Z'),
    at('b', 'steps', '2026-09-11T06:00:00.000Z'),
  ]);
  assert.deepEqual(links, []);
});

test('a pair is recorded once, at the narrowest relation that fits', () => {
  // 20 hours apart but on different calendar days: within_24h, not same_day.
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-10T20:00:00.000Z'),
    at('b', 'hrv', '2026-09-11T16:00:00.000Z'),
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].relation, 'within_24h');
});

test('gap_hours is a magnitude and a is always the earlier observation', () => {
  const links = buildLinks([
    at('later', 'hrv', '2026-09-12T00:00:00.000Z'),
    at('earlier', 'sleep_hours', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.equal(links[0].a_observation_id, 'earlier');
  assert.equal(links[0].b_observation_id, 'later');
  assert.equal(links[0].gap_hours, 48);
  assert.ok(links[0].gap_hours >= 0);
});

test('occurred_on is the day of the later observation, not the earlier', () => {
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-10T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-12T00:00:00.000Z'),
  ]);
  assert.equal(links[0].occurred_on, '2026-09-12');
});

test('more than seven days apart is not a link at all', () => {
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-01T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.deepEqual(links, []);
});

test('exactly seven days apart is still within_7d, and eight days is nothing', () => {
  const seven = buildLinks([
    at('a', 'sleep_hours', '2026-09-03T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.equal(seven.length, 1);
  assert.equal(seven[0].relation, 'within_7d');

  const eight = buildLinks([
    at('a', 'sleep_hours', '2026-09-02T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.deepEqual(eight, []);
});

test('the cap keeps the narrowest links and discards the weakest, not an arbitrary slice', () => {
  const input: LinkInput[] = [
    at('s1', 'sleep_hours', '2026-09-10T06:00:00.000Z'),
    at('h1', 'hrv', '2026-09-10T07:00:00.000Z'),        // same_day with s1
    at('r1', 'resting_hr', '2026-09-16T06:00:00.000Z'), // within_7d with s1
  ];
  const links = buildLinks(input, 1);
  assert.equal(links.length, 1);
  assert.equal(links[0].relation, 'same_day');
});

test('an empty input produces no links rather than throwing', () => {
  assert.deepEqual(buildLinks([]), []);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npm test`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the implementation**

Create `ciatta-mobile-app/supabase/functions/baselines/links.ts`:

```ts
// Which of her measurements happened near which others. Proximity in time
// and nothing else: this file computes no correlation, ranks no
// relationship by strength, and says nothing about cause. A link is the
// raw material a thread is built from, and the wording that reaches her
// belongs to a later slice.
//
// No Deno or Supabase imports on purpose, the same arrangement as
// compute.ts: plain TypeScript so a Node test can exercise it directly
// while the edge function imports it by relative path.

export type Relation = 'same_day' | 'within_24h' | 'within_3d' | 'within_7d';

export type LinkInput = { id: string; metric: string; occurredAt: string };

export type BuiltLink = {
  a_observation_id: string;
  b_observation_id: string;
  relation: Relation;
  gap_hours: number;
  occurred_on: string;
};

const HOUR_MS = 60 * 60 * 1000;

// Narrowest first. The cap below keeps this order, so what it discards is
// the weakest evidence rather than an arbitrary slice.
const RANK: Record<Relation, number> = { same_day: 0, within_24h: 1, within_3d: 2, within_7d: 3 };

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// The narrowest relation that fits, or null when the two are further apart
// than a week. Same calendar day is checked before the 24 hour window
// because two readings at 23:00 and 01:00 are two hours apart but on
// different days, and "same day" would be the wrong word for them.
function relationFor(earlierMs: number, laterMs: number): Relation | null {
  const gapHours = (laterMs - earlierMs) / HOUR_MS;
  if (gapHours > 24 * 7) return null;
  if (isoDay(earlierMs) === isoDay(laterMs)) return 'same_day';
  if (gapHours <= 24) return 'within_24h';
  if (gapHours <= 24 * 3) return 'within_3d';
  return 'within_7d';
}

export function buildLinks(observations: LinkInput[], maxPairs = 2000): BuiltLink[] {
  const parsed = observations
    .map((o) => ({ ...o, ms: Date.parse(o.occurredAt) }))
    .filter((o) => Number.isFinite(o.ms))
    .sort((x, y) => x.ms - y.ms || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const out: BuiltLink[] = [];
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      // Sorted ascending, so once b is out of range every later b is too.
      if (b.ms - a.ms > 24 * 7 * HOUR_MS) break;
      // Two readings of the same metric are a series, not a relationship.
      if (a.metric === b.metric) continue;
      const relation = relationFor(a.ms, b.ms);
      if (!relation) continue;
      out.push({
        a_observation_id: a.id,
        b_observation_id: b.id,
        relation,
        gap_hours: (b.ms - a.ms) / HOUR_MS,
        occurred_on: isoDay(b.ms),
      });
    }
  }

  out.sort((x, y) => RANK[x.relation] - RANK[y.relation] || x.gap_hours - y.gap_hours);
  return out.slice(0, maxPairs);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npm test`
Expected: PASS. 228 before this task, 237 after.

- [ ] **Step 5: Wire it into the edge function**

In `ciatta-mobile-app/supabase/functions/baselines/index.ts`, import `buildLinks` alongside the existing `./compute.ts` import:

```ts
import { buildLinks, type LinkInput } from './links.ts';
```

Then, inside `runJob`, after the temperature deviation block and before `return { metrics: computed };`, add:

```ts
  // Which of her measurements happened near which others, over the same
  // window the baselines above were computed from. Written with the same
  // upsert discipline as everything else in this function: the unique key
  // is (user_id, a_observation_id, b_observation_id, relation), so a second
  // run over the same window reproduces the same rows rather than
  // duplicating them.
  const { data: linkRows, error: linkError } = await admin
    .from('observations')
    .select('id, metric, occurred_at')
    .eq('user_id', job.user_id)
    .gte('occurred_at', start.toISOString())
    .lte('occurred_at', today.toISOString())
    .order('occurred_at');
  if (linkError) throw linkError;

  const links = buildLinks(
    (linkRows ?? []).map((row: { id: string; metric: string; occurred_at: string }): LinkInput => ({
      id: row.id,
      metric: row.metric,
      occurredAt: row.occurred_at,
    }))
  );

  if (links.length > 0) {
    const { error: linkWriteError } = await admin
      .from('temporal_links')
      .upsert(
        links.map((link) => ({ ...link, user_id: job.user_id })),
        { onConflict: 'user_id,a_observation_id,b_observation_id,relation' }
      );
    if (linkWriteError) throw linkWriteError;
  }
```

- [ ] **Step 6: Typecheck and run the whole suite**

Run: `cd ciatta-mobile-app && npx tsc --noEmit && npm test && npx supabase test db`
Expected: tsc clean, 237 app tests, 217 database assertions.

- [ ] **Step 7: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/baselines/links.ts ciatta-mobile-app/supabase/functions/baselines/index.ts ciatta-mobile-app/src/data/links.test.ts
git commit -m "Work out which of her measurements happened near which others"
```

---

### Task 5: Push to the live project (controller, after the user says go)

Do not start without the user's explicit go.

- [ ] Confirm the live project holds exactly the sixteen migrations through `20260916100400` and none of this slice's.
- [ ] Create the two Vault secrets on the live project, `service_role_key` and `project_url`. These are secrets: they are created through a direct statement against the live database and never committed to a migration file, which is why Task 1's migration does not create them.
- [ ] Apply `20260917100000_scheduler.sql`, `20260917100100_scheduler_observability.sql`, `20260917100200_temporal_links.sql`, `20260917100300_temporal_links_gap_and_pair.sql` and `20260917100400_scheduler_configured.sql` through the Supabase API, in that order, then rewrite the recorded versions to match the filenames, as both previous pushes did.

  Five, not three. This list has now been short twice, both times because a later fix round added a migration and nothing came back to update it. Before pushing, check this list against `ls ciatta-mobile-app/supabase/migrations` rather than trusting it, and count: the slice adds five files, the live project holds sixteen, so a correct push ends at twenty one.

  `20260917100300` is not optional and is easy to miss, because it was written by a later fix round than the one that drafted this list. It adds the two guards that have to be in place **before** anything writes a row: `temporal_links_gap_matches_relation`, which stops a row claiming `same_day` while carrying a gap of 900 hours, and the unique index `temporal_links_pair_once`, which stops the same pair landing twice when it arrives the other way round. `links.ts` names the second one in a comment and relies on it: the generator's sort is what keeps a pair stable across runs, and that index is what catches the sort going unstable, by raising 23505 rather than quietly storing the pair twice.
- [ ] Redeploy `baselines` with `verify_jwt = true` and the links step included.
- [ ] Verify: `get_advisors` security, a grants query proving `anon` holds nothing on `temporal_links` and `authenticated` holds select only, and a function sweep proving neither Data API role can execute `baselines_tick` or `enqueue_baselines_reconciliation`.
- [ ] Verify both of `20260917100300`'s objects actually exist on the live `temporal_links`, by name rather than by assuming the migration ran. A missing one is invisible until her rows are already wrong, so this is asserted here alongside the grants:

  ```sql
  select
    (select count(*) from pg_constraint
      where conrelid = 'public.temporal_links'::regclass
        and conname = 'temporal_links_gap_matches_relation') as gap_matches_relation,
    (select count(*) from pg_class
      where relname = 'temporal_links_pair_once'
        and relkind = 'i') as pair_once;
  ```

  Both must return 1. A zero in either column means `20260917100300` was skipped, and the fix is to apply it before any job is allowed to write links, not after.
- [ ] Verify `20260917100400` landed too, the same way and for the same reason: `select scheduler_configured from public.scheduler_health` must return the column rather than erroring. An error here means the view is still the old eight column one, and the next step cannot be trusted.
- [ ] Confirm the scheduler actually ran: wait for one five minute tick, then `select * from public.scheduler_health`, and report what it says rather than assuming it worked.

  Read `scheduler_configured` FIRST. If it is false, the two Vault secrets were not created, or were created under the wrong names, and nothing has ever been posted no matter how green the rest of the row looks: `last_status` will read `succeeded` and every queue column will read 0, because the tick ran and correctly decided there was nothing it could do. Fix the secrets and wait for the next tick before reading anything else here.

  With `scheduler_configured` true: a `last_status` other than `succeeded`, or a `queue_pending_jobs` count that does not fall, means it did not work. The queue columns carry a `queue_` prefix (`20260917100100` renamed them); `pending_jobs` is not a column and a query using that name will error.
- [ ] On a real phone: connect Apple Health, then confirm within ten minutes that `baselines` and `changes` hold rows and that `temporal_links` holds plausible pairs.

---

## Self review

**1. Spec coverage.** Section 6's cadence (nightly reconciliation, refresh) is Task 1, with the morning refresh deliberately replaced by a five minute drain and the deviation recorded. Section 5.4's `temporal_links` is Tasks 3 and 4, including the exact enum values. The rest of 5.4 (threads, thread_evidence, insights, research_refs) and all of 5.5 belong to Slice 3b and are named as such, not silently dropped.

**2. Placeholder scan.** No TBDs. Every code step carries the actual SQL or TypeScript. Every test step carries real assertions and a stated expected failure.

**3. Type consistency.** `LinkInput` and `BuiltLink` are defined once in Task 4 and used with those names in the edge function wiring in the same task. `BuiltLink`'s field names are snake_case deliberately, matching the column names so the upsert needs no mapping layer beyond `user_id`. The `Relation` union in TypeScript is a strict subset of the database enum, and Task 4's rule 6 says why the other three values exist and are not produced here.

**4. Known gaps carried, not hidden.**
- UTC day bucketing: `isoDay` uses UTC, so `same_day` follows UTC days rather than her local ones. This is the same limitation Slice 2 recorded for `temp_deviation`, and fixing it properly means carrying her local day from the phone at ingest, which is a schema change.
- `pg_net` is fire and forget, so `baselines_tick` cannot report what the edge function did. Task 2's view is how that is answered instead.
- A tick fires ten posts whether or not there are ten jobs. Extra posts return `{processed: false}` cheaply. If that ever shows up as noise in the function logs, the fix is for the tick to read `pending_jobs` first, which is one query and was left out deliberately as premature.

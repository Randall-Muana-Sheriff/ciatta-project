# Backend Slice 2: Health Data, Baselines and Change Detection

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read her own health data from Apple Health into her record, store one row per day so every screen that draws sleep, movement and recovery shows her real numbers, and compute what is usual for her and what has changed against it.

**Architecture:** The phone reads Apple Health with anchored queries and posts batches to an `ingest-health` edge function, which writes observations and upserts `daily_metrics` with the service role. A second function computes `baselines` and `changes` per metric. Screens keep consuming the existing `Day[]` shape, now projected from `daily_metrics` instead of the sample generator.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, `@kingstinct/react-native-healthkit` 14 (already in the dev client; Podfile.lock carries it), Supabase Postgres 17, Deno edge functions, `node:test` via `tsx`, pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md` (sections 5.3, 5.4 baselines and changes, 6, 9 Slice 2, 10)

## Decisions taken before planning

| Decision | Choice | Why |
|---|---|---|
| Where daily data lives | A `daily_metrics` table, one row per person per day | Screens slice `days` as an ordered array; a table reads in one query with no fold on open |
| How data gets in | Server side, through an `ingest-health` edge function using the service role | Re-syncing a day must update, not collide with `unique (user_id, dedupe_key)`; observations have no client update policy by design |
| Platform | iOS HealthKit only | Testable today; Health Connect is restored but left switched off |
| Engine baselines | The engine keeps its own `sustained`/`band` math over `Day[]` | It already works and is tested; stored `baselines` serve Slice 3, they do not replace it |
| Background delivery | Not in this slice | Foreground sync on open plus manual Connect is enough; background delivery needs its own review |

## Global Constraints

- Never use an em dash, en dash or hyphen in user facing copy. Run every remote or templated string through `displayCopy()`. Compound words become separate words.
- No product name "Ciatta" in any user facing copy.
- Keep Jost and the current look. Do not change navigation, tabs, screen hierarchy or card architecture. Screens keep consuming `Day[]`.
- Null means unknown. A metric Apple Health has no sample for stays null; never write 0 for "no data".
- Real mode never shows sample data. Demo mode never writes to Supabase and never touches Apple Health.
- RLS on every new table. Owner reads her own rows; only the service role writes what the server derives.
- **Every new database function gets its own `revoke execute ... from public, anon, authenticated` in the same migration that creates it.** Default privileges do not cover this (learned on the live project, 15 Sep).
- Grants are revoke-then-grant, never additive.
- The service role key never appears in the app. Only edge functions use it.
- Every schema change is a migration file. Nothing is applied to the live project until the final task, which waits for the user's explicit go.
- Tests: `npm test` and `supabase test db` both clean at the end of every task (126 and 86 passing now).
- Commit after each task, message ending with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01JSvawNVMbPeuzNciSz1AGj`
- Never commit `ciatta-visual-assets/` or `.env`.

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260915100700_daily_metrics.sql` | `daily_metrics`, RLS, grants |
| `supabase/migrations/20260915100800_baselines_changes.sql` | `baselines`, `changes`, RLS, grants |
| `supabase/migrations/20260915100900_jobs.sql` | `jobs` queue, enqueue trigger, RLS |
| `supabase/tests/daily_metrics.test.sql`, `baselines.test.sql` | isolation, ownership, upsert |
| `supabase/functions/ingest-health/index.ts` + `batch.ts` | verify caller, validate batch, write observations and daily rows |
| `supabase/functions/baselines/index.ts` + `compute.ts` | baselines and change detection |
| `src/lib/healthMetrics.ts` | the metric map: identifier, metric, unit, how it folds into a day |
| `src/lib/healthSamples.ts` | pure sample to observation and day mapping |
| `src/lib/healthKit.ts` | availability, permission, anchored queries (device only) |
| `src/lib/healthSync.ts` | the sync loop: query, batch, post, advance anchors |
| `src/data/dailyRows.ts` | `daily_metrics` row to `Day` projection |
| `src/data/repo.ts` | `loadDays`, `saveSourceStatus` |
| `src/screens/ProfileScreen.tsx` | Connect a Source becomes the real flow |

---

### Task 1: The daily_metrics table

**Files:** Create `supabase/migrations/20260915100700_daily_metrics.sql`, `supabase/tests/daily_metrics.test.sql`

**Interfaces:** Produces `public.daily_metrics`, unique `(user_id, day)`, columns matching `Day` exactly: `day date`, `sleep_hours numeric`, `stage_awake numeric`, `stage_rem numeric`, `stage_light numeric`, `stage_deep numeric`, `time_in_bed numeric`, `steps integer`, `active_minutes numeric`, `workouts jsonb`, `resting_hr numeric`, `hrv numeric`, `temp_deviation numeric`, `energy smallint`, `mood smallint`, `stress smallint`, `caffeine numeric`, `alcohol numeric`, `foods text[]`, `digestion text[]`, `note text`, plus `source_id`, `provenance`, `metadata`.

- [ ] **Step 1: Write the failing test**

`supabase/tests/daily_metrics.test.sql`: two users; A inserts a day; re-inserting the same `(user_id, day)` with new values updates rather than duplicating; B sees zero rows; B cannot update or delete A's row (zero rows affected, value unchanged when re-checked as postgres); anon gets 42501; a day with only `steps` leaves every other column null; deleting the auth user removes the row.

- [ ] **Step 2: Run it, see it fail**

Run: `supabase test db` → fails, `relation "public.daily_metrics" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- One row per person per day: what her devices measured and what she checked
-- in. Mirrors the Day shape the screens already read. Every column is
-- nullable: a metric Apple Health has no sample for stays unknown.
create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid,
  provenance public.provenance not null default 'MEASURED',
  day date not null,
  sleep_hours numeric,
  stage_awake numeric,
  stage_rem numeric,
  stage_light numeric,
  stage_deep numeric,
  time_in_bed numeric,
  steps integer,
  active_minutes numeric,
  workouts jsonb not null default '[]',
  resting_hr numeric,
  hrv numeric,
  temp_deviation numeric,
  energy smallint check (energy between 1 and 5),
  mood smallint check (mood between 1 and 5),
  stress smallint check (stress between 1 and 5),
  caffeine numeric,
  alcohol numeric,
  foods text[] not null default '{}',
  digestion text[] not null default '{}',
  note text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day),
  constraint daily_metrics_provenance_client_check
    check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED')),
  constraint daily_metrics_source_id_user_id_fkey
    foreign key (source_id, user_id) references public.health_sources (id, user_id)
    on delete set null (source_id)
);
create index daily_metrics_user_day on public.daily_metrics (user_id, day desc);
select public.enable_owner_rls('daily_metrics');
revoke all on public.daily_metrics from anon, authenticated;
grant select, insert, update, delete on public.daily_metrics to authenticated;
grant all on public.daily_metrics to service_role;
```

- [ ] **Step 4: Apply and test**

Run: `supabase db reset && supabase test db` → all files ok.

- [ ] **Step 5: Commit** `git commit -m "Add one row per day for what her devices measured"`

---

### Task 2: Baselines and changes

**Files:** Create `supabase/migrations/20260915100800_baselines_changes.sql`, `supabase/tests/baselines.test.sql`

**Interfaces:** Produces `public.baselines` (`metric`, `window_days`, `median`, `low`, `high`, `variability`, `n`, `sufficient`, `computed_at`, unique `(user_id, metric, window_days)`) and `public.changes` (`metric`, `from_value`, `to_value`, `window_days`, `deviation`, `direction`, `quality`, `detected_at`, unique `(user_id, metric, detected_on)`).

Both are server derived: `authenticated` gets **select only**, no insert, update or delete; `service_role` gets all. Provenance on any observation these produce is `DERIVED`, which the client may not write.

- [ ] **Step 1: Write the failing test**

`supabase/tests/baselines.test.sql`: A can read her own baseline row inserted as postgres; A cannot insert one (42501); A cannot update or delete one (42501); B sees none; anon sees 42501; deleting the user cascades both tables.

- [ ] **Step 2: Run it, see it fail.**

- [ ] **Step 3: Write the migration**

Tables as above, with:

```sql
alter table public.baselines enable row level security;
create policy "owner select" on public.baselines for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.baselines from anon, authenticated;
grant select on public.baselines to authenticated;
grant all on public.baselines to service_role;
```

and the same shape for `changes`. Add `create trigger ... touch_updated_at` on both.

- [ ] **Step 4: Apply and test. Step 5: Commit.**

---

### Task 3: The jobs queue

**Files:** Create `supabase/migrations/20260915100900_jobs.sql`, extend `supabase/tests/isolation.test.sql`

**Interfaces:** Produces `public.jobs` (`user_id`, `kind` check in ('baselines'), `status` check in ('pending','running','done','failed'), `attempts`, `last_error`, `created_at`, `started_at`, `finished_at`), unique partial index so one pending job per user per kind; `public.enqueue_job(uid uuid, kind text)` as a definer function with `revoke execute from public, anon, authenticated`; an after insert or update trigger on `daily_metrics` that enqueues `baselines` for that user.

- [ ] **Step 1: Write the failing test** in `isolation.test.sql`: inserting a daily row as A creates exactly one pending job for A; a second insert does not create a second pending job; A cannot select, insert or update `jobs` at all (42501); service role can.

- [ ] **Step 2: Run it, see it fail. Step 3: Write the migration. Step 4: Apply and test. Step 5: Commit.**

Note for the implementer: the queue is server only. `jobs` gets **no** grant to `authenticated`, so RLS is belt and braces; the test proves the grant, not a policy.

---

### Task 4: The metric map and pure sample mapping

**Files:** Create `src/lib/healthMetrics.ts`, `src/lib/healthSamples.ts`; tests alongside.

Restore from `git show 9fe1b55:ciatta-mobile-app/src/lib/healthKitMap.ts` and `healthKitObservations.ts`, then cut to what this slice stores.

**Interfaces:**
- `type MetricSpec = { identifier: string; metric: string; domain: string; unit: string; fold: 'sum' | 'mean' | 'min' | 'last'; dayField?: keyof DayNumbers }`
- `QUANTITY_SPECS`: steps (sum → `steps`), active_energy and exercise_time (sum → `active_minutes`), resting_heart_rate (mean → `resting_hr`), hrv (mean → `hrv`), wrist_temperature and basal_body_temperature (mean → `temp_deviation`), heart_rate (mean, observation only), respiratory_rate, oxygen_saturation (observation only).
- `SLEEP_SPEC`: `HKCategoryTypeIdentifierSleepAnalysis` → `sleep_hours`, `time_in_bed`, and the four stage fields, using `sleepStageLabel` from the old file.
- `WORKOUT_SPEC` → `workouts` jsonb entries `{ type, minutes, intensity }`.
- `sampleToObservation(spec, sample): NewObservation` where `NewObservation = { domain, metric, value, unit, occurred_at, provenance: 'MEASURED', dedupe_key, metadata }`, `dedupe_key = 'healthkit:' + spec.metric + ':' + (sample.uuid ?? sample.startDate)`.
- `foldDay(samples): Partial<DailyRow>` grouping by local day.

- [ ] **Step 1: Write the failing tests** covering: steps sum across a day; a sleep night spanning midnight counted on the wake day; stage minutes summed per stage; a workout mapped with minutes and intensity; temperature averaged; a metric with no samples producing **no** key at all rather than 0; two samples with the same uuid producing the same `dedupe_key`.

- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit.**

---

### Task 5: The ingest function

**Files:** Create `supabase/functions/ingest-health/index.ts`, `batch.ts`; `src/data/ingest.test.ts` for the pure batch validator.

**Interfaces:** POST with the caller's bearer token and body `{ observations: NewObservation[], days: DailyRow[] }`, at most 500 observations and 120 days per call. The function resolves the user id **only** from the verified token, never the body; writes observations with `on conflict (user_id, dedupe_key) do update`; upserts `daily_metrics` on `(user_id, day)` merging only the keys present (a day carrying just `steps` must not blank `sleep_hours`); sets `source_id` to her Apple Health source, creating it as `kind = 'apple_health', status = 'active'` on first call; returns `{ observations: n, days: n }`. Rejects any provenance other than MEASURED or RECORDED with 400.

- [ ] **Step 1: Write the failing test** for `batch.ts`: rejects a batch over the cap, rejects DERIVED, accepts a valid batch, and merges day fields without clobbering absent ones.

- [ ] **Step 2 to 4: implement, `deno check`, run the local smoke test** (`supabase functions serve ingest-health`, then curl with a real session token created through the auth admin API; disk check first, stop with BLOCKED under 3 GB free).

- [ ] **Step 5: Commit.**

---

### Task 6: The baselines function

**Files:** Create `supabase/functions/baselines/index.ts`, `compute.ts`; tests for `compute.ts`.

**Interfaces:** Claims one pending job, computes per metric over `daily_metrics`: `median`, `low`, `high` (the engine's MAD band, ported verbatim from `src/lib/engine.ts:116`), `variability`, `n`, and `sufficient = n >= 20`; window 35 to 90 days back, matching the engine. Writes `baselines` and, where the most recent stretch sits outside the band on one side for 5 or more days, a `changes` row. Marks the job done, or failed with `last_error` after 3 attempts.

- [ ] **Step 1: Write the failing tests** for `compute.ts` against fixed arrays: fewer than 20 values yields `sufficient false` and no change row; a flat series yields a band no narrower than 8 percent either side; a 6 day dip below the band yields one change row with direction lower; one day back inside the band does not break a streak, two do.

- [ ] **Step 2 to 5: implement, test, deploy locally, commit.**

Ruling to carry: this function reproduces the engine's math rather than replacing it. If the two ever disagree, the engine is the reference, because it is what the screens show.

---

### Task 7: Device reading and sync

**Files:** Create `src/lib/healthKit.ts`, `src/lib/healthSync.ts`; tests for the sync loop against a fake port.

**Interfaces:**
- `isHealthAvailable(): Promise<boolean>`, `requestHealthPermission(): Promise<{ granted: boolean; reason?: string }>`
- `type SyncPort = { query(identifier, opts): Promise<{ samples, newAnchor }>; post(batch): Promise<void> }`
- `runHealthSync(userId, { port, anchors, onProgress, mode })`, anchors keyed `hk-anchor.v1.<userId>.<identifier>` in AsyncStorage (per account, as the outbox and loop keys already are), 250 rows per batch, recovery mode reading 90 days back, incremental mode from the stored anchor.

- [ ] **Step 1: Write the failing tests:** a fake port proves anchors advance only after a successful post; a failed post leaves the anchor untouched so the next run re-reads; two runs over the same samples post the same dedupe keys; progress is reported per type.

- [ ] **Step 2 to 5: implement, test, commit.** `healthKit.ts` is device only and is never imported by a test.

---

### Task 8: Connect a Source, for real

**Files:** Modify `src/screens/ProfileScreen.tsx` (Settings only), `src/data/repo.ts`, `src/state/session.tsx` if a sync trigger belongs there.

**Interfaces:** `repo.loadDays(): Promise<Day[]>` reading `daily_metrics` ordered by `day` through `paginateAll`, projected by `src/data/dailyRows.ts`; `repo.saveSourceStatus(kind, status, lastSyncedAt)`.

Connect a Source in real mode: checks availability, asks permission, runs a recovery sync with the existing progress copy, then sets the Apple Health source to `active` with `last_synced_at`. Refused permission sets `refused` and says so plainly. On a simulator with no Health data, availability is false and the row reads `Not available yet`, which is honest rather than a failure. Demo mode keeps today's notice.

- [ ] **Step 1 to 5** as usual, plus a simulator screenshot of Profile after a sync attempt, or a plain statement that tapping could not be automated.

---

### Task 9: Real days on every screen

**Files:** Create `src/data/dailyRows.ts`; modify `src/data/adapter.ts`, `src/state/session.tsx`.

**Interfaces:** `rowToDay(row): Day`, `daysFromRows(rows): Day[]` filling the gap days between rows with a day whose measured fields are null, so `slice(-14)` still spans 14 calendar days. `dataFor` in real mode takes `days` from a loader instead of returning `[]`.

- [ ] **Step 1: Write the failing tests:** a row with only steps projects to a Day whose `sleepHours` is null and whose `digestion` is empty; a missing calendar day appears as an all null day; rows come back oldest first; `dataFor('real', name, days)` carries them while every sample piece stays null.

- [ ] **Step 2 to 4: implement, typecheck, test.**

- [ ] **Step 5:** confirm the engine tolerates real days with nulls: run `npm test` and add one case feeding 90 projected days with sleep only.

- [ ] **Step 6: Commit.**

---

### Task 10: Push to the live project (controller, after the user says go)

Do not start without the user's explicit go.

- [ ] Verify the live schema matches the local one before pushing.
- [ ] Apply the three migrations through the Supabase API (the CLI needs a TTY it does not have here), then rewrite the recorded versions to match the filenames, exactly as Slice 1's push did.
- [ ] Deploy `ingest-health` and `baselines`.
- [ ] Schedule the nightly baselines run with `pg_cron`, or state plainly that it is deferred.
- [ ] Verify with `get_advisors` (security), a grants query proving `anon` holds nothing and `authenticated` holds select only on `baselines` and `changes`, and a function sweep proving no new function is callable by either role.
- [ ] On a real phone: connect Apple Health, confirm days appear on Sleep, Movement and Health, and that a second sync adds no duplicates.

---

## Self review

- **Spec coverage:** 5.3 observations from devices (Tasks 4, 5); 5.4 baselines and changes (Tasks 2, 6); section 6 pipeline and cadence (Tasks 3, 6, 10); section 9 Slice 2 (all); section 10 testing (every task).
- **Deferred deliberately:** background delivery, Health Connect, temporal links and threads (Slice 3), the `at_hash` warning on Google sign in (app wide, not this slice).
- **Carried from Slice 1's ledger:** every new function gets its own revoke; `saveCycleProfile` updating zero rows silently is worth hardening while `repo.ts` is open in Task 8.
- **Names used consistently:** `daily_metrics`, `baselines`, `changes`, `jobs`, `NewObservation`, `DailyRow`, `runHealthSync`, `rowToDay`, `daysFromRows`, `loadDays`.

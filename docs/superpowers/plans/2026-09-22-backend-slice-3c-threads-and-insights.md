# Backend Slice 3c: Threads, Insights and the Evidence Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn what the pipeline already stores about her (baselines, changes, temporal links, her own entries) into a thread when the same relationship has recurred, and into an insight only when every link of the chain can be traced back to a stored row. Then show that insight on the Insight and Today screens in real mode, in place of the hard coded sample claim.

**Architecture:** Two migrations add `threads`, `thread_evidence`, `insights` and `research_refs`, owner read only, written by the service role. A third adds the `intelligence` job kind, enqueued by the baselines job on completion so it always runs over fresh changes and links, and drained by the same scheduler shape Slice 3a built. One `intelligence` edge function claims a job, reads her window, runs three pure modules (thread builder, gate, wording) and upserts threads by key. In the app, `realRepo.loadInsight()` reads the newest live insight with its evidence and the adapter projects it into the shape the Insight screen already renders; the screens do not change.

**Tech Stack:** Supabase Postgres 17, `pg_cron` and `pg_net` (installed by Slice 3a), Deno edge functions, pgTAP, `tsx --test` with `node:test`, Expo 57, React Native 0.86, `@supabase/supabase-js` 2.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md`, sections 5.2a, 5.4 (threads, thread_evidence, insights, research_refs), 6 (the chain, the gate, the language rule), 7 (Evidence and Insight rows of the map), 9 Slice 3, 11 test 1.

**Prior slices this rests on:** Slice 2 (`baselines`, `changes`, `daily_metrics`, `jobs`, the baselines function), Slice 3a (`temporal_links`, `baselines_tick`, `enqueue_baselines_reconciliation`, Vault secrets `project_url` and `service_role_key`), Slice 3b (`concepts`, `observations.concept_id`). Slice 3b renumbered this slice from 3b to 3c; that is why the file is called 3c.

## Decisions taken before planning

| Decision | Choice | Why |
|---|---|---|
| Where the reasoning runs | A separate `intelligence` function and job kind, not more steps inside `baselines` | The baselines run already skips its links step when a window is dense (links.ts, `MAX_LINKED_OBSERVATIONS`) to stay inside one request's CPU. Threads read every link and every change; putting that in the same request would make the skip fire sooner and take the baselines down with it. |
| When it runs | Enqueued by `complete_baselines_job`, drained by its own cron tick | Threads are built from changes and links, so running before baselines finish would read a stale window. Chaining on completion means it never does. |
| Engine sharing | The Deno function keeps its own pure modules, cross checked against `src/lib/engine.ts` by test, the way `compute.ts` does | The spec (section 2) proposed moving the engine to a shared folder. Slice 2 ruled instead that the app engine keeps its `Day[]` maths and the server keeps a checked copy, and Slice 3b followed. This slice follows too rather than reopening it. |
| What a thread is, in this slice | A recurring relationship between two metrics, keyed `a~b` with `a < b`, counted from stored changes and links | Only pairs are built here. Threads about a single sustained measure (spec 5.4 "sustained") belong to Slice 4's Today state, and threads across three or more domains are not attempted until pairs are proven. |
| Confidence | Stored as `confidence jsonb` with components and the names of what is missing, per the 16 September founder decision; **not rendered as a number in this slice** | The Decision Register still locks "no scale, no percentage, no score" and the spec calls itself the junior document until the Register is revised. Storing the components loses nothing; showing a score before the Register changes would break a lock. Task 8 renders only the missing pieces list. |
| Research refs | The table is created and the wording module can cite a ref, but no refs are seeded and no insight in this slice carries one | Every ref must be a real publication reviewed by a person. Seeding placeholders would be exactly the fabrication this project keeps removing. `research_context` evidence stays empty until refs exist. |
| Silence | When the chain cannot be completed, the function writes no insight and no thread status changes | Spec section 6: saying nothing is the ordinary outcome. The Insight screen then shows the existing empty note. This is a passing test, not a failure path. |
| Live project | Nothing is applied to `pghlquiwqnknpveyssui` until Task 10, which waits for the founder's explicit go | Every slice's rule. As of 22 September this machine's Supabase login cannot reach that project at all (403), so Task 10 also needs access granted. |

## Global Constraints

- Never represent an inference as a measured fact. A thread records that two things recurred near each other; an insight says so in words that keep the two apart.
- No cause, no diagnosis, no "you have". The wording module is the only place sentences are made, and its forbidden list is a test.
- Missing data is unknown. Never convert missing information into "none", and never into zero. A thread with too few recurrences is not written, not written with a low score.
- Absence is never shown as a value. No zeroes, no flat lines through gaps, no carried forward value.
- A user must only be able to access their own data. Never expose another user's health information. Every new table gets RLS and an owner select policy; only the service role writes.
- The service role key never appears in `src/`, in a migration, in a log line, or in a table a non superuser can read.
- No raw personal health information in logs. Ids, counts and error names only.
- Every new database function gets its own `revoke execute ... from public, anon, authenticated`. Revoke then grant, never additive.
- No em dash, en dash or hyphen in user facing copy. Compound words become separate words. Every sentence the wording module produces renders through `displayCopy()` in `src/lib/displayCopy.ts`. Git trailers are exempt.
- The product name never appears in user facing copy.
- Do not redesign the frontend, replace the navigation, or add screens. This slice changes data bindings only: `repo.ts`, `adapter.ts`, `session.tsx`.
- Migrations are new files. Never edit a migration already applied to the live project; the live project holds all twenty five through `20260918100300`.
- Tests: `npm test` and `supabase test db` both clean at the end of every task (316 and 278 passing now). Function typecheck: `npm run check:functions`.
- Commit after each task. Commits are authored by whoever runs the task, with no attribution trailers, per the repository owner's standing instruction.

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260922100000_threads.sql` | enum `thread_status`, tables `threads` and `thread_evidence`, RLS, grants |
| `supabase/migrations/20260922100100_insights.sql` | tables `insights` and `research_refs`, RLS, grants |
| `supabase/migrations/20260922100200_intelligence_job.sql` | `jobs.kind` gains `intelligence`; claim, complete, fail functions; `complete_baselines_job` enqueues it; `intelligence_tick` and its cron entry |
| `supabase/tests/threads.test.sql` | pgTAP for Task 1 |
| `supabase/tests/insights.test.sql` | pgTAP for Task 2 |
| `supabase/tests/intelligence_job.test.sql` | pgTAP for Task 3 |
| `supabase/functions/intelligence/threads.ts` | pure: changes, links and cycle observations to thread candidates |
| `supabase/functions/intelligence/wording.ts` | pure: structured fields to sentences, and the forbidden list |
| `supabase/functions/intelligence/gate.ts` | pure: the chain check that decides whether an insight may be written |
| `supabase/functions/intelligence/index.ts` | the function: claim, read, run, upsert, complete |
| `supabase/functions/intelligence/*.test.ts` | `node:test` for the three pure modules |
| `src/data/insightRows.ts` | projects `insights` plus evidence rows into the `Data['insight']` shape |
| `src/data/insightRows.test.ts` | the projection, including the empty case |
| `src/data/repo.ts` | `loadInsight()` on both repos |
| `src/data/adapter.ts`, `src/state/session.tsx` | real mode reads the loaded insight instead of `null` |

---

### Task 1: Threads and their evidence

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260922100000_threads.sql`
- Create: `ciatta-mobile-app/supabase/tests/threads.test.sql`

**Interfaces:**
- Consumes: `public.observations`, `public.changes`, `public.temporal_links`, `public.touch_updated_at()`.
- Produces: enum `public.thread_status` (`new, watching, recurring, contextualized, actionable, changed, resolved, continue`), table `public.threads` (`id, user_id, key text, title text, status thread_status, domains text[], first_observed_at, last_observed_at, observation_count integer, confidence jsonb, created_at, updated_at`, `unique (user_id, key)`), enum `public.evidence_role` (`supports, context, contradicts, alternative_explanation, user_reported, research_context`), table `public.thread_evidence` (`id, user_id, thread_id, role evidence_role, observation_id, change_id, link_id, research_ref_id, note text, created_at, updated_at`).

**What a thread key is.** `key` names the relationship, not the occasion: `cycle_length~sleep_hours`, with the two metric names sorted so the same pair always makes the same key. The unique constraint on `(user_id, key)` is what lets the function upsert: the same relationship seen again updates `last_observed_at` and `observation_count` rather than creating a second thread. The status values and evidence roles come verbatim from spec section 5.4.

**One evidence row points at exactly one thing.** A check constraint requires exactly one of `observation_id`, `change_id`, `link_id`, `research_ref_id` to be set (`research_ref_id` is added in Task 2, so this task's check covers the first three and Task 2 replaces it). A row that pointed at nothing, or at two things, could not be traced, and the whole point of the table is the trace.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/supabase/tests/threads.test.sql` following the shape of `temporal_links.test.sql`: `has_type` for both enums, `has_table` for both tables, RLS enabled on both, anon reads nothing, authenticated selects only (no insert, update, delete), service role has all, `col_is_unique('public','threads', array['user_id','key'])`, and three `throws_ok` cases for `thread_evidence` with SQLSTATE `23514`: no target set, two targets set, `observation_count` below zero on `threads`. Then a two user isolation block in the `isolation.test.sql` style: seed a thread for B as the table owner, switch to A's JWT, assert A's select over `threads` and `thread_evidence` returns zero rows. Plan count: 22.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: FAIL, the types and tables do not exist.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20260922100000_threads.sql`. Both tables follow `temporal_links` exactly: `user_id` references `auth.users` on delete cascade, `enable row level security`, one `"owner select"` policy `using (user_id = (select auth.uid()))`, a `_touch` trigger, `revoke all ... from anon, authenticated`, `grant select ... to authenticated`, `grant all ... to service_role`. Do not call `enable_owner_rls()`: it grants insert, update and delete policies, and the client must never write these tables. Index `threads (user_id, status)` and `thread_evidence (thread_id)`. `confidence` defaults to `'{}'::jsonb`; the function fills `{"components": {...}, "missing": [...]}` and nothing reads a number out of it in this slice.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: PASS, 13 files.

- [ ] **Step 5: Commit**

`git commit -m "Record a relationship that has recurred, and what it rests on"`

---

### Task 2: Insights and research references

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260922100100_insights.sql`
- Create: `ciatta-mobile-app/supabase/tests/insights.test.sql`

**Interfaces:**
- Consumes: `public.threads`, `public.thread_evidence`.
- Produces: table `public.research_refs` (`id, title, publication, year integer, url, summary, domains text[], reviewed_by text, reviewed_at timestamptz, created_at, updated_at`; reference data like `concepts`: RLS on, one `select` policy for `authenticated` with `using (true)`, no write policy, comment explaining why as `20260918100300` does), table `public.insights` (`id, user_id, thread_id, title, what_changed text, connected text, you_told text, not_established text, alternatives text[], status text check in (new, updated, continuing, resolved, dismissed), importance integer, confidence jsonb, valid_from timestamptz, valid_to timestamptz, dismissed_at, dismissal_reason text, created_at, updated_at`), and `thread_evidence.research_ref_id` with the exactly one target check widened to four columns.

**The four parts are columns, not one text.** `what_changed`, `connected`, `you_told` and `not_established` are the four sentences the Insight screen shows, each produced by the wording module from structured fields. Keeping them separate is what lets a later slice change the wording of one part without touching the others, and lets a test assert that `not_established` is never empty: an insight with nothing in that column has not named what it does not know, and the gate refuses it.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/supabase/tests/insights.test.sql`: both tables exist; `insights` has RLS with owner select only; `research_refs` has RLS with exactly one policy `research_refs_read`, `SELECT`, `authenticated` (mirror the four assertions from `concepts.test.sql` lines 44 to 53); `throws_ok` `23514` when `not_established` is empty string; `throws_ok` `23514` when `status` is outside the list; `fk_ok` from `insights.thread_id` to `threads.id`; `fk_ok` from `thread_evidence.research_ref_id` to `research_refs.id`; `throws_ok` `23514` when an evidence row sets both `observation_id` and `research_ref_id`. Isolation block: A cannot see B's insight. Plan count: 20.

- [ ] **Step 2: Run it to make sure it fails**

Expected: FAIL, tables do not exist.

- [ ] **Step 3: Write the migration**

`insights` follows the `threads` pattern. Add `constraint insights_not_established_named check (length(btrim(not_established)) > 0)`. `research_refs` follows the `concepts` pattern for grants and the `20260918100300` pattern for RLS. Then `alter table public.thread_evidence add column research_ref_id uuid references public.research_refs (id) on delete set null`, drop the Task 1 check constraint and recreate it over four columns.

- [ ] **Step 4: Run the test to verify it passes**

Expected: PASS, 14 files.

- [ ] **Step 5: Commit**

`git commit -m "Give an insight four parts, and a place for research that is about cohorts rather than her"`

---

### Task 3: The intelligence job

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260922100200_intelligence_job.sql`
- Create: `ciatta-mobile-app/supabase/tests/intelligence_job.test.sql`
- Modify: `ciatta-mobile-app/supabase/config.toml` (add `[functions.intelligence]` with `verify_jwt = true`)

**Interfaces:**
- Consumes: `public.jobs`, `public.enqueue_job(uuid, text)`, `public.complete_baselines_job(uuid)`, `public.baselines_tick(integer)`, Vault secrets `project_url` and `service_role_key`, `cron.schedule`.
- Produces: `jobs.kind` check widened to `('baselines', 'intelligence')`; `public.claim_intelligence_job()`, `public.complete_intelligence_job(uuid)`, `public.fail_intelligence_job(uuid, text)` mirroring the baselines trio including the crashed run reclaim from `20260916100200`; `complete_baselines_job` replaced so that after marking done it calls `enqueue_job(user_id, 'intelligence')`; `public.intelligence_tick(integer)` posting to `/functions/v1/intelligence`; a cron entry `intelligence-drain` on the same cadence as `baselines-drain`.

**Why the chain, and why it is safe.** `enqueue_job` is idempotent while a job is pending (`jobs_one_pending`), so ten baselines completions in a row queue one intelligence run, which reads everything they wrote. The reconciliation job in `enqueue_baselines_reconciliation` needs no change: a reconciled baselines run completes and so enqueues intelligence like any other.

- [ ] **Step 1: Write the failing test**

`intelligence_job.test.sql`: inserting a job with kind `intelligence` succeeds; kind `other` throws `23514`; `enqueue_job(A, 'intelligence')` twice leaves one pending row; completing a pending baselines job for A leaves exactly one pending intelligence job for A; `claim_intelligence_job()` returns A's job with status `running` and never a `baselines` job; `complete_intelligence_job` sets `done` and `finished_at`; `fail_intelligence_job` sets `failed` and `last_error`; `has_function` for `intelligence_tick`; every new function refuses execute to `authenticated` and `anon` and grants it to `service_role`; `cron.job` contains `intelligence-drain`. Plan count: 16.

- [ ] **Step 2: Run it to make sure it fails**

- [ ] **Step 3: Write the migration**

Copy the baselines trio from `20260916100000` and `20260916100200` with `kind = 'intelligence'`. Replace `complete_baselines_job` with a version whose last statement is `perform public.enqueue_job(v_user_id, 'intelligence')`, reading `v_user_id` from the row it just updated. Copy `baselines_tick` as `intelligence_tick` with the URL path changed. Schedule it with `cron.schedule('intelligence-drain', ...)` using the same expression `baselines-drain` uses in `20260917100400`. Every function: `security definer set search_path = ''`, then `revoke execute ... from public, anon, authenticated` and `grant execute ... to service_role`.

- [ ] **Step 4: Run the test to verify it passes**

Expected: PASS, 15 files. Also rerun `scheduler.test.sql` in your head: it counts cron jobs, so if it asserts an exact count, update that assertion in the same commit and say so in the message.

- [ ] **Step 5: Commit**

`git commit -m "Queue the reasoning to run after the arithmetic, never before it"`

---

### Task 4: The thread builder

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/intelligence/threads.ts`
- Create: `ciatta-mobile-app/supabase/functions/intelligence/threads.test.ts`

**Interfaces:**
- Consumes: plain rows, no Deno imports (so `tsx --test` can run it, as `compute.ts` is tested): `ChangeRow { id, metric, direction, detected_on, deviation, quality }`, `LinkRow { id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on }`, `ObservationRow { id, metric, occurred_at, value }`, `EpisodeRow { id, occurred_on, kinds, period_start }`.
- Produces: `buildThreads(input): ThreadCandidate[]` where `ThreadCandidate = { key, title, domains, occurrences: Occurrence[], firstObservedAt, lastObservedAt, evidence: EvidenceRef[], missing: string[] }` and `Occurrence = { at: string, aObservationId, bObservationId, linkId }`.

**The rule, stated once.** An occurrence is a `temporal_links` row whose two observations carry different metrics from the pair. A candidate exists when the pair has at least `MIN_RECURRENCE = 2` occurrences on distinct `occurred_on` days at least `MIN_SEPARATION_DAYS = 7` apart. That mirrors `engine.ts` line 607: one earlier match is not enough to call it recurring. Cycle length is derived here from consecutive `period_start` observations, the same way `cycleTrend` in `engine.ts` does, so that `cycle_length` can be one side of a pair even though no table stores it. `missing` names what the candidate lacks: `no_change_row` when neither metric has a `changes` row in the window, `single_source` when both observations came from the same source, `no_context` when no journal or episode falls within 7 days of any occurrence.

- [ ] **Step 1: Write the failing tests**

Cover: two occurrences 30 days apart make one candidate with key `cycle_length~sleep_hours` (sorted); the same two occurrences with the pair reversed make the same key; one occurrence makes nothing; two occurrences 3 days apart make nothing; occurrences between the same two observation ids are counted once; `missing` includes `no_change_row` when `changes` is empty; the cycle length derivation over `period_start` observations dated 1 Jan, 30 Jan, 27 Feb gives lengths 29 and 28, and a single `period_start` gives no length (unknown, not zero). Cross check: for one shared fixture, the lengths agree with `cycleTrend` from `src/lib/engine.ts`, imported by relative path exactly as `compute.test.ts` imports `median`.

- [ ] **Step 2: Run them, see them fail**

Run: `cd ciatta-mobile-app && npm test`

- [ ] **Step 3: Write the implementation**

- [ ] **Step 4: Run the tests to verify they pass**

- [ ] **Step 5: Commit**

`git commit -m "Count how often two things have recurred near each other, and say what is still missing"`

---

### Task 5: The wording module

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/intelligence/wording.ts`
- Create: `ciatta-mobile-app/supabase/functions/intelligence/wording.test.ts`

**Interfaces:**
- Consumes: `ThreadCandidate` plus the two metrics' display names and units, and the change rows for each side.
- Produces: `wordInsight(candidate, facts): InsightText` with `{ title, whatChanged, connected, youTold, notEstablished, alternatives: string[] }`, and `FORBIDDEN: readonly string[]`.

**The only place sentences are made.** Structured fields in, sentences out, and every sentence is built from a fixed set of frames: "followed", "occurred alongside", "seen N times across M months", "do not show that one brought on the other" (the plan first wrote that frame with "caused", a word on its own forbidden list; the frame was changed rather than the list). `FORBIDDEN` holds the words no sentence may contain: `cause`, `caused`, `causing`, `because`, `diagnos`, `you have`, `condition`, `disorder`, `syndrome`, `deficien`, `risk of`. `youTold` is built only from journal entries and episodes inside the occurrence windows; when there are none it says so ("You did not note anything around these days"; "you have" is on the forbidden list, so the earlier draft of this sentence could not stand) rather than being blank. `notEstablished` always names the `missing` list in words plus the standing line that things happening near each other do not show that one brought on the other.

- [ ] **Step 1: Write the failing tests**

Every produced sentence: contains none of `FORBIDDEN` (case insensitive); contains no em dash, en dash or hyphen; does not contain the product name; `notEstablished` is non empty for every fixture including one with an empty `missing` list; `youTold` for a candidate with no context entries is the fixed sentence above; a candidate seen twice across 7 months words the meta as "Seen twice across 7 months"; counts of times follow `engine.ts`'s `word()` (once, twice, three times), while measured spans stay in digits (7 months, 14 days, 5.4 hours), as the engine's own briefs do.

- [ ] **Step 2: Run them, see them fail**

- [ ] **Step 3: Write the implementation**

- [ ] **Step 4: Run the tests to verify they pass**

- [ ] **Step 5: Commit**

`git commit -m "Say what recurred in words that keep the two things apart"`

---

### Task 6: The gate

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/intelligence/gate.ts`
- Create: `ciatta-mobile-app/supabase/functions/intelligence/gate.test.ts`

**Interfaces:**
- Consumes: `ThreadCandidate` and the rows it references.
- Produces: `gate(candidate): { pass: true } | { pass: false; reason: GateReason }` with `GateReason` in `no_finding, no_relationship, no_source, insufficient_recurrence, stale`.

**The chain, checked link by link.** Finding: at least one side has a `changes` row in the window. Relationship: at least `MIN_RECURRENCE` occurrences (Task 4 already guarantees this; the gate asserts it again so a future builder change cannot slip past). Interpretation and her context: produced by wording, never gated on, because absence of context is stated rather than failed. Evidence: every occurrence's link row exists. Source: every observation in an occurrence has a `source_id` or a provenance of `REPORTED`. Stale: `lastObservedAt` older than 120 days fails, because an insight about something that stopped recurring four months ago is not today's insight; the thread stays, the insight is not written.

- [ ] **Step 1: Write the failing tests**

One fixture per reason, plus one that passes. The passing fixture is the spec's section 11 test 1 shape: cycles 29, 28, 27, 26 with a sleep change row and two links.

- [ ] **Step 2 to 4:** run, implement, pass.

- [ ] **Step 5: Commit**

`git commit -m "Write an insight only when every link of the chain can be traced"`

---

### Task 7: The intelligence function

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/intelligence/index.ts`
- Modify: `ciatta-mobile-app/supabase/config.toml`

**Interfaces:**
- Consumes: `claim_intelligence_job`, `complete_intelligence_job`, `fail_intelligence_job`, the paged reads from `../baselines/paging.ts` (import by relative path; Deno allows it and it keeps one copy of the keyset logic), tables `changes`, `temporal_links`, `observations`, `episodes`, `journal_entries`.
- Produces: upserts into `threads` on `(user_id, key)`, replaces that thread's `thread_evidence`, inserts an `insights` row when the gate passes and the newest live insight for the thread differs in its four parts (else updates `updated_at` and status `continuing`), and `valid_to` on the previous insight when a new one is written.

Mirror `baselines/index.ts` exactly for: the constant time service role check, the 405 on non POST, the `PGRST116` empty queue case, complete or fail with an error name only, and paged reads over `observations`. Window: 180 days, twice the baselines window, because recurrence needs more history than a baseline does; state the constant and why. Status transitions: a new thread is `new`; a thread whose `observation_count` rose since last run becomes `recurring`; one that has been `recurring` and gains no occurrence for 60 days becomes `watching`. Nothing else changes status in this slice. Logs: `intelligence threads upserted <n>`, `intelligence insight written <threadKey>` is **not** logged (a key names two metrics about her; log a count instead).

- [ ] **Step 1: Typecheck target first**

Add `[functions.intelligence]` with `verify_jwt = true` to `config.toml`. Run `npm run check:functions` and make it pass on an empty `index.ts` that only serves 405.

- [ ] **Step 2: Write the function**

- [ ] **Step 3: Run it locally end to end**

With `supabase start` up: seed one user with the section 11 test 1 data through the local Data API as the service role (a small `scripts/seed-loop.ts` run with `tsx`, kept out of `src/`), run `supabase functions serve intelligence` and post to it with the local service role key. Assert with `psql`: one thread `cycle_length~sleep_hours` with `observation_count` 2, one insight with four non empty parts, evidence rows pointing at real link ids. Post again: no second insight, `updated_at` moved. Record the exact commands in the commit message body.

- [ ] **Step 4: Commit**

`git commit -m "Build threads from what recurred, and write an insight only when the chain holds"`

---

### Task 8: Show the real insight

**Files:**
- Create: `ciatta-mobile-app/src/data/insightRows.ts`
- Create: `ciatta-mobile-app/src/data/insightRows.test.ts`
- Modify: `ciatta-mobile-app/src/data/repo.ts`, `ciatta-mobile-app/src/data/adapter.ts`, `ciatta-mobile-app/src/state/session.tsx`

**Interfaces:**
- Consumes: `insights` (newest row for the user with `valid_to is null` and status not `dismissed`), its `thread`, and its `thread_evidence` joined to `observations`.
- Produces: `Repo.loadInsight(): Promise<InsightView | null>`; `insightView(rows): Data['insight']` with `headline = title`, `meta` from the thread's count and span, `basedOn` one row per `supports` evidence with `label` the observation's metric display name, `sub` its date, `value` its value with unit, `screen` mapped by domain (`cycle`, `sleep`, `symptoms`, `journal`), `evidence` from the first `research_context` row or the fixed line "No published research is attached to this yet", `stillOpen = not_established`, `method` four rows: looked at, pattern, times seen, what is missing (the `confidence.missing` list in words). `demoRepo.loadInsight()` returns `sample.insight` unchanged.

Screens do not change. `InsightScreen` already renders exactly this shape and already shows `EmptyNote` when it is null. `TodayScreen`'s headline in real mode comes from `REAL_TODAY_TEXT` today; change only `adapter.ts` so that when a real insight exists, `today.headline` is its title and `today.kicker` is its meta, and otherwise the existing real mode text stays.

- [ ] **Step 1: Write the failing tests**

`insightRows.test.ts`: the projection of a fixture with two supports rows gives two `basedOn` entries in date order; an insight with no `research_context` evidence gives the fixed evidence line; `method` always has four rows; every string in the output passes `displayCopy` unchanged (no dashes); `null` in gives `null` out.

- [ ] **Step 2 to 4:** run, implement (load in `session.tsx` beside `loadDays`, once per session, same `ignore` pattern), pass. `npm test` stays green including the existing adapter tests.

- [ ] **Step 5: Commit**

`git commit -m "Show her own insight where the sample one used to be"`

---

### Task 9: The learning loop, first half, end to end

**Files:**
- Create: `ciatta-mobile-app/scripts/loop-part-one.ts`, run as `npm run test:loop` (the plan first named a pgTAP file here; pgTAP cannot call an edge function, so the acceptance test is a script that serves the functions itself, posts, and checks the rows, and it also reads the insight back as her through `realRepo.loadInsight()`, proving the app's joins and its row level security)
- Modify: `ciatta-mobile-app/scripts/seed-loop.ts` (from Task 7), so the seed is an importable function

Spec section 11 test 1 up to "watch next cycle": seed cycles 29, 28, 27, 26 and sleep 7h18 then 6h12 with a reported stressful stretch, run intelligence locally, assert one thread, one insight whose `you_told` contains the reported note, `not_established` non empty, and that a second run with no new data writes no second insight (section 11 test 3, "nothing happened"). This is the acceptance test for the slice; it is written last because it needs everything above, and it is what Task 10 shows the founder before asking for the go.

- [ ] **Step 1 to 3:** write, run, commit.

`git commit -m "Prove the first half of the loop: recur, thread, insight, then silence"`

---

### Task 10: Push to the live project (controller, after the founder says go)

**Blocked until two things are true:** the founder has read Task 9's result and said go, and this machine's Supabase account has been granted access to `pghlquiwqnknpveyssui` (as of 22 September it receives 403 on every project endpoint).

Then: `supabase link --project-ref pghlquiwqnknpveyssui`, `supabase db push` (three migrations), `supabase functions deploy intelligence`, confirm `cron.job` holds `intelligence-drain`, watch one tick post and one job move to `done`, and record the counts (never the content) in the commit that closes the slice.

## Self review

- Every spec table in 5.4 now exists: baselines and changes (Slice 2), temporal_links (3a), threads, thread_evidence, insights, research_refs (this slice). 5.5 is Slice 4.
- The gate is the chain, not a questionnaire, per the corrected section 6. Four honest silences map to: no candidate (no relationship found), gate fails on `no_finding` (no applicable interpretation), `stale` or `insufficient_recurrence` (waiting for new evidence), `no_source` (missing data). The screen shows the existing empty note in every case; naming which one is Slice 4.
- Confidence: stored, not shown as a number. The Register lock holds until it is revised.
- No screen changes, no navigation changes, no product name in copy, no dashes, no cause.

## Binding constraint carried to Slice 4

Slice 4 (recommendations, actions, outcomes, learning events, insight_views, Today's then and now) may read `insights.status` and `threads.status` but must not write `threads` or `insights` from the client. Every status change goes through the intelligence function or a security definer RPC with its own revoke, so the trace stays true.

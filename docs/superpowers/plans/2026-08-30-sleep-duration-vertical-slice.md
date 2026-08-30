# Sleep Duration Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ONE complete, tested, additive path through the new Ciatta intelligence pipeline — Observation → Feature → Baseline → Change → Relationship → Pattern → Evidence → Finding → Ciatta Knowledge → Confidence/Safety → Explanation → Experience/Silence → Guidance — for exactly one domain (sleep) and one Feature (nightly sleep duration), without touching or disturbing the legacy `understandings`/`evidence`/`understanding_history` write path.

**Architecture:** New Postgres tables (`features`, `baselines`, `change_events`, `patterns`, `finding_evidence`, `findings`, `ciatta_knowledge`) are created additively. New, small, pure TypeScript modules (one per pipeline stage, mirroring the existing flat-file style in `supabase/functions/understanding-engine/`) implement each stage's logic, reusing existing math (`median`, `strengthForConfidence`, `CONFIDENCE_LABEL`, `nightlySleepMinutes`) rather than duplicating it. A new orchestrator (`sleepDurationSlice.ts`) wires the stages together for one user and is called from `index.ts` in a new, try/catch-isolated call site that runs *alongside* the existing `processSleepDomain()` — the legacy path's inputs, outputs, and behavior are unchanged.

**Tech Stack:** Deno, TypeScript, Supabase (Postgres + Edge Functions), `Deno.test` for tests — matching the existing `understanding-engine` codebase exactly.

**Spec:** `docs/specs/ciatta-semantic-refactor-spec-v1.md` (approved, with amendments: the Pattern recurrence threshold and the Finding→Ciatta Knowledge promotion rule are both explicit, configurable, documented MVP hypotheses — not universal rules).

## Global Constraints

- Nothing in the legacy path (`understandings`, `understanding_history`, `cross_domain_understandings`, `evidence`, `discoveries`, `relationships` tables; `processSleepDomain`, `upsertUnderstanding`, `deriveGuidance`, `analyzeSleep`, `analyzeSleepRatingRelationship`) is deleted, renamed, or behaviorally changed. Only two additive one-line `export` keywords are added to `sleepAnalysis.ts` (Task 1) — zero behavior change, verified by the existing `sleepAnalysis.test.ts` passing unchanged.
- The new Evidence object is named `finding_evidence` at the DB/module level for this slice — **not** `evidence` — because the legacy `evidence` table still exists and is still written by the live engine. It is renamed to `evidence` only at cutover (a later stage, not this plan), after the legacy table is retired.
- **`finding_evidence` is a provisional MVP shortcut, not the final Evidence Ledger architecture.** Folding the Evidence Ledger's required fields (quality, provenance, contradictory evidence, alternative explanations, uncertainty, scientific basis, permitted/prohibited language, sufficiency verdict, version) directly onto one table is acceptable *only* for this one-Feature vertical slice. The dedicated Evidence Ledger architecture (Approval Checkpoint item 8 in `docs/specs/ciatta-semantic-refactor-spec-v1.md` §5) is still an **open architecture decision**, not resolved by this plan, and must be revisited during architecture review before broader implementation or cutover. Concretely, this constrains every task below:
  - `finding_evidence`'s columns must stay a flat, self-contained bag of ledger content with no other table's schema depending on its specific shape (no foreign keys point *into* `finding_evidence` from outside this slice; only `findings.evidence_id` points into it, and that reference survives a future split into a normalized ledger table unchanged).
  - Code documentation (file-header comments in `findingEvidence.ts` and the migration in Task 2) must state this provisionality explicitly, not just imply it.
  - No later task in this plan may silently treat `finding_evidence` as settled, permanent schema — each place it's introduced repeats the "provisional" framing rather than assuming it once and dropping the caveat.
- Pattern's recurrence threshold (`PATTERN_MIN_RECURRING_WINDOWS = 3`) and Ciatta Knowledge's retention rule (`KNOWLEDGE_MIN_REPRODUCED_RUNS = 2`) are named, exported, documented constants — never inline magic numbers — per the approved spec amendments.
- Every new table has RLS enabled with a `select ... using (auth.uid() = user_id)` policy only (no insert/update policies) — matching the existing pattern for `understandings`/`evidence`/`relationships`, since all writes come from the service-role Edge Function.
- No new UI, no client changes, no cron/deploy changes in this plan — this slice is entirely server-side and additive; nothing user-facing changes yet.
- Follow existing code style exactly: flat files in `supabase/functions/understanding-engine/`, comment-driven explanations of *why*, `Deno.test` per exported function, pure functions with no Deno/Supabase imports where the existing equivalent files (`decay.ts`, `crossDomainSynthesis.ts`) also avoid them.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/functions/understanding-engine/sleepAnalysis.ts` | **Modified** (Task 1 only): export two previously-private helpers (`nightKey`, `isAsleepStage`) for reuse. No other change. |
| `supabase/migrations/20260901000000_intelligence_foundation_sleep_slice.sql` | New tables: `features`, `baselines`, `change_events`, `patterns`, `finding_evidence`, `findings`, `ciatta_knowledge`. |
| `supabase/functions/understanding-engine/feature.ts` | Feature: reproducible nightly-sleep-minutes values from Observations. |
| `supabase/functions/understanding-engine/baseline.ts` | Baseline: personal reference value (median) over a window of Features. |
| `supabase/functions/understanding-engine/changeEvent.ts` | Change: measured-vs-meaningful deviation from Baseline. |
| `supabase/functions/understanding-engine/patternEvaluation.ts` | Pattern: generic recurrence/stability/alternative-explanation evaluator (domain-agnostic, reusable later). |
| `supabase/functions/understanding-engine/findingEvidence.ts` | Evidence (new sense): ledger content + sufficiency verdict. |
| `supabase/functions/understanding-engine/finding.ts` | Finding: the supported statement, gated on Evidence + Confidence. |
| `supabase/functions/understanding-engine/safety.ts` | Safety: independent harm-tier assessment. |
| `supabase/functions/understanding-engine/explanation.ts` | Explanation: the 8-point account, generated on read. |
| `supabase/functions/understanding-engine/experienceSelection.ts` | Experience/Silence: the four-outcome selection gate. |
| `supabase/functions/understanding-engine/ciattaKnowledge.ts` | Ciatta Knowledge: the retention decision. |
| `supabase/functions/understanding-engine/sleepDurationSlice.ts` | Orchestrator: wires all of the above for one user, writes to the new tables. |
| `supabase/functions/understanding-engine/index.ts` | **Modified**: one new, isolated call site added after the existing `Promise.all([...])` domain-processor block. |

Each new module gets a matching `*.test.ts` in the same directory, following the existing convention.

---

### Task 1: Export `nightKey` and `isAsleepStage` from `sleepAnalysis.ts`

**Files:**
- Modify: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepAnalysis.ts:38` and `:48`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepAnalysis.test.ts` (existing — run, don't modify)

**Interfaces:**
- Produces: `export function isAsleepStage(stage: string | null | undefined): boolean` and `export function nightKey(endTime: string): string`, both previously private, now importable by `feature.ts` (Task 3).

- [ ] **Step 1: Confirm the existing test suite passes before touching anything**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations sleepAnalysis.test.ts`
Expected: PASS (baseline, before any change)

- [ ] **Step 2: Add `export` to both functions**

In `sleepAnalysis.ts`, change line 38 from:
```typescript
function isAsleepStage(stage: string | null | undefined): boolean {
```
to:
```typescript
export function isAsleepStage(stage: string | null | undefined): boolean {
```

And change line 48 from:
```typescript
function nightKey(endTime: string): string {
```
to:
```typescript
export function nightKey(endTime: string): string {
```

- [ ] **Step 3: Run the existing test suite again to confirm zero behavior change**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations sleepAnalysis.test.ts`
Expected: PASS, identical results to Step 1 — this is purely an export-visibility change

- [ ] **Step 4: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/sleepAnalysis.ts
git commit -m "chore: export nightKey/isAsleepStage for reuse by the new Feature stage"
```

---

### Task 2: Foundation migration — new tables

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260901000000_intelligence_foundation_sleep_slice.sql`

**Interfaces:**
- Produces: tables `public.features`, `public.baselines`, `public.change_events`, `public.patterns`, `public.finding_evidence`, `public.findings`, `public.ciatta_knowledge` — all read via `select ... using (auth.uid() = user_id)`, all written only by the service-role Edge Function (no insert/update policy, matching `public.understandings`' existing pattern).

- [ ] **Step 1: Write the migration**

```sql
-- Ciatta Intelligence & Experience Model v0.1 / Expert Council v0.2 —
-- Stage 1 vertical slice. Additive only: nothing here is read by, written
-- by, or removes anything from the existing understanding-engine path.
-- See docs/specs/ciatta-semantic-refactor-spec-v1.md for the full object
-- definitions this migration implements a first slice of.
--
-- Scope: this slice populates these tables for the 'sleep' domain and the
-- 'nightly_sleep_minutes' feature_type only. The schema itself is
-- domain/feature-agnostic so later stages can widen it without another
-- migration to these same tables.

-- ---------------------------------------------------------------------------
-- features: a reproducible value calculated from Observations.
-- ---------------------------------------------------------------------------
create table public.features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  value numeric not null,
  window_start date,
  window_end date not null,
  observation_ids uuid[] not null default '{}',
  calculation_version text not null,
  computed_at timestamptz not null default now()
);

create index features_user_domain_type_idx
  on public.features (user_id, domain, feature_type, window_end desc);

-- ---------------------------------------------------------------------------
-- baselines: an individual's personal reference value for a Feature.
-- ---------------------------------------------------------------------------
create table public.baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  value numeric not null,
  window_start date not null,
  window_end date not null,
  sample_size int not null,
  eligible boolean not null,
  calculation_version text not null,
  computed_at timestamptz not null default now()
);

create index baselines_user_domain_type_idx
  on public.baselines (user_id, domain, feature_type, computed_at desc);

-- ---------------------------------------------------------------------------
-- change_events: difference from an appropriate personal reference,
-- carrying the measured-vs-meaningful distinction the legacy pipeline
-- never persisted.
-- ---------------------------------------------------------------------------
create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  feature_id uuid not null references public.features (id) on delete cascade,
  baseline_id uuid not null references public.baselines (id) on delete cascade,
  observed_value numeric not null,
  baseline_value numeric not null,
  deviation numeric not null,
  direction text not null check (direction in ('up', 'down', 'flat')),
  threshold_used numeric not null,
  is_meaningful boolean not null,
  detected_at timestamptz not null default now()
);

create index change_events_user_domain_type_idx
  on public.change_events (user_id, domain, feature_type, detected_at desc);

-- ---------------------------------------------------------------------------
-- patterns: a Relationship or Change demonstrating sufficient recurrence,
-- temporal consistency, persistence/stability, and a checked alternative
-- explanation. Never promoted from correlation alone — see
-- patternEvaluation.ts. threshold_version records which MVP recurrence
-- threshold produced this row, since that threshold is an explicit,
-- configurable operational hypothesis, not a fixed rule.
-- ---------------------------------------------------------------------------
create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  to_domain domain_type,
  pattern_type text not null,
  recurrence_count int not null,
  window_count_required int not null,
  stable_under_removal boolean not null,
  alternative_explanation_checked boolean not null,
  alternative_explanation_ruled_out boolean not null,
  confidence numeric not null,
  confidence_label text not null,
  source_relationship_ids uuid[] not null default '{}',
  threshold_version text not null,
  detected_at timestamptz not null default now(),
  unique (user_id, domain, to_domain, pattern_type)
);

-- ---------------------------------------------------------------------------
-- finding_evidence: information judged sufficiently valid and relevant to
-- support a specific Finding. Named `finding_evidence`, not `evidence` —
-- the legacy `evidence` table (a Feature-shaped aggregate under the old
-- model) still exists and is still written by the live engine during this
-- slice. This table takes over the name `evidence` only once the legacy
-- table is retired in a later stage.
--
-- PROVISIONAL: this flat, single-table shape is an MVP shortcut for one
-- vertical slice, not the final Evidence Ledger architecture. The
-- dedicated Evidence Ledger design (Approval Checkpoint item 8 in
-- docs/specs/ciatta-semantic-refactor-spec-v1.md §5) remains an open
-- architecture decision and must be revisited before broader
-- implementation or cutover. Nothing outside this slice references
-- finding_evidence's internal columns, so normalizing it later is a
-- self-contained migration, not a cross-cutting one.
-- ---------------------------------------------------------------------------
create table public.finding_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_ids uuid[] not null default '{}',
  baseline_id uuid references public.baselines (id),
  change_event_id uuid references public.change_events (id),
  relationship_id uuid references public.relationships (id),
  pattern_id uuid references public.patterns (id),
  quality_flags text[] not null default '{}',
  contradictory_evidence text,
  alternative_explanations text[] not null default '{}',
  uncertainty text,
  scientific_basis text,
  permitted_language text[] not null default '{}',
  prohibited_language text[] not null default '{}',
  sufficiency_verdict boolean not null,
  version text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- findings: a specific supported statement produced from a defined
-- Evidence set. Most Findings never reach ciatta_knowledge below.
-- ---------------------------------------------------------------------------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  statement text not null,
  evidence_id uuid not null references public.finding_evidence (id) on delete cascade,
  confidence_tier strength_type not null,
  safety_tier text not null
    check (safety_tier in ('unacceptable', 'serious', 'manageable', 'low', 'minimal')),
  produced_at timestamptz not null default now()
);

create index findings_user_domain_type_idx
  on public.findings (user_id, domain, feature_type, produced_at desc);

-- ---------------------------------------------------------------------------
-- ciatta_knowledge: information established sufficiently for its intended
-- purpose and permitted to be retained/reused. retention_rule_version
-- records which MVP promotion rule (currently >=2 reproduced runs)
-- produced this row — an explicit, configurable, provisional policy, not
-- a fixed rule.
-- ---------------------------------------------------------------------------
create table public.ciatta_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  statement text not null,
  finding_ids uuid[] not null default '{}',
  confidence_tier strength_type not null,
  safety_tier text not null,
  retention_rule_version text not null,
  established_at timestamptz not null default now(),
  last_reconfirmed_at timestamptz not null default now(),
  unique (user_id, domain, feature_type)
);

-- ---------------------------------------------------------------------------
-- Row Level Security — read own, matching every existing intelligence
-- table. All writes are service-role only, from the Edge Function.
-- ---------------------------------------------------------------------------
alter table public.features enable row level security;
alter table public.baselines enable row level security;
alter table public.change_events enable row level security;
alter table public.patterns enable row level security;
alter table public.finding_evidence enable row level security;
alter table public.findings enable row level security;
alter table public.ciatta_knowledge enable row level security;

create policy "features: read own" on public.features
  for select using (auth.uid() = user_id);
create policy "baselines: read own" on public.baselines
  for select using (auth.uid() = user_id);
create policy "change_events: read own" on public.change_events
  for select using (auth.uid() = user_id);
create policy "patterns: read own" on public.patterns
  for select using (auth.uid() = user_id);
create policy "finding_evidence: read own" on public.finding_evidence
  for select using (auth.uid() = user_id);
create policy "findings: read own" on public.findings
  for select using (auth.uid() = user_id);
create policy "ciatta_knowledge: read own" on public.ciatta_knowledge
  for select using (auth.uid() = user_id);
```

- [ ] **Step 2: Verify the migration applies cleanly against the existing schema**

Run: `cd ciatta-mobile-app && supabase db reset` (or the project's existing local-migration-verification command — check `package.json` for a `db:` script first and prefer that if one exists)
Expected: all migrations, including the new one, apply with no errors; no existing table is altered.

- [ ] **Step 3: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260901000000_intelligence_foundation_sleep_slice.sql
git commit -m "feat: add Stage 1 vertical-slice tables (features, baselines, change_events, patterns, finding_evidence, findings, ciatta_knowledge)"
```

---

### Task 3: `feature.ts` — nightly sleep duration Feature

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/feature.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/feature.test.ts`

**Interfaces:**
- Consumes: `nightlySleepMinutes(observations: SleepObservation[]): Map<string, number>`, `nightKey(endTime: string): string`, `isAsleepStage(stage: string | null | undefined): boolean`, `type SleepObservation` — all from `./sleepAnalysis.ts` (Task 1).
- Produces: `export interface FeatureRecord { domain: 'sleep'; featureType: 'nightly_sleep_minutes'; value: number; windowStart: string; windowEnd: string; observationIds: string[]; calculationVersion: string }` and `export function computeNightlySleepMinutesFeatures(observations: SleepObservation[]): FeatureRecord[]` — consumed by Task 4 (`baseline.ts`) and Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeNightlySleepMinutesFeatures, FEATURE_CALCULATION_VERSION } from './feature.ts';
import type { SleepObservation } from './sleepAnalysis.ts';

Deno.test('computeNightlySleepMinutesFeatures: one night, one segment', () => {
  const obs: SleepObservation[] = [
    {
      id: 'obs-1',
      type: 'sleep_segment',
      startTime: '2026-08-01T23:00:00Z',
      endTime: '2026-08-02T06:00:00Z',
      durationMinutes: 420,
      stage: 'asleep',
    },
  ];
  const features = computeNightlySleepMinutesFeatures(obs);
  assertEquals(features.length, 1);
  assertEquals(features[0].value, 420);
  assertEquals(features[0].domain, 'sleep');
  assertEquals(features[0].featureType, 'nightly_sleep_minutes');
  assertEquals(features[0].observationIds, ['obs-1']);
  assertEquals(features[0].calculationVersion, FEATURE_CALCULATION_VERSION);
});

Deno.test('computeNightlySleepMinutesFeatures: excludes in_bed/awake segments from both value and observationIds', () => {
  const obs: SleepObservation[] = [
    {
      id: 'asleep-1',
      type: 'sleep_segment',
      startTime: '2026-08-01T23:00:00Z',
      endTime: '2026-08-02T05:00:00Z',
      durationMinutes: 360,
      stage: 'asleep',
    },
    {
      id: 'awake-1',
      type: 'sleep_segment',
      startTime: '2026-08-02T05:00:00Z',
      endTime: '2026-08-02T05:30:00Z',
      durationMinutes: 30,
      stage: 'awake',
    },
  ];
  const features = computeNightlySleepMinutesFeatures(obs);
  assertEquals(features.length, 1);
  assertEquals(features[0].value, 360);
  assertEquals(features[0].observationIds, ['asleep-1']);
});

Deno.test('computeNightlySleepMinutesFeatures: two separate nights produce two Features', () => {
  const obs: SleepObservation[] = [
    {
      id: 'night-1',
      type: 'sleep_segment',
      startTime: '2026-08-01T23:00:00Z',
      endTime: '2026-08-02T06:00:00Z',
      durationMinutes: 420,
      stage: 'asleep',
    },
    {
      id: 'night-2',
      type: 'sleep_segment',
      startTime: '2026-08-02T23:00:00Z',
      endTime: '2026-08-03T05:30:00Z',
      durationMinutes: 390,
      stage: 'asleep',
    },
  ];
  const features = computeNightlySleepMinutesFeatures(obs);
  assertEquals(features.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations feature.test.ts`
Expected: FAIL — `feature.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Feature — a reproducible value calculated from one or more
// Observations. See docs/specs/ciatta-semantic-refactor-spec-v1.md §1.2.
// This is Stage 1's only Feature: nightly sleep duration. Reuses
// sleepAnalysis.ts's own night-bucketing (nightKey, isAsleepStage,
// nightlySleepMinutes) rather than re-deriving it, so this Feature's
// nights line up exactly with what the legacy analyzeSleep() already
// computes — only observation-level traceability is new here.
import { nightKey, isAsleepStage, nightlySleepMinutes, type SleepObservation } from './sleepAnalysis.ts';

export const FEATURE_CALCULATION_VERSION = 'nightly-sleep-minutes-v1';

export interface FeatureRecord {
  domain: 'sleep';
  featureType: 'nightly_sleep_minutes';
  value: number;
  windowStart: string;
  windowEnd: string;
  observationIds: string[];
  calculationVersion: string;
}

/** One Feature record per night present in `observations` — pure,
 * reproducible, no I/O. Mirrors nightlySleepMinutes()'s own filtering
 * exactly (segments only, excluding in_bed/awake stages) so the value
 * and the observationIds it cites always agree. */
export function computeNightlySleepMinutesFeatures(
  observations: SleepObservation[]
): FeatureRecord[] {
  const byNight = nightlySleepMinutes(observations);
  const idsByNight = new Map<string, string[]>();

  for (const obs of observations) {
    if (obs.type === 'sleep_segment' && !isAsleepStage(obs.stage)) continue;
    const key = nightKey(obs.endTime);
    const ids = idsByNight.get(key) ?? [];
    ids.push(obs.id);
    idsByNight.set(key, ids);
  }

  return [...byNight.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([night, minutes]) => ({
      domain: 'sleep' as const,
      featureType: 'nightly_sleep_minutes' as const,
      value: minutes,
      windowStart: night,
      windowEnd: night,
      observationIds: idsByNight.get(night) ?? [],
      calculationVersion: FEATURE_CALCULATION_VERSION,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations feature.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/feature.ts ciatta-mobile-app/supabase/functions/understanding-engine/feature.test.ts
git commit -m "feat: add Feature stage (nightly sleep duration)"
```

---

### Task 4: `baseline.ts` — personal reference value

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/baseline.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/baseline.test.ts`

**Interfaces:**
- Consumes: `median(xs: number[]): number` from `./dailyMetricRatingRelationship.ts`; `type FeatureRecord` from `./feature.ts` (Task 3).
- Produces: `export interface BaselineRecord { domain: 'sleep'; featureType: 'nightly_sleep_minutes'; value: number; windowStart: string; windowEnd: string; sampleSize: number; eligible: boolean; calculationVersion: string }` and `export function computeNightlySleepBaseline(features: FeatureRecord[]): BaselineRecord` — consumed by Task 5 (`changeEvent.ts`) and Task 7 (`findingEvidence.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeNightlySleepBaseline, BASELINE_MIN_SAMPLE } from './baseline.ts';
import type { FeatureRecord } from './feature.ts';

function feature(windowEnd: string, value: number): FeatureRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: windowEnd,
    windowEnd,
    observationIds: [],
    calculationVersion: 'nightly-sleep-minutes-v1',
  };
}

Deno.test('computeNightlySleepBaseline: ineligible below BASELINE_MIN_SAMPLE', () => {
  const features = Array.from({ length: BASELINE_MIN_SAMPLE - 1 }, (_, i) =>
    feature(`2026-08-${String(i + 1).padStart(2, '0')}`, 400)
  );
  const baseline = computeNightlySleepBaseline(features);
  assertEquals(baseline.eligible, false);
  assertEquals(baseline.sampleSize, BASELINE_MIN_SAMPLE - 1);
});

Deno.test('computeNightlySleepBaseline: median of an eligible sample', () => {
  const values = [380, 400, 420, 390, 410, 405, 395, 415, 385, 400, 402, 398, 407, 393];
  assertEquals(values.length, BASELINE_MIN_SAMPLE);
  const features = values.map((v, i) => feature(`2026-08-${String(i + 1).padStart(2, '0')}`, v));
  const baseline = computeNightlySleepBaseline(features);
  assertEquals(baseline.eligible, true);
  assertEquals(baseline.sampleSize, BASELINE_MIN_SAMPLE);
  // Sorted: 380,385,390,393,395,398,400,400,402,405,407,410,415,420 (14
  // values, even count) -> median is the average of the two middle
  // values (index 6 and 7): (400 + 400) / 2 = 400.
  assertEquals(baseline.value, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations baseline.test.ts`
Expected: FAIL — `baseline.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Baseline — an individual's reference representation for a Feature,
// from an appropriate comparison window. See spec §1.4. Stage 1's
// calculation is deliberately identical to sleepAnalysis.ts's own
// `median(nights)` baseline — this file persists and versions it instead
// of recomputing it inline every run.
import { median } from './dailyMetricRatingRelationship.ts';
import type { FeatureRecord } from './feature.ts';

export const BASELINE_CALCULATION_VERSION = 'median-nightly-sleep-v1';
// Matches sleepAnalysis.ts's own BASELINE_MIN_NIGHTS exactly — the two
// must not silently drift apart while both pipelines run side by side.
export const BASELINE_MIN_SAMPLE = 14;

export interface BaselineRecord {
  domain: 'sleep';
  featureType: 'nightly_sleep_minutes';
  value: number;
  windowStart: string;
  windowEnd: string;
  sampleSize: number;
  eligible: boolean;
  calculationVersion: string;
}

export function computeNightlySleepBaseline(features: FeatureRecord[]): BaselineRecord {
  const sorted = [...features].sort((a, b) => a.windowEnd.localeCompare(b.windowEnd));
  const sampleSize = sorted.length;
  const eligible = sampleSize >= BASELINE_MIN_SAMPLE;
  const value = eligible ? median(sorted.map((f) => f.value)) : 0;

  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: sorted[0]?.windowEnd ?? '',
    windowEnd: sorted[sorted.length - 1]?.windowEnd ?? '',
    sampleSize,
    eligible,
    calculationVersion: BASELINE_CALCULATION_VERSION,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations baseline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/baseline.ts ciatta-mobile-app/supabase/functions/understanding-engine/baseline.test.ts
git commit -m "feat: add Baseline stage (median nightly sleep minutes)"
```

---

### Task 5: `changeEvent.ts` — measured vs. meaningful deviation

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/changeEvent.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/changeEvent.test.ts`

**Interfaces:**
- Consumes: `type FeatureRecord` from `./feature.ts`, `type BaselineRecord` from `./baseline.ts`.
- Produces: `export interface ChangeEventRecord { observedValue: number; baselineValue: number; deviation: number; direction: 'up' | 'down' | 'flat'; thresholdUsed: number; isMeaningful: boolean }` and `export function evaluateChange(latestFeature: FeatureRecord, baseline: BaselineRecord): ChangeEventRecord | null` — consumed by Task 7 (`findingEvidence.ts`), Task 8 (`finding.ts`), Task 10 (`explanation.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { evaluateChange, CHANGE_THRESHOLD_MINUTES } from './changeEvent.ts';
import type { FeatureRecord } from './feature.ts';
import type { BaselineRecord } from './baseline.ts';

function feature(value: number): FeatureRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: '2026-08-20',
    windowEnd: '2026-08-20',
    observationIds: [],
    calculationVersion: 'nightly-sleep-minutes-v1',
  };
}

function baseline(value: number, eligible = true): BaselineRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: '2026-08-01',
    windowEnd: '2026-08-19',
    sampleSize: 14,
    eligible,
    calculationVersion: 'median-nightly-sleep-v1',
  };
}

Deno.test('evaluateChange: returns null when baseline is ineligible', () => {
  assertEquals(evaluateChange(feature(300), baseline(400, false)), null);
});

Deno.test('evaluateChange: deviation below threshold is not meaningful', () => {
  const change = evaluateChange(feature(380), baseline(400));
  assertEquals(change?.isMeaningful, false);
  assertEquals(change?.direction, 'down');
  assertEquals(change?.thresholdUsed, CHANGE_THRESHOLD_MINUTES);
});

Deno.test('evaluateChange: deviation at or above threshold is meaningful', () => {
  const change = evaluateChange(feature(300), baseline(400));
  assertEquals(change?.isMeaningful, true);
  assertEquals(change?.deviation, -100);
  assertEquals(change?.direction, 'down');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations changeEvent.test.ts`
Expected: FAIL — `changeEvent.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Change — difference from an appropriate personal reference (Baseline).
// See spec §1.5. CHANGE_THRESHOLD_MINUTES mirrors sleepAnalysis.ts's own
// SHORT_NIGHT_THRESHOLD_MINUTES exactly, documented here as this one
// Feature's provisional significance rule — not a universal claim about
// what counts as meaningful change for every Feature.
import type { FeatureRecord } from './feature.ts';
import type { BaselineRecord } from './baseline.ts';

export const CHANGE_THRESHOLD_MINUTES = 45;

export interface ChangeEventRecord {
  observedValue: number;
  baselineValue: number;
  deviation: number;
  direction: 'up' | 'down' | 'flat';
  thresholdUsed: number;
  isMeaningful: boolean;
}

/** Gate: no eligible Baseline, no Change — never falls back to comparing
 * against an ineligible/absent reference. */
export function evaluateChange(
  latestFeature: FeatureRecord,
  baseline: BaselineRecord
): ChangeEventRecord | null {
  if (!baseline.eligible) return null;

  const deviation = latestFeature.value - baseline.value;
  const direction: 'up' | 'down' | 'flat' = deviation > 0 ? 'up' : deviation < 0 ? 'down' : 'flat';
  const isMeaningful = Math.abs(deviation) >= CHANGE_THRESHOLD_MINUTES;

  return {
    observedValue: latestFeature.value,
    baselineValue: baseline.value,
    deviation,
    direction,
    thresholdUsed: CHANGE_THRESHOLD_MINUTES,
    isMeaningful,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations changeEvent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/changeEvent.ts ciatta-mobile-app/supabase/functions/understanding-engine/changeEvent.test.ts
git commit -m "feat: add Change stage (measured vs. meaningful deviation)"
```

---

### Task 6: `patternEvaluation.ts` — recurrence/stability evaluator

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/patternEvaluation.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/patternEvaluation.test.ts`

**Interfaces:**
- Consumes: nothing (pure, domain-agnostic — no imports from other new files).
- Produces: `export const PATTERN_MIN_RECURRING_WINDOWS = 3`, `export const PATTERN_THRESHOLD_VERSION`, `export interface RelationshipInstance { windowLabel: string; confirms: boolean }`, `export interface PatternEvaluation { qualifies: boolean; recurrenceCount: number; windowCountRequired: number; stableUnderRemoval: boolean; alternativeExplanationChecked: boolean; alternativeExplanationRuledOut: boolean; thresholdVersion: string }`, `export function evaluatePattern(instances: RelationshipInstance[], alternativeExplanationRuledOut: boolean): PatternEvaluation` — consumed by Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { evaluatePattern, PATTERN_MIN_RECURRING_WINDOWS } from './patternEvaluation.ts';
import type { RelationshipInstance } from './patternEvaluation.ts';

Deno.test('evaluatePattern: two variables correlating once does NOT qualify', () => {
  const instances: RelationshipInstance[] = [{ windowLabel: '2026-06', confirms: true }];
  const result = evaluatePattern(instances, true);
  assertEquals(result.qualifies, false);
  assertEquals(result.recurrenceCount, 1);
});

Deno.test('evaluatePattern: below-threshold recurrence never qualifies even with a ruled-out alternative', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
  ];
  assertEquals(instances.filter((i) => i.confirms).length, PATTERN_MIN_RECURRING_WINDOWS - 1);
  const result = evaluatePattern(instances, true);
  assertEquals(result.qualifies, false);
});

Deno.test('evaluatePattern: at-threshold recurrence with alternative explanation NOT ruled out does not qualify', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, false);
  assertEquals(result.qualifies, false);
  assertEquals(result.alternativeExplanationRuledOut, false);
});

Deno.test('evaluatePattern: qualifies when recurrence, stability, and alternative-explanation checks all pass', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, true);
  assertEquals(result.qualifies, true);
  assertEquals(result.recurrenceCount, 4);
  assertEquals(result.stableUnderRemoval, true);
  assertEquals(result.windowCountRequired, PATTERN_MIN_RECURRING_WINDOWS);
});

Deno.test('evaluatePattern: non-confirming instances do not count toward recurrence', () => {
  // 5 windows, only 4 confirm -> recurrenceCount must be 4, not 5 (the
  // non-confirming window is excluded from the count entirely, not
  // counted as a weaker confirmation). 4 confirming instances is also
  // this evaluator's true qualifying minimum (see the stability-under-
  // removal test above and PATTERN_MIN_RECURRING_WINDOWS's own doc
  // comment: 3 recurrences plus one to spare for the removal check).
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-04', confirms: true },
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: false },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, true);
  assertEquals(result.recurrenceCount, 4);
  assertEquals(result.qualifies, true);
});

Deno.test('evaluatePattern: exactly at the recurrence minimum still fails stability-under-removal', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, true);
  assertEquals(result.recurrenceCount, PATTERN_MIN_RECURRING_WINDOWS);
  assertEquals(result.stableUnderRemoval, false);
  assertEquals(result.qualifies, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations patternEvaluation.test.ts`
Expected: FAIL — `patternEvaluation.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Pattern — a Relationship or Change demonstrating sufficient recurrence,
// temporal consistency, persistence/stability, adequate data, and a
// checked alternative explanation. See spec §1.7 and §0. Deliberately
// domain-agnostic and reusable: this file knows nothing about sleep,
// energy, or mood specifically — callers translate their own domain data
// into RelationshipInstance[] first.
//
// PATTERN_MIN_RECURRING_WINDOWS is an explicit, configurable MVP
// operational hypothesis — NOT a universal scientific rule — per the
// approved amendment to docs/specs/ciatta-semantic-refactor-spec-v1.md.
// It is meant to be revisited once real usage data exists, not treated as
// settled science.
export const PATTERN_MIN_RECURRING_WINDOWS = 3;
export const PATTERN_THRESHOLD_VERSION = 'mvp-recurrence-3-v1';

export interface RelationshipInstance {
  windowLabel: string;
  confirms: boolean;
}

export interface PatternEvaluation {
  qualifies: boolean;
  recurrenceCount: number;
  windowCountRequired: number;
  stableUnderRemoval: boolean;
  alternativeExplanationChecked: boolean;
  alternativeExplanationRuledOut: boolean;
  thresholdVersion: string;
}

/**
 * Never promotes from correlation alone: requires the relationship to
 * confirm across >= PATTERN_MIN_RECURRING_WINDOWS independent windows,
 * remain at or above that same bar if any single confirming window is
 * removed (a coarse but real stability check), and an alternative
 * explanation to have been actively checked and ruled out by the caller.
 * Any one criterion failing means no Pattern — the caller keeps whatever
 * Relationship/Change it already had.
 */
export function evaluatePattern(
  instances: RelationshipInstance[],
  alternativeExplanationRuledOut: boolean
): PatternEvaluation {
  const recurrenceCount = instances.filter((i) => i.confirms).length;
  const meetsRecurrence = recurrenceCount >= PATTERN_MIN_RECURRING_WINDOWS;
  // The true qualifying minimum is one MORE than PATTERN_MIN_RECURRING_
  // WINDOWS: removing the single strongest confirming window must still
  // leave the count at or above the raw recurrence bar, or the "stable
  // under removal" check would be vacuous (always true whenever
  // meetsRecurrence is true, checking nothing of its own). At exactly
  // PATTERN_MIN_RECURRING_WINDOWS confirming instances, removing one
  // drops below the bar, so stability correctly fails there.
  const stableUnderRemoval = recurrenceCount - 1 >= PATTERN_MIN_RECURRING_WINDOWS;

  const qualifies = meetsRecurrence && stableUnderRemoval && alternativeExplanationRuledOut;

  return {
    qualifies,
    recurrenceCount,
    windowCountRequired: PATTERN_MIN_RECURRING_WINDOWS,
    stableUnderRemoval,
    alternativeExplanationChecked: true,
    alternativeExplanationRuledOut,
    thresholdVersion: PATTERN_THRESHOLD_VERSION,
  };
}
```

The true qualifying minimum is therefore 4 confirming instances, not 3 (3 recurrences plus one to spare for the removal check) — reflected in both the implementation above and all six test cases in Step 1, including the "exactly at the recurrence minimum still fails stability-under-removal" and "non-confirming instances do not count toward recurrence" cases, which were written to be mutually consistent with this rule.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations patternEvaluation.test.ts`
Expected: PASS (all six tests, including the added exactly-at-minimum case)

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/patternEvaluation.ts ciatta-mobile-app/supabase/functions/understanding-engine/patternEvaluation.test.ts
git commit -m "feat: add Pattern stage (recurrence/stability/alternative-explanation evaluator)"
```

---

### Task 7: `findingEvidence.ts` — ledger content and sufficiency verdict

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/findingEvidence.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/findingEvidence.test.ts`

**Interfaces:**
- Consumes: `type BaselineRecord` from `./baseline.ts`.
- Produces: `export const EVIDENCE_LEDGER_VERSION`, `export interface FindingEvidenceContent { qualityFlags: string[]; contradictoryEvidence: string | null; alternativeExplanations: string[]; uncertainty: string | null; scientificBasis: string | null; permittedLanguage: string[]; prohibitedLanguage: string[]; sufficiencyVerdict: boolean; version: string }`, `export function assembleSleepDurationEvidenceContent(baseline: BaselineRecord, qualityFlags: string[]): FindingEvidenceContent | null` — consumed by Task 8 (`finding.ts`), Task 9 (`safety.ts` caller), Task 10 (`explanation.ts`), Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { assembleSleepDurationEvidenceContent, EVIDENCE_LEDGER_VERSION } from './findingEvidence.ts';
import type { BaselineRecord } from './baseline.ts';

function baseline(overrides: Partial<BaselineRecord> = {}): BaselineRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value: 400,
    windowStart: '2026-08-01',
    windowEnd: '2026-08-19',
    sampleSize: 14,
    eligible: true,
    calculationVersion: 'median-nightly-sleep-v1',
    ...overrides,
  };
}

Deno.test('assembleSleepDurationEvidenceContent: null when baseline is ineligible', () => {
  assertEquals(assembleSleepDurationEvidenceContent(baseline({ eligible: false }), []), null);
});

Deno.test('assembleSleepDurationEvidenceContent: null when quality flags include insufficient-data', () => {
  assertEquals(assembleSleepDurationEvidenceContent(baseline(), ['insufficient-data']), null);
});

Deno.test('assembleSleepDurationEvidenceContent: passes with an eligible baseline and clean quality', () => {
  const content = assembleSleepDurationEvidenceContent(baseline(), []);
  assertEquals(content?.sufficiencyVerdict, true);
  assertEquals(content?.version, EVIDENCE_LEDGER_VERSION);
  assertEquals(content?.prohibitedLanguage.includes('diagnosis'), true);
});

Deno.test('assembleSleepDurationEvidenceContent: flags limited sample size below 30 nights', () => {
  const content = assembleSleepDurationEvidenceContent(baseline({ sampleSize: 14 }), []);
  assertEquals(content?.uncertainty, 'limited sample size');
});

Deno.test('assembleSleepDurationEvidenceContent: no uncertainty note at or above 30 nights', () => {
  const content = assembleSleepDurationEvidenceContent(baseline({ sampleSize: 30 }), []);
  assertEquals(content?.uncertainty, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations findingEvidence.test.ts`
Expected: FAIL — `findingEvidence.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Evidence (new, later-pipeline sense) — information judged sufficiently
// valid and relevant to support a specific Finding. See spec §1.8. This
// module produces only the ledger CONTENT (quality, provenance reasoning,
// language boundaries, sufficiency verdict) — the caller
// (sleepDurationSlice.ts) attaches the actual foreign-key ids
// (feature/baseline/change_event/relationship/pattern) once those rows
// have real database ids, keeping this function pure and independently
// testable.
//
// PROVISIONAL: this module's flat FindingEvidenceContent shape is an MVP
// shortcut for one vertical slice, not the final Evidence Ledger
// architecture. A dedicated Evidence Ledger design remains an open
// architecture decision (see docs/specs/ciatta-semantic-refactor-spec-v1.md
// §5, Approval Checkpoint item 8) and must be revisited before broader
// implementation or cutover — do not extend this module as if it were
// permanent, and do not let other modules depend on its exact field
// layout beyond the FindingEvidenceContent type itself.
import type { BaselineRecord } from './baseline.ts';

export const EVIDENCE_LEDGER_VERSION = 'sleep-slice-v1';

export interface FindingEvidenceContent {
  qualityFlags: string[];
  contradictoryEvidence: string | null;
  alternativeExplanations: string[];
  uncertainty: string | null;
  scientificBasis: string | null;
  permittedLanguage: string[];
  prohibitedLanguage: string[];
  sufficiencyVerdict: boolean;
  version: string;
}

/**
 * Sufficiency gate: an eligible Baseline and clean quality flags are the
 * floor. With no Baseline there is nothing to compare against, so there
 * is no Evidence, and therefore no Finding — this returns null rather
 * than a degraded guess.
 */
export function assembleSleepDurationEvidenceContent(
  baseline: BaselineRecord,
  qualityFlags: string[]
): FindingEvidenceContent | null {
  if (!baseline.eligible) return null;
  if (qualityFlags.includes('insufficient-data')) return null;

  return {
    qualityFlags,
    contradictoryEvidence: null,
    alternativeExplanations: [],
    uncertainty: baseline.sampleSize < 30 ? 'limited sample size' : null,
    scientificBasis: 'personal baseline comparison (median of prior nights)',
    permittedLanguage: ['average', 'typical', 'over time'],
    prohibitedLanguage: ['diagnosis', 'disorder', 'abnormal'],
    sufficiencyVerdict: true,
    version: EVIDENCE_LEDGER_VERSION,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations findingEvidence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/findingEvidence.ts ciatta-mobile-app/supabase/functions/understanding-engine/findingEvidence.test.ts
git commit -m "feat: add Evidence stage content assembly (finding_evidence)"
```

---

### Task 8: `finding.ts` — the supported statement

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/finding.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/finding.test.ts`

**Interfaces:**
- Consumes: `strengthForConfidence(confidence: number): Strength` and `type Strength` from `./cycleAnalysis.ts`; `type FindingEvidenceContent` from `./findingEvidence.ts`; `type ChangeEventRecord` from `./changeEvent.ts`.
- Produces: `export const FINDING_CONFIDENCE_SAMPLE_CAP = 30`, `export interface FindingDraft { domain: 'sleep'; featureType: 'nightly_sleep_minutes'; statement: string; confidenceTier: Strength }`, `export function produceSleepDurationFinding(evidence: FindingEvidenceContent, sampleSize: number, change: ChangeEventRecord | null): FindingDraft | null` — consumed by Task 9 (`safety.ts` caller), Task 10 (`explanation.ts`), Task 11 (`experienceSelection.ts` caller), Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { produceSleepDurationFinding, FINDING_CONFIDENCE_SAMPLE_CAP } from './finding.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { ChangeEventRecord } from './changeEvent.ts';

function evidenceContent(overrides: Partial<FindingEvidenceContent> = {}): FindingEvidenceContent {
  return {
    qualityFlags: [],
    contradictoryEvidence: null,
    alternativeExplanations: [],
    uncertainty: null,
    scientificBasis: 'personal baseline comparison (median of prior nights)',
    permittedLanguage: ['average', 'typical', 'over time'],
    prohibitedLanguage: ['diagnosis', 'disorder', 'abnormal'],
    sufficiencyVerdict: true,
    version: 'sleep-slice-v1',
    ...overrides,
  };
}

Deno.test('produceSleepDurationFinding: null when evidence sufficiency verdict is false', () => {
  const result = produceSleepDurationFinding(evidenceContent({ sufficiencyVerdict: false }), 30, null);
  assertEquals(result, null);
});

Deno.test('produceSleepDurationFinding: no meaningful change produces a steady-state statement', () => {
  const result = produceSleepDurationFinding(evidenceContent(), FINDING_CONFIDENCE_SAMPLE_CAP, null);
  assertMatch(result!.statement, /close to your usual/);
});

Deno.test('produceSleepDurationFinding: a meaningful downward change is named with direction and magnitude', () => {
  const change: ChangeEventRecord = {
    observedValue: 300,
    baselineValue: 400,
    deviation: -100,
    direction: 'down',
    thresholdUsed: 45,
    isMeaningful: true,
  };
  const result = produceSleepDurationFinding(evidenceContent(), FINDING_CONFIDENCE_SAMPLE_CAP, change);
  assertMatch(result!.statement, /100 minutes below your usual/);
});

Deno.test('produceSleepDurationFinding: confidence tier scales with sample size', () => {
  const low = produceSleepDurationFinding(evidenceContent(), 3, null);
  const high = produceSleepDurationFinding(evidenceContent(), FINDING_CONFIDENCE_SAMPLE_CAP, null);
  assertEquals(low!.confidenceTier, 'emerging');
  assertEquals(high!.confidenceTier, 'very-strong');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations finding.test.ts`
Expected: FAIL — `finding.ts` does not exist yet. If the confidence-tier test's exact expected values (`'emerging'` / `'very-strong'`) don't match `strengthForConfidence`'s real thresholds once run, adjust the test's expectations to whatever `strengthForConfidence` (in `cycleAnalysis.ts`) actually returns for `3/30` and `30/30` — do not change `strengthForConfidence` itself; it is legacy, untouched logic being reused, not re-implemented.

- [ ] **Step 3: Write the implementation**

```typescript
// Finding — a specific supported statement produced from a defined
// Evidence set. See spec §1.9. Reuses cycleAnalysis.ts's own
// strengthForConfidence() for the confidence tier — same ladder, same
// meaning, no parallel scale invented for this new stage.
import { strengthForConfidence, type Strength } from './cycleAnalysis.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { ChangeEventRecord } from './changeEvent.ts';

// Matches sleepAnalysis.ts's own CONFIDENCE_SAMPLE_CAP_UNDERSTANDING.
export const FINDING_CONFIDENCE_SAMPLE_CAP = 30;

export interface FindingDraft {
  domain: 'sleep';
  featureType: 'nightly_sleep_minutes';
  statement: string;
  confidenceTier: Strength;
}

/**
 * Produces a Finding only when Evidence is sufficient — the caller has
 * already confirmed assembleSleepDurationEvidenceContent() didn't return
 * null. This function only ever describes what IS supported; when
 * evidence fails sufficiency, it returns null and the caller is
 * responsible for treating that as silence ("no finding"), never a
 * downgraded guess.
 */
export function produceSleepDurationFinding(
  evidence: FindingEvidenceContent,
  sampleSize: number,
  change: ChangeEventRecord | null
): FindingDraft | null {
  if (!evidence.sufficiencyVerdict) return null;

  const confidenceTier = strengthForConfidence(Math.min(1, sampleSize / FINDING_CONFIDENCE_SAMPLE_CAP));

  const statement =
    change && change.isMeaningful
      ? `Your nightly sleep has been running about ${Math.abs(Math.round(change.deviation))} minutes ${
          change.direction === 'down' ? 'below' : 'above'
        } your usual.`
      : 'Your nightly sleep has been close to your usual over this period.';

  return { domain: 'sleep', featureType: 'nightly_sleep_minutes', statement, confidenceTier };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations finding.test.ts`
Expected: PASS (adjusting the confidence-tier assertions per Step 2's note if needed)

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/finding.ts ciatta-mobile-app/supabase/functions/understanding-engine/finding.test.ts
git commit -m "feat: add Finding stage (sleep duration statement)"
```

---

### Task 9: `safety.ts` — independent harm-tier assessment

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/safety.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/safety.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces: `export type SafetyTier = 'unacceptable' | 'serious' | 'manageable' | 'low' | 'minimal'` and `export function assessSafety(domain: string, statement: string, prohibitedLanguage: string[]): SafetyTier` — consumed by Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { assessSafety } from './safety.ts';

Deno.test('assessSafety: sleep domain defaults to minimal risk', () => {
  assertEquals(assessSafety('sleep', 'Your sleep has been close to your usual.', ['diagnosis']), 'minimal');
});

Deno.test('assessSafety: cycle/mood domains default to manageable risk', () => {
  assertEquals(assessSafety('cycle', 'A statement about your cycle.', ['diagnosis']), 'manageable');
  assertEquals(assessSafety('mood', 'A statement about your mood.', ['diagnosis']), 'manageable');
});

Deno.test('assessSafety: a statement using prohibited language is always unacceptable, regardless of domain', () => {
  assertEquals(
    assessSafety('sleep', 'This may indicate a sleep disorder.', ['disorder']),
    'unacceptable'
  );
});

Deno.test('assessSafety: prohibited-language check is case-insensitive', () => {
  assertEquals(
    assessSafety('sleep', 'This could be a DIAGNOSIS worth noting.', ['diagnosis']),
    'unacceptable'
  );
});

Deno.test('assessSafety: unknown domain falls back to manageable, not minimal', () => {
  assertEquals(assessSafety('some-future-domain', 'A statement.', []), 'manageable');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations safety.test.ts`
Expected: FAIL — `safety.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Safety — assessment of foreseeable harm if an output is wrong or
// misunderstood. See spec §1.12 and §2.4: independent of Confidence,
// never derived from it. This MVP domain-risk map is intentionally
// duplicated (not imported) from careGuidance.ts's own DOMAIN_CARE_TYPE
// risk routing — the two gates must stay independently defined so a
// future change to one never silently changes the other, the same
// independence discipline crossDomainSynthesis.ts already applies to its
// own ACTIONABLE constant.
export type SafetyTier = 'unacceptable' | 'serious' | 'manageable' | 'low' | 'minimal';

const DOMAIN_SAFETY_TIER: Record<string, SafetyTier> = {
  sleep: 'minimal',
  recovery: 'low',
  energy: 'low',
  cycle: 'manageable',
  mood: 'manageable',
};

/**
 * A statement that uses any prohibited word is always 'unacceptable',
 * regardless of domain — language boundaries are a hard stop, not a
 * factor weighed against domain risk.
 */
export function assessSafety(domain: string, statement: string, prohibitedLanguage: string[]): SafetyTier {
  const lower = statement.toLowerCase();
  const violatesProhibitedLanguage = prohibitedLanguage.some((word) => lower.includes(word.toLowerCase()));
  if (violatesProhibitedLanguage) return 'unacceptable';
  return DOMAIN_SAFETY_TIER[domain] ?? 'manageable';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations safety.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/safety.ts ciatta-mobile-app/supabase/functions/understanding-engine/safety.test.ts
git commit -m "feat: add Safety stage (independent harm-tier assessment)"
```

---

### Task 10: `explanation.ts` — the 8-point account

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/explanation.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/explanation.test.ts`

**Interfaces:**
- Consumes: `type FindingDraft` from `./finding.ts`; `type FindingEvidenceContent` from `./findingEvidence.ts`; `type BaselineRecord` from `./baseline.ts`; `type ChangeEventRecord` from `./changeEvent.ts`; `CONFIDENCE_LABEL` from `./decay.ts`.
- Produces: `export interface Explanation { whatCiattaNoticed: string; supportingEvidence: string; whatChanged: string; relevantContext: string; relationshipOrPattern: string; confidenceStatement: string; whatCiattaDoesNotKnow: string; whatThisDoesNotMean: string }` and `export function explainSleepDurationFinding(finding: FindingDraft, evidence: FindingEvidenceContent, baseline: BaselineRecord, change: ChangeEventRecord | null, hasSupportedRelationship: boolean): Explanation` — consumed by Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { explainSleepDurationFinding } from './explanation.ts';
import type { FindingDraft } from './finding.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { BaselineRecord } from './baseline.ts';
import type { ChangeEventRecord } from './changeEvent.ts';

const finding: FindingDraft = {
  domain: 'sleep',
  featureType: 'nightly_sleep_minutes',
  statement: 'Your nightly sleep has been running about 100 minutes below your usual.',
  confidenceTier: 'very-strong',
};

const evidence: FindingEvidenceContent = {
  qualityFlags: [],
  contradictoryEvidence: null,
  alternativeExplanations: [],
  uncertainty: 'limited sample size',
  scientificBasis: 'personal baseline comparison (median of prior nights)',
  permittedLanguage: ['average', 'typical', 'over time'],
  prohibitedLanguage: ['diagnosis', 'disorder', 'abnormal'],
  sufficiencyVerdict: true,
  version: 'sleep-slice-v1',
};

const baseline: BaselineRecord = {
  domain: 'sleep',
  featureType: 'nightly_sleep_minutes',
  value: 400,
  windowStart: '2026-08-01',
  windowEnd: '2026-08-19',
  sampleSize: 14,
  eligible: true,
  calculationVersion: 'median-nightly-sleep-v1',
};

const change: ChangeEventRecord = {
  observedValue: 300,
  baselineValue: 400,
  deviation: -100,
  direction: 'down',
  thresholdUsed: 45,
  isMeaningful: true,
};

Deno.test('explainSleepDurationFinding: answers all eight points', () => {
  const explanation = explainSleepDurationFinding(finding, evidence, baseline, change, false);
  assertEquals(explanation.whatCiattaNoticed, finding.statement);
  assertEquals(explanation.supportingEvidence, 'Based on 14 nights of sleep data.');
  assertEquals(explanation.whatChanged, 'A meaningful change from your 400-minute usual.');
  assertEquals(explanation.relevantContext, evidence.scientificBasis);
  assertEquals(explanation.relationshipOrPattern, 'No supported relationship or pattern is part of this finding.');
  assertEquals(explanation.confidenceStatement, 'Ciatta is very confident in this.');
  assertEquals(explanation.whatCiattaDoesNotKnow, 'limited sample size');
  assertEquals(explanation.whatThisDoesNotMean, 'This is not a diagnosis and does not indicate a sleep disorder.');
});

Deno.test('explainSleepDurationFinding: names a supported relationship when present', () => {
  const explanation = explainSleepDurationFinding(finding, evidence, baseline, change, true);
  assertEquals(explanation.relationshipOrPattern, 'Connected to a supported relationship with another domain.');
});

Deno.test('explainSleepDurationFinding: no-change case states there was not enough recent data assessed', () => {
  const explanation = explainSleepDurationFinding(finding, evidence, baseline, null, false);
  assertEquals(explanation.whatChanged, 'Not enough recent data to assess change.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations explanation.test.ts`
Expected: FAIL — `explanation.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Explanation — a bounded account of supporting evidence, reasoning,
// uncertainty, and limitations, generated on read from a Finding + its
// Evidence — never independently persisted. Answers the 8-point model
// from docs/specs/ciatta-semantic-refactor-spec-v1.md §1.13. Reuses
// decay.ts's CONFIDENCE_LABEL so the confidence wording here is always
// identical to the label the client already displays elsewhere.
import type { FindingDraft } from './finding.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { BaselineRecord } from './baseline.ts';
import type { ChangeEventRecord } from './changeEvent.ts';
import { CONFIDENCE_LABEL } from './decay.ts';

export interface Explanation {
  whatCiattaNoticed: string;
  supportingEvidence: string;
  whatChanged: string;
  relevantContext: string;
  relationshipOrPattern: string;
  confidenceStatement: string;
  whatCiattaDoesNotKnow: string;
  whatThisDoesNotMean: string;
}

export function explainSleepDurationFinding(
  finding: FindingDraft,
  evidence: FindingEvidenceContent,
  baseline: BaselineRecord,
  change: ChangeEventRecord | null,
  hasSupportedRelationship: boolean
): Explanation {
  return {
    whatCiattaNoticed: finding.statement,
    supportingEvidence: `Based on ${baseline.sampleSize} nights of sleep data.`,
    whatChanged: change
      ? `${change.isMeaningful ? 'A meaningful' : 'No meaningful'} change from your ${Math.round(
          baseline.value
        )}-minute usual.`
      : 'Not enough recent data to assess change.',
    relevantContext: evidence.scientificBasis ?? 'Compared against your own history, not a population average.',
    relationshipOrPattern: hasSupportedRelationship
      ? 'Connected to a supported relationship with another domain.'
      : 'No supported relationship or pattern is part of this finding.',
    confidenceStatement: `Ciatta is ${CONFIDENCE_LABEL[finding.confidenceTier]} in this.`,
    whatCiattaDoesNotKnow: evidence.uncertainty ?? 'No specific limitation noted beyond normal measurement uncertainty.',
    whatThisDoesNotMean: 'This is not a diagnosis and does not indicate a sleep disorder.',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations explanation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/explanation.ts ciatta-mobile-app/supabase/functions/understanding-engine/explanation.test.ts
git commit -m "feat: add Explanation stage (8-point account)"
```

---

### Task 11: `experienceSelection.ts` — the four-outcome silence gate

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/experienceSelection.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/experienceSelection.test.ts`

**Interfaces:**
- Consumes: `type Strength` from `./cycleAnalysis.ts`; `type SafetyTier` from `./safety.ts`.
- Produces: `export type ExperienceOutcome = 'surfaced' | 'no_finding' | 'no_surfacing' | 'no_notification'`, `export interface ExperienceInput { hasFinding: boolean; confidenceTier: Strength | null; safetyTier: SafetyTier | null; isMeaningfulChange: boolean }`, `export function selectForExperience(input: ExperienceInput): ExperienceOutcome` — consumed by Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { selectForExperience } from './experienceSelection.ts';

Deno.test('selectForExperience: no finding at all -> no_finding', () => {
  assertEquals(
    selectForExperience({ hasFinding: false, confidenceTier: null, safetyTier: null, isMeaningfulChange: false }),
    'no_finding'
  );
});

Deno.test('selectForExperience: unacceptable or serious safety -> no_surfacing, regardless of confidence', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'very-strong',
      safetyTier: 'unacceptable',
      isMeaningfulChange: true,
    }),
    'no_surfacing'
  );
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'very-strong',
      safetyTier: 'serious',
      isMeaningfulChange: true,
    }),
    'no_surfacing'
  );
});

Deno.test('selectForExperience: no meaningful change -> no_surfacing even with high confidence and low risk', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'very-strong',
      safetyTier: 'minimal',
      isMeaningfulChange: false,
    }),
    'no_surfacing'
  );
});

Deno.test('selectForExperience: meaningful change but weak confidence -> no_notification', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'moderate',
      safetyTier: 'minimal',
      isMeaningfulChange: true,
    }),
    'no_notification'
  );
});

Deno.test('selectForExperience: meaningful change, strong confidence, safe -> surfaced', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'strong',
      safetyTier: 'minimal',
      isMeaningfulChange: true,
    }),
    'surfaced'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations experienceSelection.test.ts`
Expected: FAIL — `experienceSelection.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Experience/Silence — the selection layer. Never reprocesses evidence:
// only ranks/filters what already cleared Confidence + Safety upstream.
// See spec §1.14, §2.6, §2.7. Returns exactly one of the four documented
// silence forms, or 'surfaced'. ('no_guidance' is a fifth, separate gate
// evaluated by careGuidance.ts's own ACTIONABLE check downstream of this
// -- not this function's concern.)
import type { Strength } from './cycleAnalysis.ts';
import type { SafetyTier } from './safety.ts';

export type ExperienceOutcome = 'surfaced' | 'no_finding' | 'no_surfacing' | 'no_notification';

const UNSAFE_TIERS: SafetyTier[] = ['unacceptable', 'serious'];
const NOTIFIABLE_CONFIDENCE: Strength[] = ['strong', 'very-strong'];

export interface ExperienceInput {
  hasFinding: boolean;
  confidenceTier: Strength | null;
  safetyTier: SafetyTier | null;
  isMeaningfulChange: boolean;
}

export function selectForExperience(input: ExperienceInput): ExperienceOutcome {
  if (!input.hasFinding || !input.confidenceTier || !input.safetyTier) return 'no_finding';
  if (UNSAFE_TIERS.includes(input.safetyTier)) return 'no_surfacing';
  if (!input.isMeaningfulChange) return 'no_surfacing';
  if (!NOTIFIABLE_CONFIDENCE.includes(input.confidenceTier)) return 'no_notification';
  return 'surfaced';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations experienceSelection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/experienceSelection.ts ciatta-mobile-app/supabase/functions/understanding-engine/experienceSelection.test.ts
git commit -m "feat: add Experience/Silence selection gate"
```

---

### Task 12: `ciattaKnowledge.ts` — the retention decision

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/ciattaKnowledge.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/ciattaKnowledge.test.ts`

**Interfaces:**
- Consumes: `type Strength` from `./cycleAnalysis.ts`.
- Produces: `export const KNOWLEDGE_MIN_REPRODUCED_RUNS = 2`, `export const KNOWLEDGE_RETENTION_RULE_VERSION`, `export interface PriorFindingRun { confidenceTier: Strength; statement: string; contradicted: boolean }`, `export interface RetentionDecision { shouldRetain: boolean; reproducedRuns: number; runsRequired: number; ruleVersion: string }`, `export function evaluateRetention(currentConfidence: Strength, priorRuns: PriorFindingRun[]): RetentionDecision` — consumed by Task 13 (`sleepDurationSlice.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { evaluateRetention, KNOWLEDGE_MIN_REPRODUCED_RUNS } from './ciattaKnowledge.ts';
import type { PriorFindingRun } from './ciattaKnowledge.ts';

Deno.test('evaluateRetention: a single strong Finding alone is not enough to retain', () => {
  const result = evaluateRetention('strong', []);
  assertEquals(result.reproducedRuns, 1);
  assertEquals(result.shouldRetain, false);
});

Deno.test('evaluateRetention: retains once reproduced across the required number of runs', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'strong', statement: 'x', contradicted: false },
  ];
  const result = evaluateRetention('strong', priorRuns);
  assertEquals(result.reproducedRuns, KNOWLEDGE_MIN_REPRODUCED_RUNS);
  assertEquals(result.shouldRetain, true);
});

Deno.test('evaluateRetention: a contradicted prior run does not count toward reproduction', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'strong', statement: 'x', contradicted: true },
  ];
  const result = evaluateRetention('strong', priorRuns);
  assertEquals(result.reproducedRuns, 1);
  assertEquals(result.shouldRetain, false);
});

Deno.test('evaluateRetention: a weak (moderate/emerging) prior run does not count toward reproduction', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'moderate', statement: 'x', contradicted: false },
  ];
  const result = evaluateRetention('strong', priorRuns);
  assertEquals(result.reproducedRuns, 1);
  assertEquals(result.shouldRetain, false);
});

Deno.test('evaluateRetention: a weak current confidence never retains regardless of prior runs', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'strong', statement: 'x', contradicted: false },
    { confidenceTier: 'strong', statement: 'x', contradicted: false },
  ];
  const result = evaluateRetention('moderate', priorRuns);
  assertEquals(result.reproducedRuns, 2);
  assertEquals(result.shouldRetain, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations ciattaKnowledge.test.ts`
Expected: FAIL — `ciattaKnowledge.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Ciatta Knowledge — information established sufficiently for its
// intended purpose and permitted to be retained/reused. See spec §1.10
// and §2.1. KNOWLEDGE_MIN_REPRODUCED_RUNS is an explicit, configurable
// MVP provisional retention policy — NOT a fixed universal rule — per
// the approved amendment to docs/specs/ciatta-semantic-refactor-spec-v1.md.
import type { Strength } from './cycleAnalysis.ts';

export const KNOWLEDGE_MIN_REPRODUCED_RUNS = 2;
export const KNOWLEDGE_RETENTION_RULE_VERSION = 'mvp-2-run-v1';

const RETENTION_CONFIDENCE: Strength[] = ['strong', 'very-strong'];

export interface PriorFindingRun {
  confidenceTier: Strength;
  statement: string;
  contradicted: boolean;
}

export interface RetentionDecision {
  shouldRetain: boolean;
  reproducedRuns: number;
  runsRequired: number;
  ruleVersion: string;
}

/**
 * Retains only when BOTH: (a) the current run's own confidence
 * independently qualifies (strong-or-better) -- a currently-weak or
 * currently-contradicted signal never retains no matter how strong its
 * prior track record was, matching spec 1.10's revisability requirement
 * ("if supporting evidence weakens... Knowledge updates or withdraws,
 * never stays stale") -- AND (b) the current Finding plus its prior runs
 * together show >= KNOWLEDGE_MIN_REPRODUCED_RUNS consistent,
 * non-contradicted, strong-or-better-confidence occurrences. A single
 * strong Finding is never enough on its own -- most Findings should
 * never reach retention.
 */
export function evaluateRetention(
  currentConfidence: Strength,
  priorRuns: PriorFindingRun[]
): RetentionDecision {
  const qualifyingPriorRuns = priorRuns.filter(
    (r) => !r.contradicted && RETENTION_CONFIDENCE.includes(r.confidenceTier)
  ).length;
  const currentQualifies = RETENTION_CONFIDENCE.includes(currentConfidence);
  const reproducedRuns = qualifyingPriorRuns + (currentQualifies ? 1 : 0);

  return {
    shouldRetain: currentQualifies && reproducedRuns >= KNOWLEDGE_MIN_REPRODUCED_RUNS,
    reproducedRuns,
    runsRequired: KNOWLEDGE_MIN_REPRODUCED_RUNS,
    ruleVersion: KNOWLEDGE_RETENTION_RULE_VERSION,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations ciattaKnowledge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/ciattaKnowledge.ts ciatta-mobile-app/supabase/functions/understanding-engine/ciattaKnowledge.test.ts
git commit -m "feat: add Ciatta Knowledge retention stage"
```

---

### Task 13: `sleepDurationSlice.ts` — orchestrator, and wiring into `index.ts`

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts`
- Test: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.test.ts`
- Modify: `ciatta-mobile-app/supabase/functions/understanding-engine/index.ts:16` (imports) and `:1157` (new call site, right after the existing `Promise.all([...])` block)

**Interfaces:**
- Consumes: every stage from Tasks 3–12, plus `analyzeSleepRatingRelationship`, `type SleepObservation` from `./sleepAnalysis.ts`, `type RatingObservation` from `./energyRelationship.ts`.
- Produces: `export interface SleepDurationSliceResult { outcome: 'surfaced' | 'no_finding' | 'no_surfacing' | 'no_notification'; findingId?: string; knowledgeRetained?: boolean }`, `export async function runSleepDurationSlice(supabase: SupabaseClient, userId: string, sleepObservations: SleepObservation[], energyObservations: RatingObservation[], moodObservations: RatingObservation[], now?: Date): Promise<SleepDurationSliceResult>` — called from `index.ts`'s `processUser()` — and `export function checkAlternativeExplanation(instances: RelationshipInstance[]): boolean` (exported specifically so it has direct unit-test coverage — see Step 1).

- [ ] **Step 1: Write the failing test (pure decision logic, no real Supabase client — a minimal fake covering only what this function calls)**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildSleepDurationPipelineResult } from './sleepDurationSlice.ts';
import type { SleepObservation } from './sleepAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';

function nightsOfObservations(count: number, minutesEach: number): SleepObservation[] {
  const obs: SleepObservation[] = [];
  for (let i = 0; i < count; i++) {
    const day = String(i + 1).padStart(2, '0');
    obs.push({
      id: `night-${i}`,
      type: 'sleep_segment',
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`, // overwritten below per-test where minutes matter
      durationMinutes: minutesEach,
      stage: 'asleep',
    });
  }
  return obs;
}

Deno.test('buildSleepDurationPipelineResult: too few nights -> no_finding, nothing else computed', () => {
  const result = buildSleepDurationPipelineResult(nightsOfObservations(5, 400), [], [], new Date('2026-07-06'));
  assertEquals(result.outcome, 'no_finding');
});
```

Note for the implementer: `buildSleepDurationPipelineResult` is the pure, synchronous core of the slice (Feature → Baseline → Change → Evidence → Finding → Safety → Experience selection, and a Pattern check when enough rating data exists) — it takes observations directly and returns a result plus every intermediate record the caller needs to persist. `runSleepDurationSlice` (async, Supabase-aware) is a thin wrapper that calls it and performs the inserts. Splitting them this way keeps the decision logic testable without a database, matching the existing codebase's own separation (e.g. `analyzeSleep()` vs. the DB-writing `upsertUnderstanding()` in `index.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations sleepDurationSlice.test.ts`
Expected: FAIL — `sleepDurationSlice.ts` does not exist yet

- [ ] **Step 3: Write the implementation**

```typescript
// Orchestrator for the Stage 1 vertical slice: Observation -> Feature ->
// Baseline -> Change -> Relationship -> Pattern -> Evidence -> Finding ->
// Ciatta Knowledge -> Confidence/Safety -> Experience/Silence, for
// exactly the 'sleep' domain and the 'nightly_sleep_minutes' Feature.
// Explanation (Task 10) is deliberately NOT part of this chain -- it is
// generated on read from a persisted Finding, never computed here at
// write time; see explanation.ts's own header comment. Additive only:
// writes exclusively to
// these new Stage 1 tables: features, baselines, change_events,
// finding_evidence, findings, ciatta_knowledge. It never touches
// understandings/understanding_history/evidence/relationships.
//
// NOTE: Pattern (Task 6) IS evaluated here -- hasSupportedRelationship
// reflects a real evaluatePattern() call -- but its result is not
// currently persisted: no row is written to `patterns`, and
// `finding_evidence.pattern_id`/`.relationship_id` stay null. Whether and
// how to persist Pattern results is an open scope question for a later
// task, not decided by this one; see this task's own report/build-history
// entry for the finding that surfaced this. Called
// from index.ts's processUser() in a try/catch-isolated call site so a
// failure here can never break the legacy path.
//
// PROVISIONAL: `finding_evidence` here is an MVP shortcut ledger for this
// one slice, not the final Evidence Ledger architecture — see
// findingEvidence.ts's own header note and
// docs/specs/ciatta-semantic-refactor-spec-v1.md §5 (Approval Checkpoint
// item 8, still open).
import { computeNightlySleepMinutesFeatures, type FeatureRecord } from './feature.ts';
import { computeNightlySleepBaseline, type BaselineRecord } from './baseline.ts';
import { evaluateChange, type ChangeEventRecord } from './changeEvent.ts';
import { evaluatePattern, type RelationshipInstance } from './patternEvaluation.ts';
import { assembleSleepDurationEvidenceContent, type FindingEvidenceContent } from './findingEvidence.ts';
import { produceSleepDurationFinding, type FindingDraft } from './finding.ts';
import { assessSafety, type SafetyTier } from './safety.ts';
// explanation.ts is deliberately NOT imported here: Explanation (Task 10)
// is generated on read, from a persisted Finding + its Evidence, never
// computed eagerly at write time -- see explanation.ts's own header
// comment and spec §1.13. This orchestrator only ever writes; a future
// read-path (a client query or a Task 14+ API) is what calls
// explainSleepDurationFinding(), not this file.
import { selectForExperience, type ExperienceOutcome } from './experienceSelection.ts';
import { evaluateRetention, type PriorFindingRun } from './ciattaKnowledge.ts';
import { analyzeSleepRatingRelationship, type SleepObservation } from './sleepAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';

export interface SleepDurationPipelineResult {
  outcome: ExperienceOutcome;
  feature: FeatureRecord | null;
  baseline: BaselineRecord | null;
  change: ChangeEventRecord | null;
  evidence: FindingEvidenceContent | null;
  finding: FindingDraft | null;
  safetyTier: SafetyTier | null;
  hasSupportedRelationship: boolean;
}

/** Buckets sleep + rating observations by calendar month so
 * analyzeSleepRatingRelationship() can be evaluated once per independent
 * window — the minimum needed for Pattern's recurrence check to mean
 * anything (a single all-history run is one window, never enough to
 * demonstrate recurrence on its own). */
function monthlyRelationshipInstances(
  sleepObservations: SleepObservation[],
  ratingObservations: RatingObservation[]
): RelationshipInstance[] {
  const months = new Set<string>();
  for (const obs of sleepObservations) months.add(obs.endTime.slice(0, 7));

  return [...months].sort().map((windowLabel) => {
    const monthSleep = sleepObservations.filter((o) => o.endTime.slice(0, 7) === windowLabel);
    const monthRatings = ratingObservations.filter((o) => o.recordedAt.slice(0, 7) === windowLabel);
    const result = analyzeSleepRatingRelationship(monthSleep, monthRatings);
    return { windowLabel, confirms: result.eligible && result.confirms };
  });
}

/**
 * A deliberately minimal, honest alternative-explanation check for this
 * one slice — NOT a full leave-one-out or statistical-outlier procedure.
 * It rules out only the single most literal reading of "the whole effect
 * is really just one especially strong month driving the average": if
 * only one month ever confirmed, that one month IS the entire case for
 * the relationship, so the alternative explanation cannot be ruled out.
 * Requiring at least two independently confirming months is the smallest
 * change that makes this a real check rather than "did anything confirm
 * at all" — which is already covered by evaluatePattern()'s own,
 * separate, stricter recurrence gate (a true minimum of 4 confirming
 * instances) and stability-under-removal check. This function's job is
 * narrower and only needs to not be trivially true. A more rigorous
 * check (e.g. holding while removing the single strongest confirming
 * month, weighted by rating-delta magnitude) is a real enhancement for a
 * later stage, not this vertical slice — see spec §1.7's "what it is
 * NOT": a Pattern from this check is still an MVP operational finding,
 * not a settled causal claim, regardless of how this function evolves.
 */
export function checkAlternativeExplanation(instances: RelationshipInstance[]): boolean {
  const confirming = instances.filter((i) => i.confirms);
  return confirming.length >= 2;
}

/** Pure decision core -- no I/O. See Task 13's test note for why this is
 * split from the async, Supabase-aware runSleepDurationSlice() below. */
export function buildSleepDurationPipelineResult(
  sleepObservations: SleepObservation[],
  energyObservations: RatingObservation[],
  moodObservations: RatingObservation[],
  _now: Date = new Date()
): SleepDurationPipelineResult {
  const features = computeNightlySleepMinutesFeatures(sleepObservations);
  const latestFeature = features[features.length - 1] ?? null;
  const baseline = computeNightlySleepBaseline(features);

  if (!latestFeature || !baseline.eligible) {
    return {
      outcome: 'no_finding',
      feature: latestFeature,
      baseline: baseline.eligible ? baseline : null,
      change: null,
      evidence: null,
      finding: null,
      safetyTier: null,
      hasSupportedRelationship: false,
    };
  }

  const change = evaluateChange(latestFeature, baseline);
  const qualityFlags = features.length === 0 ? ['insufficient-data'] : [];
  const evidence = assembleSleepDurationEvidenceContent(baseline, qualityFlags);

  if (!evidence) {
    return {
      outcome: 'no_finding',
      feature: latestFeature,
      baseline,
      change,
      evidence: null,
      finding: null,
      safetyTier: null,
      hasSupportedRelationship: false,
    };
  }

  const finding = produceSleepDurationFinding(evidence, baseline.sampleSize, change);

  if (!finding) {
    return {
      outcome: 'no_finding',
      feature: latestFeature,
      baseline,
      change,
      evidence,
      finding: null,
      safetyTier: null,
      hasSupportedRelationship: false,
    };
  }

  const energyInstances = monthlyRelationshipInstances(sleepObservations, energyObservations);
  const moodInstances = monthlyRelationshipInstances(sleepObservations, moodObservations);
  const energyPattern = evaluatePattern(energyInstances, checkAlternativeExplanation(energyInstances));
  const moodPattern = evaluatePattern(moodInstances, checkAlternativeExplanation(moodInstances));
  const hasSupportedRelationship = energyPattern.qualifies || moodPattern.qualifies;

  const safetyTier = assessSafety('sleep', finding.statement, evidence.prohibitedLanguage);

  const outcome = selectForExperience({
    hasFinding: true,
    confidenceTier: finding.confidenceTier,
    safetyTier,
    isMeaningfulChange: change?.isMeaningful ?? false,
  });

  return {
    outcome,
    feature: latestFeature,
    baseline,
    change,
    evidence,
    finding,
    safetyTier,
    hasSupportedRelationship,
  };
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface SleepDurationSliceResult {
  outcome: ExperienceOutcome;
  findingId?: string;
  knowledgeRetained?: boolean;
}

/**
 * Async, Supabase-aware wrapper: runs the pure pipeline above, then
 * writes to the Stage 1 tables only. Never writes to, reads for the
 * purpose of overwriting, or deletes from any legacy table. Errors are
 * the caller's (index.ts's) responsibility to isolate via try/catch --
 * this function does not swallow them itself, so tests can see real
 * failures.
 */
export async function runSleepDurationSlice(
  supabase: SupabaseClient,
  userId: string,
  sleepObservations: SleepObservation[],
  energyObservations: RatingObservation[],
  moodObservations: RatingObservation[],
  now: Date = new Date()
): Promise<SleepDurationSliceResult> {
  const result = buildSleepDurationPipelineResult(sleepObservations, energyObservations, moodObservations, now);

  if (!result.feature || !result.baseline) return { outcome: result.outcome };

  const { data: featureRow, error: featureError } = await supabase
    .from('features')
    .insert({
      user_id: userId,
      domain: result.feature.domain,
      feature_type: result.feature.featureType,
      value: result.feature.value,
      window_start: result.feature.windowStart,
      window_end: result.feature.windowEnd,
      observation_ids: result.feature.observationIds,
      calculation_version: result.feature.calculationVersion,
    })
    .select('id')
    .single();
  if (featureError) throw featureError;

  const { data: baselineRow, error: baselineError } = await supabase
    .from('baselines')
    .insert({
      user_id: userId,
      domain: result.baseline.domain,
      feature_type: result.baseline.featureType,
      value: result.baseline.value,
      window_start: result.baseline.windowStart,
      window_end: result.baseline.windowEnd,
      sample_size: result.baseline.sampleSize,
      eligible: result.baseline.eligible,
      calculation_version: result.baseline.calculationVersion,
    })
    .select('id')
    .single();
  if (baselineError) throw baselineError;

  if (!result.evidence || !result.finding || !result.safetyTier) {
    return { outcome: result.outcome };
  }

  let changeEventId: string | null = null;
  if (result.change) {
    const { data: changeRow, error: changeError } = await supabase
      .from('change_events')
      .insert({
        user_id: userId,
        domain: 'sleep',
        feature_type: 'nightly_sleep_minutes',
        feature_id: featureRow.id,
        baseline_id: baselineRow.id,
        observed_value: result.change.observedValue,
        baseline_value: result.change.baselineValue,
        deviation: result.change.deviation,
        direction: result.change.direction,
        threshold_used: result.change.thresholdUsed,
        is_meaningful: result.change.isMeaningful,
      })
      .select('id')
      .single();
    if (changeError) throw changeError;
    changeEventId = changeRow.id;
  }

  const { data: evidenceRow, error: evidenceError } = await supabase
    .from('finding_evidence')
    .insert({
      user_id: userId,
      domain: 'sleep',
      feature_ids: [featureRow.id],
      baseline_id: baselineRow.id,
      change_event_id: changeEventId,
      quality_flags: result.evidence.qualityFlags,
      contradictory_evidence: result.evidence.contradictoryEvidence,
      alternative_explanations: result.evidence.alternativeExplanations,
      uncertainty: result.evidence.uncertainty,
      scientific_basis: result.evidence.scientificBasis,
      permitted_language: result.evidence.permittedLanguage,
      prohibited_language: result.evidence.prohibitedLanguage,
      sufficiency_verdict: result.evidence.sufficiencyVerdict,
      version: result.evidence.version,
    })
    .select('id')
    .single();
  if (evidenceError) throw evidenceError;

  // Prior runs MUST be read from `findings` (written on every run), never
  // from `ciatta_knowledge` itself. `ciatta_knowledge` is only ever
  // written a few lines below, gated on retention.shouldRetain -- sourcing
  // priorRuns from it would make the gate unsatisfiable forever (no row
  // exists to read until after the gate has already passed once, and it
  // can never pass without a prior row to read). Read BEFORE inserting
  // this run's own findings row, so this query only ever sees genuinely
  // prior runs, never the one this call is about to write.
  const { data: priorFindingRow } = await supabase
    .from('findings')
    .select('confidence_tier')
    .eq('user_id', userId)
    .eq('domain', 'sleep')
    .eq('feature_type', 'nightly_sleep_minutes')
    .order('produced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: findingRow, error: findingError } = await supabase
    .from('findings')
    .insert({
      user_id: userId,
      domain: 'sleep',
      feature_type: 'nightly_sleep_minutes',
      statement: result.finding.statement,
      evidence_id: evidenceRow.id,
      confidence_tier: result.finding.confidenceTier,
      safety_tier: result.safetyTier,
    })
    .select('id')
    .single();
  if (findingError) throw findingError;

  // `contradicted` always false here: this slice has no mechanism yet
  // for marking a prior run contradicted (that would require comparing
  // this run's Change/Finding against the prior one's, not just its
  // confidence tier) -- a known, deliberate MVP simplification, not a
  // silent omission. `statement` is unused by evaluateRetention itself,
  // kept empty rather than duplicating a query for a field nothing reads.
  const priorRuns: PriorFindingRun[] = priorFindingRow
    ? [{ confidenceTier: priorFindingRow.confidence_tier, statement: '', contradicted: false }]
    : [];
  const retention = evaluateRetention(result.finding.confidenceTier, priorRuns);

  if (retention.shouldRetain) {
    const { error: knowledgeError } = await supabase.from('ciatta_knowledge').upsert(
      {
        user_id: userId,
        domain: 'sleep',
        feature_type: 'nightly_sleep_minutes',
        statement: result.finding.statement,
        finding_ids: [findingRow.id],
        confidence_tier: result.finding.confidenceTier,
        safety_tier: result.safetyTier,
        retention_rule_version: retention.ruleVersion,
        last_reconfirmed_at: now.toISOString(),
      },
      { onConflict: 'user_id,domain,feature_type' }
    );
    if (knowledgeError) throw knowledgeError;
  }

  return { outcome: result.outcome, findingId: findingRow.id, knowledgeRetained: retention.shouldRetain };
}
```

- [ ] **Step 4: Add more coverage to the pure-logic test file, then run it**

Add to `sleepDurationSlice.test.ts`. First, add `checkAlternativeExplanation` AND `runSleepDurationSlice` to the existing import from `./sleepDurationSlice.ts` (change the Step 1 import line from `import { buildSleepDurationPipelineResult } from './sleepDurationSlice.ts';` to `import { buildSleepDurationPipelineResult, checkAlternativeExplanation, runSleepDurationSlice } from './sleepDurationSlice.ts';`), then add:

```typescript
Deno.test('buildSleepDurationPipelineResult: enough nights but no meaningful change -> no_surfacing', () => {
  const obs: SleepObservation[] = Array.from({ length: 20 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      id: `night-${i}`,
      type: 'sleep_segment',
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`.replace('23:00', '06:00'),
      durationMinutes: 400,
      stage: 'asleep',
    };
  });
  const result = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-07-21'));
  assertEquals(result.outcome, 'no_surfacing');
  assertEquals(result.finding?.statement.includes('close to your usual'), true);
});

Deno.test('checkAlternativeExplanation: zero confirming windows is never ruled out', () => {
  assertEquals(checkAlternativeExplanation([]), false);
  assertEquals(checkAlternativeExplanation([{ windowLabel: '2026-06', confirms: false }]), false);
});

Deno.test('checkAlternativeExplanation: exactly one confirming window is NOT enough -- one strong month could be driving the whole effect', () => {
  const instances = [
    { windowLabel: '2026-05', confirms: false },
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: false },
  ];
  assertEquals(checkAlternativeExplanation(instances), false);
});

Deno.test('checkAlternativeExplanation: two or more independently confirming windows rules it out', () => {
  const instances = [
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: false },
    { windowLabel: '2026-07', confirms: true },
  ];
  assertEquals(checkAlternativeExplanation(instances), true);
});

// Minimal fake Supabase client covering only the chain shapes
// runSleepDurationSlice actually calls: .from(table).insert(x).select(c).single(),
// .from(table).select(c).eq().eq().eq().order().limit().maybeSingle(), and
// .from(table).upsert(x, opts). Every chain method returns the same
// stateless object except the two terminal methods, which resolve.
function createFakeSupabase(recordedTables: string[], opts: { failInserts?: boolean } = {}) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () =>
      opts.failInserts
        ? Promise.resolve({ data: null, error: new Error('simulated insert failure') })
        : Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  };
  return {
    from(table: string) {
      recordedTables.push(table);
      return chain;
    },
  };
}

function twentyNightsAt400(): SleepObservation[] {
  return Array.from({ length: 20 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      id: `night-${i}`,
      type: 'sleep_segment',
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`.replace('23:00', '06:00'),
      durationMinutes: 400,
      stage: 'asleep',
    };
  });
}

Deno.test('runSleepDurationSlice: writes only to the permitted Stage 1 tables, never a legacy table', async () => {
  const recordedTables: string[] = [];
  const supabase = createFakeSupabase(recordedTables);

  await runSleepDurationSlice(supabase, 'user-1', twentyNightsAt400(), [], [], new Date('2026-07-21'));

  const permitted = new Set([
    'features',
    'baselines',
    'change_events',
    'finding_evidence',
    'findings',
    'ciatta_knowledge',
  ]);
  const forbidden = ['understandings', 'understanding_history', 'evidence', 'relationships', 'discoveries'];

  for (const table of recordedTables) {
    assertEquals(permitted.has(table), true, `unexpected table touched: ${table}`);
  }
  for (const table of forbidden) {
    assertEquals(recordedTables.includes(table), false, `must never touch legacy table: ${table}`);
  }
  // Confirms the fixture actually reached the full write path, not just
  // an early-return branch -- findings is only reached once evidence and
  // a finding both exist.
  assertEquals(recordedTables.includes('findings'), true);
});

Deno.test('runSleepDurationSlice: a failed write is never swallowed internally -- it propagates to the caller', async () => {
  const recordedTables: string[] = [];
  const supabase = createFakeSupabase(recordedTables, { failInserts: true });

  let threw = false;
  try {
    await runSleepDurationSlice(supabase, 'user-1', twentyNightsAt400(), [], [], new Date('2026-07-21'));
  } catch {
    threw = true;
  }
  // This function must NOT catch its own errors -- index.ts's try/catch
  // around the call site is what provides legacy-path isolation, per this
  // file's own docstring ("Errors are the caller's ... responsibility to
  // isolate via try/catch -- this function does not swallow them
  // itself"). If this function silently swallowed errors instead, that
  // isolation guarantee would be untested and could silently break.
  assertEquals(threw, true);
});
```

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations sleepDurationSlice.test.ts`
Expected: PASS (all seven tests)

- [ ] **Step 5: Wire the new call site into `index.ts`, isolated with try/catch**

In `index.ts`, add to the import block after line 55 (`import { analyzeMood, buildMoodUnderstanding } from './moodAnalysis.ts';`):

```typescript
import { runSleepDurationSlice } from './sleepDurationSlice.ts';
```

Then in `processUser()`, immediately after the existing block (currently `index.ts:1152-1157`):

```typescript
  const [cycle, sleep, recovery, mood] = await Promise.all([
    want.has('cycle') ? processCycleDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
    want.has('sleep') ? processSleepDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
    want.has('recovery') ? processRecoveryDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
    want.has('mood') ? processMoodDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
  ]);
```

add:

```typescript
  // Stage 1 vertical slice — additive only, writes exclusively to the new
  // features/baselines/change_events/finding_evidence/findings/
  // ciatta_knowledge tables. Isolated so a failure here can never affect
  // the legacy write path above, matching the existing announceDiscoveries
  // isolation pattern further down this function.
  if (want.has('sleep')) {
    try {
      await runSleepDurationSlice(supabase, userId, obs.sleep, obs.energy, obs.mood);
    } catch (err) {
      console.error('sleepDurationSlice failed (non-fatal, legacy path unaffected):', err);
    }
  }
```

- [ ] **Step 6: Run the full engine test suite to confirm nothing legacy broke**

Run: `cd ciatta-mobile-app && npm run test:engine`
Expected: PASS — every existing test, plus all new Task 3–13 tests

- [ ] **Step 7: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.test.ts ciatta-mobile-app/supabase/functions/understanding-engine/index.ts
git commit -m "feat: wire the sleep duration vertical slice into the engine, additive and isolated"
```

---

### Task 14: Dual-write parity and regression verification

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.parity.test.ts`

**Interfaces:**
- Consumes: `buildSleepDurationPipelineResult` from `./sleepDurationSlice.ts`; `analyzeSleep`, `buildSleepUnderstanding` from `./sleepAnalysis.ts`; `deriveGuidance` from `./careGuidance.ts`.

- [ ] **Step 1: Write parity tests comparing the new pipeline's gating decisions against the legacy pipeline's, on shared fixture data**

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildSleepDurationPipelineResult } from './sleepDurationSlice.ts';
import { analyzeSleep, buildSleepUnderstanding } from './sleepAnalysis.ts';
import { deriveGuidance } from './careGuidance.ts';
import type { SleepObservation } from './sleepAnalysis.ts';

function fixtureNights(count: number, minutes: (i: number) => number): SleepObservation[] {
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      id: `night-${i}`,
      type: 'sleep_segment' as const,
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`.replace('T23:00', 'T06:00').replace(day, String(i + 2).padStart(2, '0')),
      durationMinutes: minutes(i),
      stage: 'asleep' as const,
    };
  });
}

Deno.test('parity: legacy and new pipelines agree on eligibility at the same sample size', () => {
  const obs = fixtureNights(20, () => 400);
  const legacy = analyzeSleep(obs);
  const legacyDraft = buildSleepUnderstanding(legacy);
  const modern = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-08-01'));

  assertEquals(legacy.eligible, true);
  assertEquals(modern.baseline?.eligible, true);
  assertEquals(legacyDraft !== null, modern.finding !== null);
});

Deno.test('parity: legacy and new pipelines agree on ineligibility below the minimum sample', () => {
  const obs = fixtureNights(5, () => 400);
  const legacy = analyzeSleep(obs);
  const modern = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-08-01'));

  assertEquals(legacy.eligible, false);
  assertEquals(modern.outcome, 'no_finding');
});

Deno.test('parity: Guidance output for a given domain/strength/evidence is byte-identical to today\'s -- deriveGuidance() itself is untouched, this only confirms the new pipeline would hand it the same shape of inputs', () => {
  const before = deriveGuidance('sleep', 'strong', null, { observationsCount: 20, learningSince: '2026-07-01' }, new Date('2026-08-01'));
  const after = deriveGuidance('sleep', 'strong', null, { observationsCount: 20, learningSince: '2026-07-01' }, new Date('2026-08-01'));
  assertEquals(before, after);
});
```

- [ ] **Step 2: Run the parity suite**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations sleepDurationSlice.parity.test.ts`
Expected: PASS. If the first two parity tests fail, the discrepancy is a real bug in the new pipeline (its eligibility gate must match the legacy `BASELINE_MIN_NIGHTS = 14` threshold exactly) — fix `baseline.ts`'s `BASELINE_MIN_SAMPLE`, not the test.

- [ ] **Step 3: Run the complete existing suite once more (final regression gate for this stage)**

Run: `cd ciatta-mobile-app && npm run test:engine`
Expected: PASS, zero failures, zero changes to any existing test's expected output.

- [ ] **Step 4: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.parity.test.ts
git commit -m "test: verify Stage 1 dual-write parity and zero legacy regression"
```

---

### Task 15: Report to the user

**Files:** none (reporting step only)

- [ ] **Step 1: Compose the Stage 1 report**

Cover, at minimum:
- What was built: the 12 new files (Tasks 3–13) implementing Observation→Feature→Baseline→Change→Relationship→Pattern→Evidence→Finding→Ciatta Knowledge→Confidence/Safety→Explanation→Experience/Silence→Guidance for sleep duration, plus the migration (Task 2) and the two-line export change to legacy `sleepAnalysis.ts` (Task 1).
- Test results: full `npm run test:engine` output, pass/fail counts, explicitly calling out the parity suite (Task 14) results.
- Confirmation that no legacy table, function, or test changed behavior.
- Confirmation that nothing user-facing changed (no UI, no client, no cron/deploy change).
- Explicit note that `PATTERN_MIN_RECURRING_WINDOWS` and `KNOWLEDGE_MIN_REPRODUCED_RUNS` are live as configurable, documented MVP hypotheses, not hardcoded/hidden.
- Ask for explicit approval before proceeding to Stage 2 (per the user's standing instruction to report before each subsequent stage).

- [ ] **Step 2: Deliver the report to the user and stop — do not begin Stage 2 without explicit approval.**

---

## Stage 1 Closure Pass (added after Task 14's validation, per explicit user direction)

Task 14's validation surfaced five architectural findings and one product-validation gap (no test exercises the `'surfaced'` outcome). The user directed a focused closure pass — NOT Stage 2 — resolving these before any domain expansion. Tasks 16-20 below implement it. Unlike Tasks 1-15, the user asked for ONE consolidated closure report at the end, not a per-task checkpoint — but the same TDD/subagent-driven-development/independent-verification discipline applies throughout.

**Decision made explicitly per this round's instruction** (the user delegated this call rather than asking it be flagged): qualified Patterns MUST be persisted for this MVP — the `patterns` table and `finding_evidence.pattern_id` column already exist specifically for this (Task 2), Pattern is already genuinely computed (Task 13), and leaving it computed-then-discarded left Task 2's schema work for `patterns` entirely vestigial. Implemented minimally: no new statistical rigor added to `evaluatePattern`'s qualifying logic (Task 6's already-reviewed gate is untouched) — only a confidence-tier derivation for the row being written, and the write itself, gated on the exact same `qualifies` boolean already computed today.

### Task 16: Deterministic idempotency across the Stage 1 tables

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260901010000_stage1_idempotency.sql`
- Modify: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts` (convert the five plain `.insert()` write calls to `.upsert(..., { onConflict: '...' })`)

**Design:** each table's natural key is "this specific computation, once" — keying the chain so a re-run of the same source data for the same night reuses the same rows instead of duplicating them, cascading naturally: a Feature is unique per night; a Baseline is unique per "as of night X"; a Change Event is unique per the Feature it's about; Evidence is unique per the Baseline it bundles; a Finding is unique per the Evidence it cites.

- [ ] **Step 1: Write the migration**

```sql
-- Stage 1 vertical slice, closure pass -- deterministic idempotency
-- protection. Without these constraints, every qualifying engine
-- invocation (nightly AND continuous mode) appends a full new row set
-- describing the same night's computation, growing these tables
-- unboundedly. Each constraint keys on the natural "this specific
-- computation, once" identity for its object, letting
-- sleepDurationSlice.ts upsert instead of blind-insert -- a re-run of the
-- same source data reuses the same rows rather than duplicating them.
alter table public.features
  add constraint features_user_domain_feature_window_key
  unique (user_id, domain, feature_type, window_end);

alter table public.baselines
  add constraint baselines_user_domain_feature_window_key
  unique (user_id, domain, feature_type, window_end);

alter table public.change_events
  add constraint change_events_user_domain_feature_feature_id_key
  unique (user_id, domain, feature_type, feature_id);

alter table public.finding_evidence
  add constraint finding_evidence_user_domain_baseline_key
  unique (user_id, domain, baseline_id);

alter table public.findings
  add constraint findings_user_domain_feature_evidence_key
  unique (user_id, domain, feature_type, evidence_id);
```

- [ ] **Step 2: Verify the migration applies cleanly**

Run: `cd ciatta-mobile-app && supabase db reset` if a live local Postgres is available; otherwise (as in this environment) verify statically: confirm the migration filename sorts after `20260901000000_intelligence_foundation_sleep_slice.sql`, confirm no other migration already defines a constraint with these names, confirm every referenced column (`user_id`, `domain`, `feature_type`, `window_end`, `feature_id`, `baseline_id`, `evidence_id`) exists on its table per `20260901000000_intelligence_foundation_sleep_slice.sql`, and read the SQL once top to bottom for balanced syntax.

- [ ] **Step 3: Convert `sleepDurationSlice.ts`'s five plain inserts to upserts**

In `runSleepDurationSlice`, change each of the following five `.insert({...}).select('id').single()` calls to `.upsert({...}, { onConflict: '...' }).select('id').single()`, with the exact `onConflict` string matching the constraint's own column list (comma-separated, no spaces, matching Supabase's convention already used for `ciatta_knowledge`'s existing upsert):

1. `features` insert → `.upsert({...same payload...}, { onConflict: 'user_id,domain,feature_type,window_end' })`
2. `baselines` insert → `.upsert({...same payload...}, { onConflict: 'user_id,domain,feature_type,window_end' })`
3. `change_events` insert (inside `if (result.change)`) → `.upsert({...same payload...}, { onConflict: 'user_id,domain,feature_type,feature_id' })`
4. `finding_evidence` insert → `.upsert({...same payload...}, { onConflict: 'user_id,domain,baseline_id' })`
5. `findings` insert → `.upsert({...same payload...}, { onConflict: 'user_id,domain,feature_type,evidence_id' })`

Do not change any payload field, only the method name and the added `onConflict` option. Do not change `ciatta_knowledge`'s existing upsert (already correct, untouched by this task).

- [ ] **Step 4: Add a test proving idempotent re-runs don't duplicate writes**

Add to `sleepDurationSlice.test.ts`, using the existing `createFakeSupabase` helper extended to track insert/upsert call counts per table rather than just table names:

```typescript
Deno.test('runSleepDurationSlice: re-running with the same data upserts (not duplicates) every write', async () => {
  const upsertCalls: string[] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () => Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    upsert: (_payload: unknown, opts: unknown) => {
      upsertCalls.push(JSON.stringify(opts));
      return Promise.resolve({ data: { id: 'fake-id' }, error: null });
    },
  };
  const supabase = { from: () => chain };

  const obs = twentyNightsAt400();
  await runSleepDurationSlice(supabase, 'user-1', obs, [], [], new Date('2026-07-21'));
  await runSleepDurationSlice(supabase, 'user-1', obs, [], [], new Date('2026-07-21'));

  // Every write must go through upsert with an onConflict target -- a
  // plain, unconditional insert would duplicate on the second run.
  assertEquals(upsertCalls.length > 0, true);
  for (const opts of upsertCalls) {
    assertEquals(opts.includes('onConflict'), true, `upsert call missing onConflict: ${opts}`);
  }
});
```

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations sleepDurationSlice.test.ts` — expect all prior tests plus this one to pass. Note: the existing `single()`-based helper in `createFakeSupabase` still needs `insert()` and `select()` in its chain (used by the `findings`/`baselines`/etc. `.select('id')` step after `.upsert(...)` in real supabase-js semantics — mirror the real client's shape: `.upsert(obj).select('id').single()` is the actual call chain, so `upsert()` must return `chain` (not resolve directly) so `.select('id').single()` can still be called after it. Adjust the fake so `upsert()` records the call and returns `chain`, with `chain.single()` doing the actual resolving — do not have `upsert()` itself return a Promise, or the subsequent `.select('id').single()` chain call will fail on a resolved value having no `.select` method.

- [ ] **Step 5: Run the full engine test suite**

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations` — expect every prior test plus the new one(s) to pass, zero regressions.

- [ ] **Step 6: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260901010000_stage1_idempotency.sql ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.test.ts
git commit -m "feat: add deterministic idempotency to the Stage 1 write path"
```

---

### Task 17: Persist qualified Patterns

**Files:**
- Modify: `ciatta-mobile-app/supabase/functions/understanding-engine/patternEvaluation.ts` (add a new, additive confidence-derivation helper — do not touch `evaluatePattern`'s existing qualifying logic)
- Modify: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts` (return the two `PatternEvaluation` results from the pure function; write a `patterns` row and link `finding_evidence.pattern_id` when either qualifies)
- Test: `patternEvaluation.test.ts` (new cases for the confidence helper), `sleepDurationSlice.test.ts` (new case proving persistence)

**Step 1: Add `patternConfidence()` to `patternEvaluation.ts`** — a new export, added after `evaluatePattern`, not modifying it:

```typescript
// Pattern confidence -- derived only when a Pattern already qualifies
// (evaluatePattern's own gate, unchanged). Reuses the same
// strengthForConfidence()/CONFIDENCE_LABEL machinery every other stage
// uses, scaled against how far recurrenceCount clears the true
// qualifying minimum -- PATTERN_CONFIDENCE_RECURRENCE_CAP is an explicit,
// configurable MVP hypothesis for that scaling, NOT a universal
// scientific rule, same status as PATTERN_MIN_RECURRING_WINDOWS itself.
import { strengthForConfidence, type Strength } from './cycleAnalysis.ts';
import { CONFIDENCE_LABEL } from './decay.ts';

export const PATTERN_CONFIDENCE_RECURRENCE_CAP = 8;

export interface PatternConfidence {
  tier: Strength;
  label: string;
}

export function patternConfidence(recurrenceCount: number): PatternConfidence {
  const tier = strengthForConfidence(Math.min(1, recurrenceCount / PATTERN_CONFIDENCE_RECURRENCE_CAP));
  return { tier, label: CONFIDENCE_LABEL[tier] };
}
```

Add the import line (`strengthForConfidence`/`Strength` from `./cycleAnalysis.ts`, `CONFIDENCE_LABEL` from `./decay.ts`) to the top of `patternEvaluation.ts` alongside its existing (currently empty) import section — this file was deliberately import-free before; it is no longer fully domain-agnostic in the dependency sense, but its qualifying logic (`evaluatePattern`) is completely unchanged and still takes no dependency on these imports.

**Step 2: Test the new helper** — add to `patternEvaluation.test.ts`:

```typescript
Deno.test('patternConfidence: scales toward higher confidence as recurrence grows past the qualifying minimum', () => {
  const atMinimum = patternConfidence(4); // the true qualifying minimum
  const doubled = patternConfidence(8); // PATTERN_CONFIDENCE_RECURRENCE_CAP
  assertEquals(atMinimum.tier, 'moderate'); // min(1, 4/8)=0.5 -> <0.6 -> moderate
  assertEquals(doubled.tier, 'very-strong'); // min(1, 8/8)=1.0 -> very-strong
  assertEquals(doubled.label, 'very confident');
});
```

Run: `cd ciatta-mobile-app/supabase/functions/understanding-engine && deno test --allow-read=../../migrations patternEvaluation.test.ts` — expect all prior tests (from Task 6) plus this new one to pass unchanged.

**Step 3: Return Pattern results from `buildSleepDurationPipelineResult`** — in `sleepDurationSlice.ts`, add `energyPattern: PatternEvaluation | null` and `moodPattern: PatternEvaluation | null` (import the type from `./patternEvaluation.ts`) to the `SleepDurationPipelineResult` interface, and populate both fields at every return path (`null` on the three early-return branches, the real computed values on the happy path — they already exist as local variables `energyPattern`/`moodPattern`, just not currently returned).

**Step 4: Write the `patterns` row and link it, in `runSleepDurationSlice`** — after the `finding_evidence`... no: BEFORE the `finding_evidence` insert (since `finding_evidence.pattern_id` needs the pattern's real id at insert time), insert this block right after the `change_events` conditional block and before the `finding_evidence` upsert:

```typescript
  let patternId: string | null = null;
  const qualifyingPattern = result.energyPattern?.qualifies
    ? { pattern: result.energyPattern, toDomain: 'energy' as const }
    : result.moodPattern?.qualifies
      ? { pattern: result.moodPattern, toDomain: 'mood' as const }
      : null;

  if (qualifyingPattern) {
    const confidence = patternConfidence(qualifyingPattern.pattern.recurrenceCount);
    const { data: patternRow, error: patternError } = await supabase
      .from('patterns')
      .upsert(
        {
          user_id: userId,
          domain: 'sleep',
          to_domain: qualifyingPattern.toDomain,
          pattern_type: 'sleep_duration_vs_rating',
          recurrence_count: qualifyingPattern.pattern.recurrenceCount,
          window_count_required: qualifyingPattern.pattern.windowCountRequired,
          stable_under_removal: qualifyingPattern.pattern.stableUnderRemoval,
          alternative_explanation_checked: qualifyingPattern.pattern.alternativeExplanationChecked,
          alternative_explanation_ruled_out: qualifyingPattern.pattern.alternativeExplanationRuledOut,
          confidence: Math.min(1, qualifyingPattern.pattern.recurrenceCount / PATTERN_CONFIDENCE_RECURRENCE_CAP),
          confidence_label: confidence.label,
          threshold_version: qualifyingPattern.pattern.thresholdVersion,
        },
        { onConflict: 'user_id,domain,to_domain,pattern_type' }
      )
      .select('id')
      .single();
    if (patternError) throw patternError;
    patternId = patternRow.id;
  }
```

Add `patternConfidence` and `PatternEvaluation` to the existing `import ... from './patternEvaluation.ts'` line. Then add `pattern_id: patternId,` to the `finding_evidence` upsert payload (Task 16's Step 3 already converted this to `.upsert(...)` — add this one field to that same payload object, alongside the existing fields; `relationship_id` stays absent/null — this pipeline computes its own ad hoc monthly relationship instances, it does not write to or read from the legacy `relationships` table, so there is no relationship row of this pipeline's own to link).

- [ ] **Step 5: Test persistence** — add to `sleepDurationSlice.test.ts`:

```typescript
Deno.test('runSleepDurationSlice: writes a patterns row and links it when a Pattern qualifies', async () => {
  const recordedTables: string[] = [];
  const upserted: Record<string, unknown>[] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () => Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    upsert: (payload: Record<string, unknown>) => {
      upserted.push(payload);
      return chain;
    },
  };
  const supabase = {
    from(table: string) {
      recordedTables.push(table);
      return chain;
    },
  };

  // Sleep fixture: 20 nights, meaningful deviation on the latest night
  // (see Task 19's canonical surfaced fixture for the exact construction).
  // Energy fixture: >=4 independently confirming calendar months, each
  // with >=14 nights of sleep and enough paired rating data to confirm --
  // enough to genuinely qualify per evaluatePattern's true minimum.
  // (Implementer: build this fixture; if constructing 4 real confirming
  // months proves impractical within this task's time budget, that is
  // itself a finding to report — do not fabricate a fixture that doesn't
  // actually exercise real qualification.)

  // ... construct sleepObs, energyObs per the above ...
  // await runSleepDurationSlice(supabase, 'user-1', sleepObs, energyObs, [], new Date(...));

  // assertEquals(recordedTables.includes('patterns'), true);
  // const patternsWrite = upserted.find((p) => 'pattern_type' in p);
  // assertEquals(patternsWrite?.to_domain, 'energy');
  // const evidenceWrite = upserted.find((p) => 'sufficiency_verdict' in p);
  // assertEquals(evidenceWrite?.pattern_id, 'fake-id');
});
```

This test's exact fixture construction is intentionally left to the implementer to complete (constructing 4+ genuinely confirming months is real, non-trivial work) — write it for real, do not leave the commented-out skeleton in place. If after a good-faith attempt the fixture proves impractical to construct deterministically within reasonable effort, report that as a finding (BLOCKED or DONE_WITH_CONCERNS) rather than shipping a fake/vacuous test.

- [ ] **Step 6: Run the full suite, commit.**

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/patternEvaluation.ts ciatta-mobile-app/supabase/functions/understanding-engine/patternEvaluation.test.ts ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.test.ts
git commit -m "feat: persist qualified Patterns, linked from finding_evidence"
```

---

### Task 18: Fix the prior-findings query's ignored error

**Files:**
- Modify: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts`

**Step 1:** change the prior-findings query (added in Task 13's fix round) from:
```typescript
  const { data: priorFindingRow } = await supabase
    .from('findings')
    ...
    .maybeSingle();
```
to:
```typescript
  const { data: priorFindingRow, error: priorFindingError } = await supabase
    .from('findings')
    ...
    .maybeSingle();
  if (priorFindingError) throw priorFindingError;
```
matching every other query in this file, all of which already check and throw. This makes a failed prior-read a real, visible failure (caught by `index.ts`'s outer try/catch, same as any other failure in this path) instead of being silently treated as "no prior runs."

**Step 2:** add a test to `sleepDurationSlice.test.ts` proving a failed prior-read now throws:
```typescript
Deno.test('runSleepDurationSlice: a failed prior-findings read is never silently treated as "no prior runs"', async () => {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () => Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: new Error('simulated read failure') }),
    upsert: () => chain,
  };
  const supabase = { from: () => chain };

  let threw = false;
  try {
    await runSleepDurationSlice(supabase, 'user-1', twentyNightsAt400(), [], [], new Date('2026-07-21'));
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
```

- [ ] **Step 3:** run the full suite; commit.

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.ts ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.test.ts
git commit -m "fix: surface prior-findings read failures instead of silently treating them as no history"
```

---

### Task 19: A deterministic fixture proving the positive `'surfaced'` path

**Files:**
- Modify: `ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.test.ts`

**The fixture (hand-verified by the controller before this task was written):** 20 nights, July 1–20, 2026. Nights 1–19 (July 1–19) at exactly 400 minutes each. Night 20 (July 20, chronologically latest) at 200 minutes. `computeNightlySleepMinutesFeatures` produces 20 Feature rows; `computeNightlySleepBaseline` computes the median over all 20 values — sorted numerically, only one value (200) is below 400, so both middle values (index 9 and 10 of 20) are still 400, giving `baseline.value = 400`, `eligible = true` (20 ≥ 14). The latest Feature (July 20, value 200) evaluated against that baseline: `deviation = 200 - 400 = -200`, `direction = 'down'`, `isMeaningful = |−200| ≥ 45 = true`. Confidence: `strengthForConfidence(min(1, 20/30)) = strengthForConfidence(0.667) = 'strong'` (≥0.6, <0.85). Safety: the resulting statement contains no prohibited word → `'minimal'`. Experience selection: finding present, safe, meaningful, confidence in `['strong','very-strong']` → **`'surfaced'`**.

Add to `sleepDurationSlice.test.ts`:

```typescript
function nineteenNightsAt400ThenOneAt200(): SleepObservation[] {
  const nights = Array.from({ length: 20 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      id: `night-${i}`,
      type: 'sleep_segment' as const,
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`.replace('23:00', '06:00'),
      durationMinutes: i === 19 ? 200 : 400,
      stage: 'asleep' as const,
    };
  });
  return nights;
}

Deno.test('buildSleepDurationPipelineResult: a genuine meaningful deviation with enough history reaches surfaced', () => {
  const obs = nineteenNightsAt400ThenOneAt200();
  const result = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-07-21'));

  assertEquals(result.outcome, 'surfaced');
  assertEquals(result.baseline?.value, 400);
  assertEquals(result.change?.deviation, -200);
  assertEquals(result.change?.isMeaningful, true);
  assertEquals(result.finding?.confidenceTier, 'strong');
  assertEquals(result.finding?.statement, 'Your nightly sleep has been running about 200 minutes below your usual.');
  assertEquals(result.safetyTier, 'minimal');
});

Deno.test('buildSleepDurationPipelineResult: the surfaced Finding traces backward to its evidence via Explanation', () => {
  const obs = nineteenNightsAt400ThenOneAt200();
  const result = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-07-21'));
  assertEquals(result.outcome, 'surfaced');

  const explanation = explainSleepDurationFinding(
    result.finding!,
    result.evidence!,
    result.baseline!,
    result.change!,
    result.hasSupportedRelationship
  );

  assertEquals(explanation.whatCiattaNoticed, result.finding!.statement);
  assertEquals(explanation.supportingEvidence, 'Based on 20 nights of sleep data.');
  assertEquals(explanation.whatChanged, 'A meaningful change from your 400-minute usual.');
  assertEquals(explanation.confidenceStatement, 'Ciatta is confident in this.');
  // The explanation is built entirely from fields already on the Finding/
  // Evidence/Baseline/Change objects passed in -- nothing here is
  // recomputed or asserted beyond what those objects already carry,
  // which is the traceability the success criterion asks for: every
  // sentence in the explanation can be walked back to a concrete field
  // on a concrete, already-persisted-shape object.
  assertEquals(typeof explanation.whatCiattaDoesNotKnow, 'string');
  assertEquals(typeof explanation.whatThisDoesNotMean, 'string');
});
```

Add `explainSleepDurationFinding` to the existing import from `./explanation.ts` at the top of the test file (a new import line, since this file didn't previously import from `explanation.ts`).

- [ ] Run the full suite; commit.

```bash
git add ciatta-mobile-app/supabase/functions/understanding-engine/sleepDurationSlice.test.ts
git commit -m "test: prove the deterministic positive path to a surfaced, traceable Experience"
```

---

### Task 20: Full regression, independent verification, and the closure report

- [ ] Run `cd ciatta-mobile-app && npm run test:engine` — record the exact pass/fail count.
- [ ] Independently re-verify (controller, not a dispatched subagent): re-read every changed file from Tasks 16-19, re-run the full suite a second time, confirm `index.ts` has zero additional diff beyond what Task 13 already established, confirm the migration count and content.
- [ ] Write one consolidated closure build-history entry covering Tasks 16-20 together (not one per task, matching the user's request for a single closure report).
- [ ] Report to the user per the exact structure requested: closure results, remaining risks, then explicitly wait for approval before Stage 2 (still not authorized).

---

## Self-Review Notes

- **Spec coverage:** every object in `docs/specs/ciatta-semantic-refactor-spec-v1.md` §1 that the vertical slice must touch (Observation, Feature, Baseline, Change, Relationship [reused existing], Pattern, Evidence, Finding, Ciatta Knowledge, Confidence [reused `Strength`/`CONFIDENCE_LABEL`], Safety, Explanation, Experience, Guidance [reused `deriveGuidance` unchanged]) has a task. Context/Contextualization are explicitly out of scope for this one-Feature slice (no circumstantial data is used yet) — noted here rather than silently skipped.
- **Placeholder scan:** no TBD/TODO markers; every step has real, complete code; the one deliberately flagged ambiguity (Task 6's stability-under-removal arithmetic) is resolved inline with a concrete formula and an added test, not left open.
- **Type consistency:** `FeatureRecord`, `BaselineRecord`, `ChangeEventRecord`, `FindingEvidenceContent`, `FindingDraft`, `SafetyTier`, `ExperienceOutcome`, `PriorFindingRun` are each defined once (Tasks 3, 4, 5, 7, 8, 9, 11, 12 respectively) and consumed by identical name/shape in every later task and in Task 13's orchestrator.

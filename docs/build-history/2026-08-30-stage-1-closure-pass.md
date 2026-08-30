# Ciatta Build History — 2026-08-30 — Stage 1 Closure Pass (Tasks 16-20)

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 — closure pass, addressing all five Task 14 findings plus the `'surfaced'`-outcome test-coverage gap, before any Stage 2 domain expansion

**Status:** Complete, reviewed, approved by Jennifer Maxwell. **Stage 2 explicitly not authorized** — awaiting approval.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## Why this pass happened

Task 14's validation checkpoint proved the vertical slice could reach both silence outcomes (`no_finding`, `no_surfacing`) but found no test anywhere exercising the positive `'surfaced'` outcome, and surfaced five architectural findings with explicit dispositions (some "must fix before Stage 2," some "acceptable for MVP"). Jennifer directed a focused closure pass — explicitly not Stage 2, not any domain beyond sleep duration — resolving the highest-priority items before any further work, with a single consolidated report at the end rather than the per-task checkpoints used for Tasks 1-15.

**One explicit decision delegated this round:** whether qualified Patterns must be persisted for the MVP. Resolved: **yes** — the `patterns` table and `finding_evidence.pattern_id` column already existed (Task 2) specifically for this, Pattern was already genuinely computed (Task 13), and leaving it discarded left that schema work entirely vestigial. Implemented minimally, with `evaluatePattern`'s already-reviewed qualifying logic (Task 6) left completely untouched.

## What was done, in priority order

### Task 16 — Deterministic idempotency
Added `20260901010000_stage1_idempotency.sql`, a new migration adding five unique constraints (one per table lacking one): `features`/`baselines` on `(user_id, domain, feature_type, window_end)`, `change_events` on `(user_id, domain, feature_type, feature_id)`, `finding_evidence` on `(user_id, domain, baseline_id)`, `findings` on `(user_id, domain, feature_type, evidence_id)`. Converted all five corresponding writes in `sleepDurationSlice.ts` from plain `.insert()` to `.upsert(..., {onConflict: ...})`. A re-run of the same source data for the same night now updates the same row chain rather than appending a duplicate one. Verified: all five `onConflict` strings checked byte-for-byte against their constraint's column list; `ciatta_knowledge`'s pre-existing upsert (Task 13) confirmed untouched; a new executable test proves re-running the same data twice produces only upserts, never plain inserts.

### Task 17 — Persist qualified Patterns
Added `patternConfidence()` to `patternEvaluation.ts` (additive only — `evaluatePattern`'s qualifying logic is byte-identical to before). `buildSleepDurationPipelineResult` now returns the real `energyPattern`/`moodPattern` evaluation objects. `runSleepDurationSlice` writes a `patterns` row (via upsert, consistent with Task 16) and links it through `finding_evidence.pattern_id` whenever either qualifies. The test proving this required constructing 4 independently confirming calendar months of realistic sleep+rating data — genuinely difficult, real work, not a stub — and it worked on the first attempt; the value was independently re-derived by the task reviewer from `sleepAnalysis.ts`'s actual thresholds, not just trusted from a passing test.

**A review finding was fixed directly, transparently noted as a process deviation:** the review found the `patterns` row's `confidence` numeric and `confidence_label` string were computed by two independent copies of the same formula — a latent mismatch hazard if either drifted. The controller fixed this directly (not through a dispatched implementer+reviewer round, given its small, mechanical, well-verified scope) by making `patternConfidence()` the single source of truth for both fields, then ran the full suite personally to confirm. This is the one place in this whole session a finding was fixed outside the normal implement→review→verify cycle; noted here rather than presented as having gone through the same process as everything else.

**A second review finding was explicitly parked, not decided:** when both energy and mood independently qualify, only energy (checked first) is persisted and linked — mood is not merged, ranked, or written. There is also no deactivation path: a Pattern row is refreshed on every qualifying run but never removed or marked stale once a later run's evidence no longer supports it. Both are real product questions (does Ciatta Knowledge's revisability principle extend to Patterns?) — documented inline at the write site, reported here, not decided unilaterally.

### Task 18 — Fix the ignored query error
The prior-findings read in `runSleepDurationSlice` (added during Task 13's own fix round) destructured only `data`, silently treating a failed read as "no prior history" instead of surfacing it — the one query in this file inconsistent with every other query's own error-checking. Fixed to check and throw, matching the file's established discipline everywhere else. A failed prior-read now correctly propagates to `index.ts`'s outer try/catch like any other failure in this path.

### Task 19 — The flagship: a deterministic fixture reaching `'surfaced'`, with traceability
Twenty nights, nineteen at 400 minutes, the chronologically latest at 200. This drives the full chain to a genuine positive outcome: baseline (median) = 400; deviation = −200 (meaningful); confidence = `'strong'` (sample size 20 of 30, landing at 0.667, inside `[0.6, 0.85)`); statement = *"Your nightly sleep has been running about 200 minutes below your usual."*; safety = `'minimal'`; **outcome = `'surfaced'`**. A second test calls `explainSleepDurationFinding()` on the result and asserts four of its eight fields exactly, proving the write path and the (deliberately separate, read-time-only) Explanation path connect correctly end to end.

This fixture's every value was derived **three times, independently, by three different parties**, and all three converged exactly: the controller hand-derived it before writing the task brief; the implementer re-derived it from the actual source files without trusting the brief's arithmetic; the task reviewer (dispatched explicitly as a third independent check, not a rubber-stamp) re-derived it a third time from source, ran the tests itself, and confirmed every one of eight checkpoints byte-for-byte. All three independently caught and correctly judged harmless the same subtle finding: `nightKey()`'s date-bucketing shifts each observation's effective calendar night back by one day from its literal date label — a pre-existing convention (also present in Task 13's own shipped fixtures), affecting no assertion, since nothing in the pipeline reads absolute date strings.

**Minor findings, parked rather than fixed:** the traceability test asserts 4 of the 8 `Explanation` fields exactly; the other 4 (`relevantContext`, `relationshipOrPattern`, plus two `typeof === 'string'` checks) are either untested or only weakly checked. Given three-way convergence on everything actually asserted, and the genuine cost/value tradeoff of a further fix round, this was left as an explicitly-noted coverage gap rather than pursued further.

### Task 20 — Full regression and independent re-verification (this task)
Performed directly by the controller, not a dispatched subagent, per the plan's own design for this closing task.

## Validation performed

- **Full regression, twice independently:** `npm run test:engine` and a separate raw `deno test --allow-read=../../migrations` invocation — both **189/189**, zero failures, zero flakiness between runs.
- **Type checking:** `deno check` on all 11 Stage 1 TypeScript files (the original ten plus the closure pass's changes to `patternEvaluation.ts` and `sleepDurationSlice.ts`) — clean, zero errors.
- **`index.ts` re-confirmation:** `git diff --stat` from Task 13's original wiring commit to the current `HEAD` on `index.ts` is **empty** — the entire closure pass, all five tasks, touched nothing in the legacy engine file beyond what was already reviewed and approved in Task 13.
- **Full repository diff/status audit:** the whole feature branch (`2724865..HEAD`) now touches 43 files, 5995 insertions, 2 deletions. **Zero files outside `ciatta-mobile-app/supabase/` and `docs/`, anywhere, across all 19 executed tasks.** `index.ts` remains exactly +14/-0. `sleepAnalysis.ts` remains the Task 1 export-only edit. No other legacy file appears in the diff at all.
- **Build-history completeness:** all 14 entries for Tasks 1-14 confirmed present, plus this consolidated entry for the closure pass.
- **Migration integrity:** two migrations now exist for this work (`20260901000000_intelligence_foundation_sleep_slice.sql`, `20260901010000_stage1_idempotency.sql`), both new forward migrations; no existing migration was edited anywhere in this branch's history.

## The critical question, revisited

> We can demonstrate one real, deterministic sleep journey that produces either deliberate Silence OR a defensible surfaced Experience, with every surfaced claim traceable backward to its evidence.

**Yes — now proven, not merely argued.** The gap Task 14 identified is closed: Task 19's fixture is a real, deterministic, triple-independently-verified sleep journey that reaches `'surfaced'` with an exact, asserted statement, and a second test proves that statement plus its full supporting context is genuinely reconstructable via `explainSleepDurationFinding()` — the read-path traceability the success criterion names explicitly. Combined with the two existing silence-outcome tests (`no_finding`, `no_surfacing`), all three of the pipeline's meaningful terminal states now have a concrete, asserted example.

## Disposition of the five Task 14 findings, after this pass

| # | Finding | Disposition after closure |
|---|---|---|
| 1 | Idempotency | **Resolved.** Five new unique constraints, all writes converted to upsert, proven by a dedicated re-run test. |
| 2 | Non-atomic writes | **Unchanged — still open, as ruled acceptable for this MVP checkpoint.** Not addressed in this pass; remains a "before real-user testing at scale" item. |
| 3 | Pattern computed but discarded | **Resolved.** Qualified Patterns are now persisted and linked. Two narrower, real gaps remain and are explicitly parked (see Task 17 above): only one domain persisted when both qualify; no deactivation path for a Pattern that stops qualifying. |
| 4 | Alternative-explanation check non-binding | **Unchanged in mechanism, but its premise changed.** It's no longer true that "Pattern isn't consumed anywhere" — Pattern is now persisted. The check itself is still real-but-subsumed by `evaluatePattern`'s own stricter recurrence gate, exactly as before. This is now worth revisiting sooner than originally scoped, since Pattern data is live in the schema. |
| 5 | Ignored query error | **Resolved.** Fixed to match the file's own established discipline. |

## Remaining risks (carried forward, all explicitly reported, none silently closed)

- Non-atomic five-table writes with no compensation on partial failure (Task 14's finding #2) — untouched by this pass.
- The `checkAlternativeExplanation` check remains structurally non-binding given `evaluatePattern`'s stricter gate — now more relevant to resolve since Pattern rows are live in the schema.
- Only one domain's Pattern (energy, checked first) is persisted and linked when both energy and mood independently qualify; no deactivation path exists for a Pattern that stops qualifying on a later run.
- `finding_evidence` remains explicitly provisional — the dedicated Evidence Ledger architecture (Approval Checkpoint item 8) is still an open decision, deliberately not resolved by this pass.
- The `'surfaced'` path's `Explanation` traceability test covers 4 of 8 fields exactly; the remaining 4 are untested or only weakly checked.
- One process deviation this pass: one Important review finding (Task 17's confidence-formula duplication) was fixed directly by the controller rather than through the normal implementer→reviewer→verify cycle used for every other finding in this session — a judgment call given its small, mechanical, fully-verified scope, disclosed here rather than presented as equivalent rigor to the rest of the session.

## Is Stage 1 genuinely complete now?

Yes, in the fullest sense the plan and this closure pass together define it: a complete, additive, isolated, idempotent, tested vertical slice exists, demonstrating all three meaningful terminal outcomes (two silence forms plus a genuine surfaced Experience) with full backward traceability on the positive path, zero legacy regressions across 19 executed tasks, and a diff that touches nothing outside two minimal, reviewed legacy insertions in the entire history of this branch.

## Next milestone

**Stage 2 remains explicitly not authorized.** Awaiting Jennifer's review of this closure report and the remaining risks above before any decision to expand beyond sleep duration.

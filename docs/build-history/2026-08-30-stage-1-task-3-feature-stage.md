# Ciatta Build History — 2026-08-30 — Stage 1, Task 3: Feature stage

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 3 of 15

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Awaiting Task 4 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

Added the first real computation in the new pipeline: `feature.ts`, implementing the **Feature** stage (a reproducible value calculated from Observations — see `docs/specs/ciatta-semantic-refactor-spec-v1.md` §1.2). For this slice, the one Feature is nightly sleep duration in minutes.

Built test-first: the failing test (`feature.test.ts`) was written and run before any implementation existed, confirmed to fail because the file didn't exist yet, then the implementation was written and the tests re-run to green.

The implementation reuses `nightKey`, `isAsleepStage`, and `nightlySleepMinutes` — exported from the legacy `sleepAnalysis.ts` in Task 1 for exactly this purpose — rather than re-deriving the night-bucketing logic. The task reviewer independently confirmed this by reading `sleepAnalysis.ts` directly and tracing the actual function calls, not just trusting the implementer's claim.

## Result

- Commit `b5c7275` on `feature/intelligence-refactor-stage-1-sleep-slice`.
- TDD evidence: RED (file-not-found, expected) confirmed before implementation; GREEN (3/3 new tests passing) confirmed after.
- Full engine suite: 134/134 passing (131 baseline + 3 new Feature tests), zero regressions.
- Task reviewer verdict: ✅ spec compliant, 0 findings, Task quality: Approved.

## Scientific / architectural decisions made

None. This task's computation is identical, math-for-math, to what the legacy `analyzeSleep()` already does for night-bucketing — only the persistence and traceability (observation IDs, calculation version) are new. No new scientific claim, threshold, or gate was introduced.

## Deviations from the approved specification

None.

## Parked concerns

Carried forward from Task 2, unaffected by this task: `patterns`' unique constraint treats `to_domain IS NULL` as distinct under standard Postgres semantics — still open for confirmation before Stage 2 widens `patterns` usage. No new concerns from Task 3.

## Next milestone

Task 4: `baseline.ts` — the Baseline stage (median nightly sleep minutes over a window), reusing `median()` from `dailyMetricRatingRelationship.ts`. Not yet started — awaiting approval to proceed.

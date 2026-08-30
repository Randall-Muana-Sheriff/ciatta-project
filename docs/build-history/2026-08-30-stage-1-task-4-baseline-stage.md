# Ciatta Build History — 2026-08-30 — Stage 1, Task 4: Baseline stage

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 4 of 15

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Awaiting Task 5 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

Added `baseline.ts`, implementing the **Baseline** stage (an individual's reference representation for a Feature, from an appropriate comparison window — see `docs/specs/ciatta-semantic-refactor-spec-v1.md` §1.4). For this slice: the median of the nightly-sleep-minutes Feature values, over a minimum 14-night window — `BASELINE_MIN_SAMPLE = 14`, deliberately matching the legacy `sleepAnalysis.ts`'s own `BASELINE_MIN_NIGHTS` exactly, with a comment noting the two must not silently drift apart while both pipelines run side by side.

Built test-first, reusing the existing `median()` from `dailyMetricRatingRelationship.ts` rather than reimplementing a median calculation.

**Pre-flight fix before dispatch:** while preparing this task, the controller caught a self-inconsistency in the plan's own test code — a confusing dead-code ternary (`[...values].sort(...)[6] === undefined ? 0 : (400+400)/2`) masking a hardcoded expected value behind logic that could never actually branch. The hardcoded value (400) was mathematically correct — verified by hand: the median of the given 14-night fixture, sorted, is the average of the two middle values, both 400 — so no test *behavior* changed, only clarity. Fixed in the plan before the task brief was generated, so the implementer never saw the confusing version.

## Result

- Commit `aa93505` on `feature/intelligence-refactor-stage-1-sleep-slice` (plan fix at `2e79850`).
- TDD evidence: RED confirmed before implementation, GREEN (2/2 new tests) confirmed after.
- Full engine suite: 136/136 passing (134 baseline + 2 new Baseline tests), zero regressions. Independently re-run by the controller with the same result.
- Task reviewer verdict: ✅ spec compliant, 0 findings, Task quality: Approved. Controller independently re-read the implementation file directly and confirmed the same.

## Scientific / architectural decisions made

None. `BASELINE_MIN_SAMPLE = 14` is not a new scientific decision — it's a direct, intentional mirror of the legacy engine's existing, already-shipped threshold, not a new claim.

## Deviations from the approved specification

None in content. One plan-text defect (the dead-code ternary above) was caught and fixed before dispatch — a plan clarity fix, not a specification or architecture deviation.

## Parked concerns

Carried forward from Task 2, untouched by Task 4 as instructed: `patterns`' unique constraint NULL semantics on `to_domain` — still open for confirmation before Stage 2. No new concerns from Task 4.

## Next milestone

Task 5: `changeEvent.ts` — the Change stage (measured vs. meaningful deviation from Baseline). Not yet started — awaiting approval to proceed.

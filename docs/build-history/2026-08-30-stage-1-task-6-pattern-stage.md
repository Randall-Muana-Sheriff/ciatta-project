# Ciatta Build History — 2026-08-30 — Stage 1, Task 6: Pattern stage

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 6 of 15

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Awaiting Task 7 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

Added `patternEvaluation.ts`, implementing the **Pattern** stage (a Relationship or Change demonstrating sufficient recurrence, temporal consistency, persistence/stability, adequate data, and a checked alternative explanation — see `docs/specs/ciatta-semantic-refactor-spec-v1.md` §1.7). This is the object your explicit direction resolved in the semantic refactor spec approval: correlation alone never promotes to Pattern.

`PATTERN_MIN_RECURRING_WINDOWS = 3` is documented as an explicit, configurable MVP hypothesis, not a universal scientific rule, per standing instruction this session. The evaluator's actual qualifying minimum is 4 confirming instances (3, plus one to spare so removing the single strongest window still leaves the recurrence bar cleared — a genuine stability check, not a vacuous restatement of the recurrence count).

This file is pure and domain-agnostic: no imports from `feature.ts`/`baseline.ts`/`changeEvent.ts`, reusable for a future domain's Pattern evaluation without modification.

## A real plan defect caught and fixed before dispatch

Unlike the Task 4 fix (a clarity-only issue), this one was load-bearing: the plan's own prior self-correction note had updated the implementation's stability formula and added one new test, but never propagated the change to a pre-existing test ("non-confirming instances do not count toward recurrence"), which still asserted `qualifies: true` at `recurrenceCount: 3` — a combination the corrected formula can never produce. Traced the arithmetic by hand before dispatch, rewrote the contradicting test to reach the true qualifying minimum (4 confirms out of 5 windows) while preserving its original purpose (proving non-confirming windows are excluded from the count), simplified the implementation to a clean non-redundant formula, and removed the stale prose note. All six final test cases were hand-verified against the final implementation before the plan fix was committed — and independently hand-traced a second time, from scratch, by the task reviewer after implementation, with identical results.

## Result

- Commit `3fb45b8` on `feature/intelligence-refactor-stage-1-sleep-slice` (plan fix at `12fa0b4`).
- TDD evidence: RED confirmed ("Cannot find module") before implementation, GREEN (6/6 tests) confirmed after.
- Full engine suite: 145/145 passing (139 baseline + 6 new Pattern tests), zero regressions. Independently re-run by the controller with the same result.
- Task reviewer verdict: ✅ spec compliant, 0 Critical/Important findings, Task quality: Approved. Reviewer independently hand-traced all six test cases against the shipped formula from scratch — did not trust either the controller's or implementer's arithmetic — and got identical results. Controller separately re-read the implementation file directly and confirmed byte-for-byte match to the corrected plan.

## Scientific / architectural decisions made

One, already directed by Jennifer and executed here: Pattern requires genuine recurrence (not a single correlation) with a real stability-under-removal check and a checked alternative explanation — implementing the Relationship-vs-Pattern resolution from the approved semantic refactor specification. The specific numeric threshold (3, with a true qualifying minimum of 4) remains flagged in code as a provisional MVP hypothesis, not a settled scientific claim, per standing instruction.

## Deviations from the approved specification/plan

None in the final, shipped content. One plan-text defect (the test/formula contradiction above) was caught and fixed before dispatch.

## Parked concerns

1 new (Minor, deferred): a test's name ("at-threshold recurrence...") is slightly misleading — it actually exercises the true qualifying minimum (4 instances), not the raw threshold (3). Cosmetic naming only; the test itself is correct and useful. Not fixed, not blocking.

Carried forward unchanged from Task 2, per explicit instruction: `patterns`' unique constraint NULL semantics on `to_domain` — untouched by Task 6, still open for confirmation before Stage 2.

## Next milestone

Task 7: `findingEvidence.ts` — the (provisional) Evidence stage, ledger content and sufficiency verdict. Not yet started — awaiting approval to proceed.

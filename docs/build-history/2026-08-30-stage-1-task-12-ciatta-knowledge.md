# Ciatta Build History — 2026-08-30 — Stage 1, Task 12: Ciatta Knowledge retention

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 12 of 15

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Awaiting Task 13 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

Added `ciattaKnowledge.ts`, implementing the **Ciatta Knowledge** retention decision — information established sufficiently for its intended purpose and permitted to be retained/reused (see `docs/specs/ciatta-semantic-refactor-spec-v1.md` §1.10, §2.1). `KNOWLEDGE_MIN_REPRODUCED_RUNS = 2` is documented as an explicit, configurable MVP hypothesis, not a universal rule, per standing instruction this session.

## A real, safety-relevant plan defect caught and fixed before dispatch

The third defect of its kind this run (after Tasks 4 and 6), and the most consequential: the plan's originally-given `shouldRetain` formula computed retention purely from the total reproduced-run count. Traced by hand and confirmed by script before dispatch: this formula would have returned `shouldRetain: true` for a case the plan's own test 5 asserts `false` — two qualifying prior strong runs, paired with a currently weak (`moderate`) confidence, would have retained Ciatta Knowledge that the current evidence no longer supports.

Fixed by requiring `shouldRetain = currentQualifies && reproducedRuns >= KNOWLEDGE_MIN_REPRODUCED_RUNS` — both the current run's own confidence must independently qualify, and the reproduced-run count must clear the threshold. This is not just a bug fix: it's also the scientifically correct reading of the spec's own revisability requirement (§1.10: "if supporting evidence weakens... Knowledge updates or withdraws, never stays stale"). Without this gate, once Ciatta Knowledge was established by two strong runs, it could never be withdrawn by a subsequent weak or contradicted run — a real defect in the retention/decay behavior, not a cosmetic one. All five test cases were re-verified against the corrected formula by script before committing the plan fix, and the task reviewer independently re-traced all five from scratch afterward, specifically confirming the fixed gate survived into the shipped code.

## Result

- Commit `912ae53` on `feature/intelligence-refactor-stage-1-sleep-slice` (plan fix at `49b2f1f`).
- TDD evidence: RED confirmed ("Cannot find module") before implementation, GREEN (5/5 tests) confirmed after.
- Full engine suite: 172/172 passing (167 baseline + 5 new), zero regressions. Independently re-run by the controller with the same result.
- Task reviewer verdict (dispatched with extra scrutiny given the fixed defect): ✅ spec compliant, 0 Critical/Important findings, Task quality: Approved. Reviewer independently confirmed the `currentQualifies &&` gate genuinely survived into the shipped code, not reverted to the buggy single-condition version.

## Scientific / architectural decisions made

The Finding→Ciatta Knowledge promotion rule (≥2 reproduced runs, current run must independently qualify) was already directed in the approved spec amendment — this task implements it, and the pre-flight fix corrected an unfaithful implementation of that already-approved rule, it did not introduce a new decision.

## Deviations from the approved specification/plan

None in the final shipped content. One real plan-text defect (the retention-gate arithmetic above) was caught and fixed before dispatch.

## Parked concerns

2 new (both Minor, deferred, coverage gaps rather than defects): no test directly exercises the `'emerging'` tier or a `'very-strong'` current confidence; no test combines both exclusion reasons (contradicted + weak-tier) in one case. Neither required by the plan's five given tests, and both are already logically covered since the two exclusion conditions are independently AND'd in one filter predicate.

Carried forward unchanged, none touched by this task: `patterns` NULL-uniqueness (Task 2), `patternEvaluation.ts` test-3's imprecise name (Task 6), `qualityFlags` aliasing (Task 7), `safety.ts`'s substring matching and untested recovery/energy map entries (Task 9).

## Next milestone

Task 13: `sleepDurationSlice.ts` — the orchestrator wiring every prior stage together for one user, plus the additive, try/catch-isolated call site in `index.ts`. This is the integration task that completes the vertical slice end to end. Not yet started — awaiting approval to proceed.

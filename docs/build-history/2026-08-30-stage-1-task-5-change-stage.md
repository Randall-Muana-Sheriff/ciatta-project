# Ciatta Build History — 2026-08-30 — Stage 1, Task 5: Change stage

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 5 of 15

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Awaiting Task 6 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

Added `changeEvent.ts`, implementing the **Change** stage (difference from an appropriate personal reference — see `docs/specs/ciatta-semantic-refactor-spec-v1.md` §1.5). This is the first stage to formally carry the *measured-vs-meaningful* distinction the spec requires: `evaluateChange()` always computes the raw deviation, but only marks it `isMeaningful` when it clears `CHANGE_THRESHOLD_MINUTES` (45, mirroring the legacy `sleepAnalysis.ts`'s `SHORT_NIGHT_THRESHOLD_MINUTES`).

Per Jennifer's explicit instruction this session ("treat configured thresholds as MVP hypotheses, not universal scientific truths"), the 45-minute threshold's code comment states plainly it is "this one Feature's provisional significance rule — not a universal claim about what counts as meaningful change for every Feature."

Built test-first. A hard gate — no eligible Baseline, no Change at all (returns `null`, never a degraded/zero record) — is enforced before any deviation math runs.

## Result

- Commit `0d24595` on `feature/intelligence-refactor-stage-1-sleep-slice`.
- TDD evidence: RED confirmed before implementation, GREEN (3/3 new tests) confirmed after.
- Full engine suite: 139/139 passing (136 baseline + 3 new Change tests), zero regressions. Independently re-run by the controller with the same result.
- Task reviewer verdict: ✅ spec compliant, 0 findings, Task quality: Approved. Controller independently re-read the implementation file directly and confirmed the same, including the exact `>=` (not `>`) threshold comparison the plan required.

## Scientific / architectural decisions made

None new. The 45-minute threshold is not a new decision — it mirrors the already-shipped legacy constant — and is explicitly labeled provisional/MVP-only in code, per standing instruction.

## Deviations from the approved specification/plan

None.

## Parked concerns

Carried forward unchanged from Task 2, per explicit instruction: `patterns`' unique constraint NULL semantics on `to_domain` — untouched by Task 5, still open for confirmation before Stage 2. No new concerns from Task 5.

## Next milestone

Task 6: `patternEvaluation.ts` — the Pattern stage (recurrence/stability/alternative-explanation evaluator), with `PATTERN_MIN_RECURRING_WINDOWS = 3` as an explicit, configurable MVP hypothesis. Not yet started — awaiting approval to proceed.

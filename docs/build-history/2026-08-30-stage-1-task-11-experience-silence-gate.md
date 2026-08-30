# Ciatta Build History — 2026-08-30 — Stage 1, Task 11: Experience/Silence gate

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 11 of 15

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Awaiting Task 12 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

Added `experienceSelection.ts`, implementing the **Experience/Silence** selection gate (see `docs/specs/ciatta-semantic-refactor-spec-v1.md` §1.14, §2.6, §2.7). `selectForExperience()` returns exactly one of four outcomes — `surfaced`, `no_finding`, `no_surfacing`, `no_notification` — and deliberately never reprocesses or reinterprets the Confidence/Safety values it's given; it only ranks/filters what already cleared those gates upstream.

Gate order matters and is exactly: missing finding/confidence/safety → `no_finding`; unsafe tier → `no_surfacing`; not a meaningful change → `no_surfacing`; confidence below the notifiable tier → `no_notification`; otherwise → `surfaced`.

## Result

- Commit `a62e45e` on `feature/intelligence-refactor-stage-1-sleep-slice`.
- TDD evidence: RED confirmed before implementation, GREEN (5 test blocks, 6 assertions) confirmed after.
- Full engine suite: 167/167 passing (162 baseline + 5 new), zero regressions. Independently re-run by the controller with the same result.
- Task reviewer verdict: ✅ spec compliant, 0 findings, Task quality: Approved. Reviewer independently re-traced all six assertions, confirming the unsafe-tier and not-meaningful-change gates each correctly short-circuit before the confidence check is ever reached, and confirming no Confidence/Safety re-derivation happens inside this function.

## Scientific / architectural decisions made

None new. This task implements the "Experience never reprocesses evidence" principle already established in the spec.

## Deviations from the approved specification/plan

None.

## Parked concerns

None new. All four prior items carried forward unchanged, none touched by this task.

## Next milestone

Task 12: `ciattaKnowledge.ts` — the Ciatta Knowledge retention decision, with `KNOWLEDGE_MIN_REPRODUCED_RUNS = 2` as an explicit, configurable MVP hypothesis. Not yet started — awaiting approval to proceed.

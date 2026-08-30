# Ciatta Build History — 2026-08-30 — Stage 1, Task 14: mandatory validation checkpoint

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 14 of 15, the mandatory validation/parity/regression gate before Stage 1 can be reported complete

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Task 15 and Stage 2 explicitly **not** authorized — awaiting approval.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

This task was scoped by Jennifer to go beyond the plan's own Task 14 file (dual-write parity tests) into a full Stage 1 validation sweep: end-to-end verification, legacy/new-path parity, the full engine suite, type/lint/build checks, a repository diff/status audit, confirmation that no unintended legacy behavior changed, confirmation of build-history completeness, and an explicit disposition for five architectural concerns the Task 13 review surfaced — **without silently fixing any of them**.

## The critical question

> Can we demonstrate that ONE real sleep-duration journey can reliably move from source data through the evidence-bound pipeline to either a defensible Experience or deliberate Silence, while the existing product continues functioning unchanged?

**Yes — with one honest gap.** Concrete evidence:

- A 5-night journey (insufficient evidence) → `no_finding`, a real, tested silence outcome — proven by `buildSleepDurationPipelineResult`'s own test and independently corroborated by the parity test's second case, which confirms the *legacy* pipeline reaches the same ineligibility verdict on identical data.
- A 20-night journey with constant, unvarying sleep (sufficient evidence, but nothing meaningfully changed) → `no_surfacing`, a *different* valid silence outcome, with the actual Finding statement wording asserted ("close to your usual"), not just the outcome enum.
- The legacy and new pipelines agree on eligibility at the boundary (20 nights) and below it (5 nights) — the parity suite's actual purpose.
- Legacy-path continuity is proven, not just claimed: the full regression suite is 182/182 passing, the `index.ts` diff across this entire branch is exactly 14 inserted lines and 0 deletions, and an executable test (added during Task 13's fix round) proves a failed write in the new path throws out of `runSleepDurationSlice` rather than being silently swallowed — the precondition the legacy-path isolation depends on.

**The honest gap:** no test anywhere in this codebase exercises the positive `'surfaced'` outcome with a concrete fixture. Every existing test reaches one of the two demonstrated silence forms. The pipeline's logic for reaching `'surfaced'` (`experienceSelection.ts`'s own gate) is independently unit-tested in isolation and was hand-traced correctly during Task 11's review, but the *sleep-duration vertical slice specifically* has never been exercised end-to-end with a fixture that actually produces a meaningful, safe, high-confidence deviation reaching `'surfaced'`. This doesn't mean the path doesn't work — the logic composing it is each independently correct — but it does mean "reliably move to a defensible Experience" has been demonstrated by construction and isolated unit tests, not by one concrete end-to-end fixture. Reported here as a real, unaddressed gap, not silently closed.

## Validation performed

**End-to-end vertical-slice verification:** `sleepDurationSlice.test.ts` (7 tests) exercises the pure pipeline core and the async write path, described above.

**Legacy/new-path parity verification:** `sleepDurationSlice.parity.test.ts` (3 tests, new this task) — legacy and new pipelines agree on eligibility at 20 nights and ineligibility at 5 nights; a determinism check on `deriveGuidance` (the task reviewer correctly noted this third test is weaker than its own comment claims — a true cross-pipeline input-shape check, not just a determinism check — but it's exactly what the plan specified, and per this task's explicit no-fix instruction it was left as-is, not strengthened).

**Full engine test suite:** 182 passed, 0 failed. Confirmed independently by the controller via both raw `deno test --allow-read=../../migrations` and the documented `npm run test:engine` command — same result both ways.

**Regression testing:** the exact same 179 pre-Task-14 tests all still pass unchanged, plus 3 new parity tests. Zero change to any existing test's expected output anywhere in the whole plan's execution (verified test-by-test at every one of the 14 tasks' checkpoints, not just at this final gate).

**Type/lint/build checks:**
- `deno check` on all 11 new Stage 1 TypeScript files: clean, zero type errors.
- `deno check index.ts`: fails — but on a missing `node_modules` for the `npm:@supabase/supabase-js` import, confirmed **pre-existing and unrelated to this work** by reproducing the identical failure against `main`'s own completely unmodified `index.ts`.
- `deno lint`: 2 findings are pre-existing and universal across the entire codebase (`no-import-prefix` on inline `https://` test imports — no `deno.json` exists anywhere in this repo, confirmed by reproducing the same finding on `sleepAnalysis.test.ts`, which predates this session entirely). 1 new, genuine, harmless finding: `RatingObservation` imported but never used in `sleepDurationSlice.test.ts` (Task 13) — cosmetic only, `deno check` passes clean on the same file.

**Repository diff/status audit:** the entire feature branch (`2724865..HEAD`) touches 26 files: 1769 insertions, 2 deletions. **Zero files touched outside `ciatta-mobile-app/supabase/` and `docs/`, anywhere, across all 14 tasks.** `index.ts` carries exactly +14/-0 (the Task 13 wiring). `sleepAnalysis.ts` carries the Task 1 export-only edit. No other legacy file appears in the diff at all.

**Confirmation no unintended legacy behavior changed:** the diff stat above is the proof — nothing outside the new files and those two minimal, reviewed legacy touches exists anywhere in this branch's history.

**Confirmation build-history documentation is present:** all 13 entries for Tasks 1–13 verified present via directory listing before this entry was written.

## Each architectural concern and its disposition

Per explicit instruction: none of these were fixed during this validation pass. Each disposition below is a controller judgment call, flagged for your review, not a unilateral decision to alter code.

| # | Concern | Disposition |
|---|---|---|
| 1 | **Idempotency** — 5 of 7 new tables have no unique constraint; every qualifying engine invocation appends a full new row set | **Must fix before Stage 2 and before real-user testing.** Affects every single run, not just failure paths — 100% frequency, unlike the others below. Stage 2 will likely copy this exact insert pattern into new domain orchestrators sharing these same tables, making the eventual fix progressively more expensive the longer it's deferred. |
| 2 | **Non-atomic multi-table writes** — a failure partway through the 5-6 sequential inserts leaves orphaned rows, with no compensation | **Acceptable for this MVP checkpoint.** Already isolated from the legacy path by `index.ts`'s own try/catch; only triggers on actual write failures (rare), not every run. Must fix before real-user testing at scale; does not block Stage 2's start on its own. |
| 3 | **Pattern computed but discarded** — `evaluatePattern()` genuinely runs, but `hasSupportedRelationship` is never even read by `runSleepDurationSlice`, let alone persisted; no `patterns` row is ever written | Doesn't break anything shipped today — nothing depends on it. But it's an incomplete demonstration of the originally-scoped full vertical slice (Relationship/Pattern was meant to be part of the one complete path). **Must be explicitly resolved — either implemented, or formally deferred with your sign-off — before Stage 2**, since Stage 2 will build on whatever precedent this sets for how Pattern data flows through the system. |
| 4 | **Alternative-explanation check remains non-binding** — real (no longer tautological) but strictly subsumed by `evaluatePattern`'s own stricter recurrence gate, so it can never independently change the outcome | Directly tied to #3: since Pattern's qualification isn't consumed anywhere yet, its internal rigor has no observable effect on the system today either. **Acceptable for MVP now; must be revisited whenever Pattern is actually persisted or surfaced** (Stage 2 or later), since it's part of an explicitly-named conservative-evidence-bar requirement. |
| 5 | **The new `priorFindingRow` query ignores its own `error` result** — a failed read is silently treated as "no prior runs" rather than surfacing | Inherited pattern (the query it replaced during Task 13's fix round had the identical gap). Fails toward the *safe* direction — under-retention, never a false-positive retention — consistent with the product's "when in doubt, stay silent" philosophy. **Acceptable for MVP; should fix before Stage 2** for consistency with every *other* query in this same file (all of which correctly check and throw); **must fix before real-user testing** for debuggability and the spec's own traceability requirement. |

## Any required fixes

None applied during this validation task, per explicit instruction. Five items above carry dispositions requiring action before Stage 2 and/or before real-user testing — summarized in the final report's "Required fixes" section for your decision on sequencing.

## Remaining risks

- The `'surfaced'` outcome gap (described under the critical question) — not a broken path, but an undemonstrated one for this specific vertical slice.
- Everything in the disposition table marked "must fix before Stage 2" or "before real-user testing" remains genuinely unfixed as of this entry.
- `finding_evidence` remains explicitly provisional (unchanged from Task 7) — the dedicated Evidence Ledger architecture decision (Approval Checkpoint item 8) is still open.

## Next milestone

Task 15 does not exist in the original 15-task plan as a distinct item — Task 14 was the plan's final task. "Stage 2" (widening beyond the sleep-duration slice to other domains/features per the original semantic refactor specification's staged rollout) is the next real milestone, and is **explicitly not authorized** as of this entry. Awaiting your review of the disposition table and this report before any further work begins.

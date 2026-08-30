# Ciatta Build History — 2026-08-30 — Stage 1, Task 13: orchestrator integration

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 13 of 15 (the integration task)

**Status:** Complete, reviewed (including a fix round), approved by Jennifer Maxwell. Awaiting Task 14 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

This is the task that completes the Stage 1 vertical slice end to end. Added `sleepDurationSlice.ts` — an orchestrator wiring together every stage built in Tasks 3–12 (Feature, Baseline, Change, Pattern, Evidence content, Finding, Safety, Experience/Silence, Ciatta Knowledge) — and made the **only edit to the live legacy `index.ts` engine anywhere in this plan**: one new import line, and one new `if (want.has('sleep')) { try { await runSleepDurationSlice(...) } catch { console.error(...) } }` block, isolated so a failure in the new path can never break the legacy path.

## The exact end-to-end path now working

**Source → Ingestion → Normalization → Quality → Observation → Feature → Baseline → Change → Relationship/Pattern → Evidence → Finding → Ciatta Knowledge → Confidence/Safety → Experience/Silence**, for the `sleep` domain and the `nightly_sleep_minutes` Feature specifically. (Explanation, Task 10, is deliberately *not* part of this write-time chain — it's generated on read from a persisted Finding, per its own design; nothing in this orchestrator calls it, by design, not omission.)

Concretely, `buildSleepDurationPipelineResult()` — the pure, synchronous decision core — calls, in order: `computeNightlySleepMinutesFeatures` → `computeNightlySleepBaseline` → `evaluateChange` → `assembleSleepDurationEvidenceContent` → `produceSleepDurationFinding` → (`evaluatePattern` via two monthly relationship helpers, for energy and mood independently) → `assessSafety` → `selectForExperience`. `runSleepDurationSlice()` — the async, Supabase-aware wrapper — takes that result and writes to the new tables only, then evaluates and (if warranted) commits Ciatta Knowledge retention.

## How legacy-path isolation was verified

- The `index.ts` diff is exactly 14 inserted lines, 0 deletions, in two places: one import after the existing `moodAnalysis.ts` import, one try/catch block immediately after the existing domain-processor `Promise.all([...])`. The task reviewer read every changed line of `index.ts` individually and confirmed nothing else was touched — no reformatting, no other logic changed.
- The new call is `await`ed *inside* the `try`, so a rejected promise is caught, not left as an unhandled rejection; the `catch` body only logs and never rethrows, and the call's return value is discarded — nothing from the new path can reach `processUser()`'s return value or alter legacy processor behavior.
- Executable proof, not just code reading: a fix-round test (`runSleepDurationSlice: a failed write is never swallowed internally`) drives the orchestrator against a fake Supabase client configured to fail every write, and asserts the call throws — confirming `runSleepDurationSlice` itself never catches its own errors, which is the precondition `index.ts`'s isolation depends on.
- A second executable test (`runSleepDurationSlice: writes only to the permitted Stage 1 tables, never a legacy table`) enumerates every table the function touches against a fake client and asserts the set is exactly `{features, baselines, change_events, finding_evidence, findings, ciatta_knowledge}` and never `{understandings, understanding_history, evidence, relationships, discoveries}`.
- Both the task reviewer and the controller independently enumerated every `.from(...)` call in the source and cross-checked column names against the actual migration schema — same result.

## Tests and results

- TDD followed throughout (RED before implementation for the original 5-test file; the fix round added 2 more, run and confirmed passing).
- Full engine suite, before this task: 172/172. After the original implementation: 177/177 (+5). After the fix round: **179/179** (+2 more).
- Controller independently re-ran the full suite after the fix round with the same result, and independently confirmed `index.ts` has zero diff between the original implementation commit and the fix-round commit.

## End-to-end integration test results

`sleepDurationSlice.test.ts` now has 7 tests: two exercising `buildSleepDurationPipelineResult`'s outcomes end to end (too-few-nights → `no_finding`; enough nights but no meaningful change → `no_surfacing`, with the actual statement wording asserted, not just the outcome enum), three exercising `checkAlternativeExplanation` in isolation, and two exercising `runSleepDurationSlice`'s write-path and failure-isolation guarantees against a fake Supabase client (described above).

## Scientific / architectural decisions

None newly *made* by this task — but the review surfaced a real gap the controller is explicitly **not** deciding unilaterally: Pattern is genuinely evaluated in this orchestrator (`hasSupportedRelationship` reflects a real `evaluatePattern()` call), but its result is currently discarded — no `patterns` row is written, and `finding_evidence.pattern_id`/`.relationship_id` stay null. Whether and how to persist Pattern results is flagged as an open scope question for you to decide, not resolved here.

## Deviations from specification/plan — the significant one this round

**Pre-flight (before dispatch):** caught and fixed two real defects in the plan's own Step 3 code before any implementer saw it — a tautological `checkAlternativeExplanation` (compared a filtered array's length to itself, always true; fixed to require ≥2 independently confirming windows, a strictly more conservative bar than before) and an unused `explainSleepDurationFinding` import (removed, with the architectural reason documented).

**Post-implementation review (the significant one):** the task reviewer (dispatched on the most capable available model given this is the only task touching live legacy code) found **1 Critical defect inherited verbatim from the plan's own Step 3**, missed during pre-flight: the Ciatta Knowledge retention-priors query read from `ciatta_knowledge` — but `ciatta_knowledge` is only ever written *later in the same function*, gated on the very retention decision that query is supposed to inform. This is a genuine bootstrap deadlock: no row can exist to read until the gate has already passed once, which it can never do without reading a qualifying row that doesn't exist yet. **The entire Ciatta Knowledge stage was permanently unreachable as originally written** — Task 12's retention logic was correct in isolation (verified by its own tests) but could never actually fire in the integrated pipeline.

Fixed by sourcing `priorRuns` from the `findings` table instead (written unconditionally on every qualifying run), queried *before* the current run's own `findings` insert so it only ever sees genuinely prior rows. Hand-traced by both the controller and the re-reviewer: a first-ever run correctly does not retain (only 1 reproduced run), but its `findings` row becomes visible to the *next* run's priors query, which then correctly retains on the second qualifying run — the deadlock is genuinely broken, not relocated to somewhere else.

Also fixed: the header comment's factual overclaim about writing to `patterns` (corrected, with the Pattern-persistence question flagged as open rather than silently dropped), and the missing executable coverage for the additive-only/failure-isolation guarantees (added, described above).

## Parked concerns (full list, all controller-adjudicated with rulings — see the SDD ledger for complete reasoning on each)

**Carried forward unchanged from earlier tasks, none touched here:** `patterns` table's unique-constraint NULL semantics (Task 2); `patternEvaluation.ts` test-3's imprecise name (Task 6); `findingEvidence.ts`'s `qualityFlags` aliasing (Task 7); `safety.ts`'s substring-match prohibited-language check and untested `recovery`/`energy` map entries (Task 9).

**New from Task 13, deliberately not fixed in this round:**
- The alternative-explanation check, though no longer tautological, is still strictly subsumed by `evaluatePattern`'s own stricter recurrence gate and can never independently change the outcome. This is the exact tradeoff already reasoned through during pre-flight — a deliberate choice not to invent new statistical rigor without your sign-off, independently reached again by the reviewer from scratch. **Flagging for your decision**: is the current minimal, structurally-conservative check acceptable for this MVP slice, or do you want real rigor (e.g. a check that holds even when the single strongest confirming month is excluded, weighted by rating-delta magnitude) built as a follow-up?
- No idempotency: five of the seven new tables have no unique constraint, so every qualifying engine invocation (including the continuous mode) would append a full new row set describing the same night. Real, but this code isn't deployed/exposed yet — flagged as a must-resolve item before any real deployment, not before this checkpoint.
- Non-atomic five-table write with no compensation on partial failure. Same reasoning — blast radius is fully contained to new, currently-unread tables.
- Pattern computed but discarded (described above under Scientific/architectural decisions).
- The new prior-findings query destructures only `data`, ignoring `error` — a failed read would silently be treated as "no prior runs" rather than surfacing. Confirmed this mirrors the exact same unchecked-error pattern the original (now-replaced) query already had; not a new pattern, just carried into the new query location.

## Next milestone

Task 14: dual-write parity and regression verification — the mandatory gate before this vertical slice's work is reported as fully done. Not yet started — awaiting approval to proceed.

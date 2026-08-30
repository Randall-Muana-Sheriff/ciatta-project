# Ciatta Build History — 2026-08-30 — Stage 1, Task 2: foundation migration

**Date:** August 30, 2026

**Milestone:** Semantic Refactor Stage 1 (vertical slice) — Task 2 of 15

**Status:** Complete, reviewed, approved by Jennifer Maxwell. Awaiting Task 3 checkpoint before continuing.

**Sync status:** Local-only — see Task 1's entry for the Notion access situation, unchanged as of this entry.

## What we did

Added one new, purely additive Postgres migration (`20260901000000_intelligence_foundation_sleep_slice.sql`) creating the seven new Stage 1 tables: `features`, `baselines`, `change_events`, `patterns`, `finding_evidence`, `findings`, `ciatta_knowledge`. Every table has RLS enabled with exactly one "read own" select policy, matching the existing pattern for `understandings`/`evidence`/`relationships` — all writes remain service-role only.

`finding_evidence` carries an explicit PROVISIONAL note, verbatim in the migration, stating it is an MVP shortcut ledger for this one slice and not the final Evidence Ledger architecture (Approval Checkpoint item 8 in the spec, still open) — per Jennifer's explicit instruction after Task 1's checkpoint.

No existing migration file was edited; no existing table was altered.

## Environment note

This environment has no Docker, so the plan's original verification step (`supabase db reset` against a live local Postgres) could not run. Verification was adjusted to static checks: migration ordering, a collision grep across all 24 pre-existing migration files, a manual cross-check of every foreign-key and enum-typed column against the real definitions in `20260808000000_init_schema.sql`, and a full manual read-through of the SQL. The task reviewer independently repeated these checks and found the migration byte-identical to the plan's SQL and consistent with the real schema. This is a documented deviation in *mechanism*, not in what was verified.

## Result

- Commit `82b0b82` on `feature/intelligence-refactor-stage-1-sleep-slice`.
- Verification: 7/7 tables present with every specified column; RLS + select-only policy on all 7; zero naming collisions against 24 existing migrations; FK/enum types cross-checked correct against the live schema definition.
- Task reviewer verdict: ✅ spec compliant, 0 Critical/Important findings, Task quality: Approved. 1 Minor finding deferred (see below).
- Zero deviations from the approved specification's content — one deviation in verification *method* only, forced by missing local infrastructure, documented above.

## Deferred minor finding

`patterns.unique(user_id, domain, to_domain, pattern_type)` treats a NULL `to_domain` as distinct under standard Postgres unique-constraint semantics, so multiple single-domain patterns for the same user/domain/pattern_type would not be deduplicated by this constraint alone. Not a defect for this slice (no cross-domain pattern exists yet to collide), but flagged for confirmation before Stage 2 widens `patterns` beyond the sleep-duration slice.

## Architectural decisions this task required

None new. The `finding_evidence`-as-provisional decision was already settled by Jennifer before this task began; this task only had to document it correctly, which the reviewer independently confirmed it did.

## Next milestone

Task 3: `feature.ts` — the first Feature-stage TypeScript module (nightly sleep duration), reusing `nightKey`/`isAsleepStage` exported in Task 1. Not yet started — awaiting approval to proceed.

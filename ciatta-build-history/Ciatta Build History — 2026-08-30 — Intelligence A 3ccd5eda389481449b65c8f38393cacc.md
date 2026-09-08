# Ciatta Build History — 2026-08-30 — Intelligence Architecture Audit

**Date:** August 30, 2026  

**Milestone:** Global Intelligence Architecture Audit  

**Status:** Audit complete; implementation not yet started

## What we did

Completed a read-only, repository-wide audit of the Ciatta mobile application's dependency on the legacy **Understanding** concept before beginning the architectural cleanup.

The audit searched the full repository and found that the dependency surface is contained in `ciatta-mobile-app`; `ciatta-web` and `ciatta-landing` contain no references. No code was changed during the audit. fileciteturn52file0L23-L27

## What the audit established

The legacy concept is deeply embedded across the intelligence pipeline, database, Edge Functions, client library, UI, tests, scheduling, and operational configuration. The core persisted objects are `understandings`, `understanding_history`, and `cross_domain_understandings`. fileciteturn52file0L41-L85

The intelligence engine itself contains a substantial dependency surface, including the orchestrator, contextual processing, cross-domain synthesis, decay, continuous intelligence, domain analyses, and related tests. Provider search and account deletion also depend directly on the legacy objects. fileciteturn52file0L87-L95

The UI contains dedicated Understanding surfaces and copy across Core, Today, onboarding, overlays, accessibility labels, and application state. fileciteturn52file0L98-L101

## New conceptual direction

We are removing **Understanding** completely as a Ciatta product or technical object. This is not a blind terminology replacement. The audit distinguishes obsolete architecture, safe identifier renames, user-facing language requiring substantive rewriting, historical migrations, and explanatory documentation. fileciteturn52file0L109-L183

The proposed vocabulary is:

**Observation → Evidence → Feature → Context → Baseline → Change → Relationship → Pattern → Ciatta Knowledge → Confidence/Safety → Explanation → Experience → Guidance**

The audit proposes **Ciatta Knowledge** as the standing, longitudinal knowledge object; **Finding** as the current plain-language articulation within that knowledge; **Change** as the historical state-change record; and **Pattern** as a synthesized cross-domain object. The distinction between Relationship and Pattern still requires an explicit product decision before implementation. fileciteturn52file0L188-L230

## Critical implementation constraints

- Existing migrations are immutable. All changes must be implemented through new forward migrations. fileciteturn52file0L236-L242
- The operational rename must account for Edge Function deployment, cron schedules, and secrets. fileciteturn52file0L241-L242
- Historical JSONB references using `context.understandingId` require a backfill or dual-read strategy. fileciteturn52file0L242-L243
- Provider search must be coordinated with the intelligence-engine/database rename. fileciteturn52file0L307-L308
- `TamponWearUnderstanding` is unrelated to the intelligence architecture and must be treated separately. fileciteturn52file0L309-L310
- `Pattern` requires an explicit semantic decision before implementation. fileciteturn52file0L311-L311

## Agreed next step

**Do not immediately perform a global find-and-replace.**

First resolve the remaining semantic decisions, then execute the refactor in controlled stages while preserving existing behavior and tests. The recommended sequence is: finalize naming decisions → additive database migration → intelligence-engine refactor → coordinated function/cron/provider-search deployment → client-library updates → UI and copy rewrite → test/config updates → final repository-wide audit. fileciteturn52file0L318-L330

## Source record

This history entry records the Claude Code audit supplied on August 30, 2026. The audit was explicitly read-only and reported no code changes. fileciteturn52file0L23-L27

**Next milestone:** Approve the semantic replacement architecture, then begin the controlled global refactor.
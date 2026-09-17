# Backend: Make the Current Frontend Real

Status: draft for review, 15 Sep 2026
Source: "Ciatta Backend Master Build Prompt" (user, 15 Sep 2026)
App: `ciatta-mobile-app` · Live project: Supabase `ciatta-app` (`pghlquiwqnknpveyssui`)

## 1. Goal

Put a persistent, per user, longitudinal backend under the current frontend so every screen reads real data, every stub does what it says, and the product loop (observe, connect, contextualise, try or watch, observe again, learn, consider, act or don't) is stored and carried forward. The frontend is the visual contract: no redesign, no navigation change. Data bindings change; screens don't.

Definition of done is the prompt's section 55, proved by the three end to end tests in section 11 below.

## 2. Decisions taken

| Decision | Choice | Consequence |
|---|---|---|
| Test database | Local Supabase stack (OrbStack or Docker Desktop) | Every migration and RLS test runs locally. The live project receives migrations only at the end of a slice, with the user's go ahead. |
| Accounts | Restore Apple and Google sign in from `9fe1b55` | One new screen before the tabs when there is no session. Built from existing `kit` and `chrome` components, Jost, current colors. |
| Live project cleanup | Clean up | Before the first push: mark the 28 old migration versions reverted in `supabase_migrations.schema_migrations`, delete the orphaned `understanding-engine` and `provider-search` functions. The data is already gone (commit `d422a01`). |
| Scope of this run | Spec, then Slice 1 | This spec covers all five slices. Only Slice 1 gets a plan and a build now. |
| Engine | One engine, shared | The pure TypeScript in `src/lib` (engine, cycleModel, cyclePatterns, cycleLens, fertility) moves to a shared folder imported by the app (demo mode) and by the Deno `intelligence` function (real mode). No second engine. |
| Recommendations | Built, as the prompt asks | Recorded here because Experience Map v0.7 rules out suggestions; the user's instruction supersedes it. User initiated actions are a separate object. |

## 3. Current state (audit summary)

- Frontend data comes from `src/data/sample.ts`, `src/data/daily.ts` (150 synthetic days), `src/data/cycleLog.ts` sample episodes, and one AsyncStorage key `ciatta.cycle.v1` (own episodes, watch flags, interventions, cycle profile) in `src/state/cycleStore.tsx`.
- No Supabase client, auth or HealthKit code in `src/`. Packages are installed; `.env` has the Supabase URL, anon key and Google client IDs; `app.json` has Apple sign in and the Google URL scheme.
- Stubs: `ProfileScreen.tsx` `notYet` for Connect a Source, Download Your Data, Delete Account and Data; Health Records documents `onPress={() => {}}`; Insight screen and Journey "Something changed" read hard-coded claims.
- Reusable from `9fe1b55`: `supabase.ts` client, `socialAuth.ts`, `googleAuthConfig.ts`, `sessionGuard.ts`, `healthKit*.ts`, `healthConnect.ts`, `observationIdentity.ts`, `supabase/functions/delete-account`. Old schema and old engine are not reused.

## 4. Modes: demo and real

`src/data/adapter.ts` is the only place screens get data from.

- **Demo mode**: chosen by "Look around first" on the sign in screen. Reads `sample.ts`, `daily.ts` and sample episodes exactly as today. Writes stay in memory. Nothing reaches Supabase.
- **Real mode**: a signed in session. Reads and writes Supabase only. No sample record is ever added around real data (the current `recordEpisodes` fallback applies in demo mode only).
- On first real sign in, episodes saved under `ciatta.cycle.v1` are imported once as her own records (`provenance = REPORTED`, `metadata.imported_from = 'device'`), then the key is renamed so it never imports twice.
- Real mode with no data shows the existing empty patterns (for example Evidence's "No patterns have appeared yet."), as text in existing components. Assumption: this is the smallest honest change; screens are not restyled.

## 5. Data model

Postgres, UUID keys, `created_at` and `updated_at` everywhere, RLS on every table: owner reads and writes where `user_id = auth.uid()`; intelligence tables are written only by the service role inside functions and are read only to the owner.

### 5.1 Identity and sources
- `profiles` (`id` = `auth.users.id`, `first_name`, `cycle_profile jsonb`, `last_visit_at`)
- `health_sources` (`kind`: apple_health, health_connect, lab, document, manual, user_report; `status`: requested, connected, active, refused, disconnected, error, unsupported; `last_synced_at`, `error`). Connect a Source runs the real HealthKit or Health Connect flow where available and records `unsupported` otherwise. Connectivity is never faked.

### 5.2 Her record (domain tables)
- `raw_inputs`: her words verbatim (typed or transcribed), `parse_status` (pending, parsed, failed), `parser` (ai, device).
- `episodes`: the existing `Episode` shape as columns (kinds, flow, pain location and sensation using the existing taxonomies, severity, day impact separate from intensity, trajectory, context, helped, stool type, bowel flags, flare as user reported). Every detail column is nullable; null means unknown and is never read as none. Views `cycle_events` and `pain_events` select over it.
- `medications`, `supplements` (name, dose if given, started_at, stopped_at, changes as rows).
- `journal_entries`.
- `documents` (Storage path, type, source, uploaded_at, `extraction_status`: pending, extracted, failed). Extraction is not faked; until built, documents stay pending.
- `results` (test_name, panel, value, unit, reference_low, reference_high, collected_at, provider, `document_id`).

### 5.2a Two founder decisions, 16 September 2026

Both were taken after the gap analysis against `Ciatta MVP — Technical Stack &
Architecture v0.1`, and both are recorded here rather than applied silently.

**Confidence keeps its scale.** `threads.confidence` and `insights.confidence` stay
as specified, with components, a scale, a percentage and a score.

This **supersedes a locked decision**. The Ciatta Decision Register (`01 · AUTHORITY`,
7 September 2026) locks Confidence as "carried by the claim register and by naming
what is missing. No scale, no percentage, no score." That lock is changeable only by
explicit revision, and this is that revision, made by the founder on 16 September 2026.

The Register's own change protocol says what still owes doing, and none of it is done
yet: name the canonical decision affected (done, here), update the authoritative source
rather than the screen (the Register itself, not this file), propagate downstream and
mark what is superseded in place, re-run the affected audit, and record the change and
its date. **Until the Register is updated, two documents disagree and this one is the
junior.** Carry that into any slice that builds threads.

What does not change, because it was never the same rule: absence is still never shown
as a value, and confidence in a finding is still not a substitute for saying what is
missing. A score may accompany a claim; it may not replace the naming of what is unknown.

**The standards layer is in the MVP.** OMOP CDM concepts and HL7 FHIR resources are
built as the architecture document specifies, and the MVP hypotheses are tested with
them rather than around them. Normalization sits where that document puts it, second in
the flow, directly after ingestion and before evidence extraction.

The consequence, stated plainly so it is not discovered later: every table already
written stores a bespoke vocabulary, so this is a retrofit across `observations`,
`daily_metrics`, `episodes`, `results` and `medications`, not a greenfield layer beneath
them. It also has prerequisites that are not engineering. LOINC requires registration,
RxNorm is open, SNOMED CT requires a licence (free in the United States through the UMLS
Metathesaurus, not free everywhere), and UMLS itself requires an account and a licence
agreement. **No slice can start against SNOMED or UMLS until those are held.**

### 5.3 Common language
`observations`: domain, metric, value numeric, value_text, unit, occurred_at, source_id, `provenance` (MEASURED, REPORTED, RECORDED, IMPORTED, DOCUMENT, DERIVED, INFERRED, RESEARCH), data_quality, `origin_table` and `origin_id` back to the domain row, and a unique `dedupe_key` (from the old `observationIdentity`). Domain rows write their observations in the same transaction. Sleep, activity, heart and temperature arrive from HealthKit as observations directly.

### 5.4 Intelligence
- `baselines` (metric, window, median, low, high, variability, n, `sufficient`, computed_at)
- `changes` (metric, from, to, window, deviation, quality)
- `temporal_links` (a, b, relation: same day, within 24h, 3d, 7d, before, after, recurring)
- `threads` (`key` unique per user, e.g. `cycle_length~sleep_hours`, so the same relationship updates rather than recreating; title, status: new, watching, recurring, contextualized, actionable, changed, resolved, continue; first and last observed, observation_count, `confidence jsonb` with its components, domains)
- `thread_evidence` (role: supports, context, contradicts, alternative_explanation, user_reported, research_context; points to an observation, domain row or research ref)
- `insights` (thread_id, title, `what_changed`, `connected`, `you_told`, `not_established`, `alternatives`, status, importance, confidence, valid_from, valid_to, dismissed_at, dismissal_reason)
- `research_refs` (title, publication, year, url, summary, domains). Worded as "Research has found", never as proof about her.

### 5.5 Loop
- `recommendations` (type: observe, log, reflect, try, review, prepare, explore, discuss, connect, continue, no_action_yet; grounded in an insight or thread; status and dismissal)
- `considerations` (basis, status: active, dismissed, completed, expired; reason: not_relevant, already_handled, dont_want_to, waiting, other)
- `actions` (title, intent, expected_outcome, started_at, target_end_at, ended_at, status, created_from_insight_id); before and after windows computed from `started_at`
- `outcomes` (action_id, `reported`: improved, unchanged, worse, insufficient_evidence, unknown; `measured` the same set, kept in a separate column)
- `learning_events` (thread_id, action_id, outcome_id, type, summary, evidence jsonb)
- `insight_views` (insight_id, first_seen_at, last_seen_at, viewed_count, status_when_last_seen), which Today uses to say new, updated, continuing, resolved or no meaningful change.

Indexes on `user_id`, `(user_id, occurred_at)`, `(user_id, domain, metric)`, `source_id`, `thread_id`, `status`.

## 6. Intelligence pipeline

New data → `jobs` row per user (insert trigger, deduplicated while pending) → `intelligence` edge function processes one user per run:

normalize → baselines → changes → temporal links → upsert threads by key → insight gate → recommendations → Today state.

- **Insight gate**: there is no list of gate questions in the design system, and an
  earlier version of this line claimed one ("the prompt's eleven questions"). That was
  a paraphrase error: what the Decision Register locks is **eleven product states**, not
  eleven questions, and the production gate it describes is a readiness checklist of
  seventeen conditions (Brand, Colour, Typography, States and so on), not a test applied
  to a finding. The correction is recorded here rather than silently replaced, because a
  plan was nearly written against the invented version.

  What actually governs, quoted from the Decision Register (`01 · AUTHORITY`), all three
  locked:
  - **The eleven product states**: loading, empty, disabled, success, error, partial data,
    missing data, no applicable interpretation, no relationship found, waiting for new
    evidence, offline. Five clauses each. **Four of them are not failures** — no applicable
    interpretation, no relationship found, waiting for new evidence, and missing data exist
    precisely to say what cannot be established.
  - **Absence**: "never shown as a value. No zeroes, no flat lines through gaps, no
    interpolation, no carried-forward value, no reference midpoint, no dash that could read
    as a measurement. An absence ages: it is reported as older, not smaller."
  - **Confidence**: "carried by the claim register and by naming what is missing. No scale,
    no percentage, no score."

  So the gate is not a questionnaire. A finding may be stated when the chain below can be
  completed from stored evidence; when it cannot, the pipeline writes nothing and the screen
  resolves to whichever of the four honest states applies. Saying nothing is the ordinary
  outcome, not a failure path.
- **The chain** (locked, and it is also the reading order): finding, relationship,
  interpretation, her context, evidence, source.
- **Cadence**: her own entries invoke the function immediately; HealthKit batches are queued; `pg_cron` runs a nightly reconciliation and a morning refresh.
- **Language**: a single wording module produces every sentence from structured fields ("followed", "occurred alongside", "does not establish that one caused the other"). No cause, diagnosis or "you have".
- **AI**: only in `parse-input` (Tell) and optional narrative, always over structured evidence, validated before any row is written, with the on device parser as the fallback. AI never invents severity, values, research or diagnosis.
- **Observability**: development logs for each pipeline stage, with ids and counts, never health content. An earlier version of this line said "the eleven events in the prompt", which was the same paraphrase error as the gate above: there is no list of eleven events in the design system, and the only eleven it locks are the product states. The stages to log are the ones this section already names: normalize, baselines, changes, temporal links, threads, insight, recommendations, Today state.

## 7. Frontend to backend map

| Screen | Today | Becomes |
|---|---|---|
| Today | `sample.today`, engine brief, `cycleTrend` | `get_today` RPC: selected insight, since last visit status, actions |
| Evidence, Insight | engine strings; `sample.insight` | `insights` with four parts, `thread_evidence` → observation → source |
| Cycle, Your Cycle, History, Log | episodes in AsyncStorage plus sample | `episodes`; `last_similar_event` RPC for "same as last time" |
| Journey | episodes plus a hard-coded lane | episodes, observations, thread changes |
| Sleep, Movement | `daily.ts` | observations |
| Symptoms, Medications, Journal, Health Records | `sample.ts` | their tables; documents in Storage |
| Profile | sample sources, `notYet` | `health_sources`, `export-data` and `delete-account` functions |
| Watch toggle, Try a walk | local flags | `threads.status`, `recommendations`, `actions` |

## 8. Export and delete

- Export reads every owned row as her, under RLS, with provenance and sources, as one JSON document shared through the native share sheet. Ruling (Slice 1 plan): this runs in the app rather than as an `export-data` function; RLS gives the same only-her-rows guarantee with one less server surface.
- `delete-account` deletes Storage objects, then the auth user; every table cascades from `auth.users`. One function, idempotent, reports failure honestly.

## 9. Slices

1. **Foundation**: local stack, cleanup of the live project, schema for 5.1 to 5.3, RLS, sign in screen and session, adapter with demo and real modes, device import, episodes and journal persisted, Profile sources from `health_sources`, export and delete.
2. **Baselines and change detection**, plus HealthKit ingestion (needs a native rebuild).
3. **Threads, insights, evidence trace**; hard-coded Insight and Journey claims removed.
4. **Recommendations, actions, outcomes, learning, Today then and now**.
5. **Appointment brief, documents in Storage, medications, supplements, results**.

Each slice has its own plan, is tested before the next starts, and ends with a push to the live project after the user says go.

## 10. Testing

- Pure engine and wording: `node:test` via `tsx`, as today.
- Database: SQL tests run against the local stack (`supabase test db`, pgTAP): RLS isolation (user A cannot read or write user B in every table), ownership, cascade delete, dedupe.
- Functions: Deno tests against the local stack.

## 11. End to end tests

1. **Learning loop** (prompt §48): cycles 29, 28, 27, 26; sleep baseline 7h18 then 6h12; reported stress and night waking → thread, insight, "watch next cycle" → new cycle, "same pattern again" → observation count rises → action "earlier bedtime" with intent → outcome improved → learning event → Today shows what changed since last time, not the same discovery.
2. **Low friction logging** (§49): "My pelvic pain was awful today and I had to take ibuprofen." → raw input kept, pain episode with pelvic location and no invented severity, ibuprofen as a medication action, visible to Journey and to intelligence; next time "Same as last time" or "Something changed".
3. **Nothing happened** (§50): no new insight, recommendation or notification; Today unchanged.

## 12. Out of scope

Diagnosis, causal claims, health scores, push notifications, document extraction (abstraction only), clinician surfaces.

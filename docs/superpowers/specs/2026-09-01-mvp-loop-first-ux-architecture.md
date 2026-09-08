# Ciatta MVP UX, from the intelligence architecture

**Date:** 2026-09-01  
**Status:** Design. Not implemented.  
**Governs:** Product experience for the first working MVP  
**Supersedes as experience law:** Stage 2 §2F mapping onto Today / Core / Journey; Ciatta MVP UX Architecture & User Flows v0.1 destinations; any IA derived from `understandings`, Discoveries, or current tabs

**Authoritative inputs**

- Ciatta Intelligence & Experience Model v0.1
- Ciatta Expert Council v0.2
- Ciatta Final Semantic Refactor Specification v1.0
- Stage 2 as intelligence contracts (gates, silence, relationship slice, pattern lifecycle), not as navigation
- Study value order: See Change, Notice Meaningful Patterns, Get Context, Take a Bounded Next Step, Observe Again

**Non inputs**

- Current screens, tab names, anatomy dashboard, guest gauntlet then blank home
- Table names, engine nouns, pattern lifecycle labels
- `Understanding` as a product or technical object

---

## 1. What the product is

Ciatta is one **Finding Composition**. It walks the primary experience loop as far as this person's evidence allows, then stops.

**Change → Pattern → Context → Action → Observe Again**

Quiet is a completed cycle. Silence is success.

The user never experiences the engine chain:

Source → Ingestion → Normalization → Quality → Observation → Feature → Context object → Baseline → Change object → Relationship → Pattern object → Evidence → Finding / Ciatta Knowledge → Confidence / Safety → Explanation → Experience

They experience the **result** of that chain, selected by Experience.

Model §13 questions map onto the loop, not onto tabs:

| Model question | Loop stage |
|---|---|
| What changed? | Change |
| What has happened over time? | Pattern, plus Over time as a modality |
| What connects? | Context (Relationship, when supported) |
| What does Ciatta know? | The composition of surfaced Findings and retained Knowledge |
| What does Ciatta not know? | Limits inside Context, and Building / Quiet |
| What should I do? | Action, only when Guidance is separately justified |

Onboarding is not a form that precedes the product. It is **cycle 1**: Observe → first Experience.

---

## 2. Finding Composition (atomic UI)

Always the same order. Never backfill a weaker insight when a stage is unsupported.

1. **Change**, or stop. If Observe has begun but comparison is not eligible: **Building**. If comparison is eligible and nothing meets Experience selection: **Quiet**.
2. **Pattern**, only if recurrence, temporal consistency, stability, and an alternative explanation check are supported. A Relationship is not a Pattern. Correlation is never a Pattern.
3. **Context.** Connection if a Relationship is supported. Then the Explanation model in user language: what Ciatta noticed, what evidence supports it, compared with what, what circumstances matter, how sure in plain words, what Ciatta does not know, what this does not mean.
4. **Action**, only if the existing Guidance gate allows (today: enumerated copy only at strong / very strong). Action means notice, gather, or a question for a clinician. Not diagnosis, not treatment.
5. **Observe Again.** Add a new observation, wait honestly, or return to Now.

Do not invent a sixth stage to fill the screen.

---

## 3. Destinations (jobs derived from the loop)

Persistent chrome is not inherited from Today / Core / You or from Stage 2 naming five surfaces.

| Destination | Job | Loop role | Chrome |
|---|---|---|---|
| **Now** | The loop at the current time | Front door after cycle 1. Change first. | Standing |
| **Picture** | Currently supported connections and retained knowledge | Context across the person. Same composition on open. | Standing |
| **Over time** | The loop across dates | Pattern and Change history as a time modality | From Now and from a composition. Not a peer tab. |
| **Add** | A new Observe | Observe Again | Composer on Now, Picture, and Context. Not a tab. |
| **Account** | Who the n of 1 is, sources, privacy, export, sign out | Governs Observe | Standing |

**Recommended chrome:** Now · Picture · Account.

Three standing jobs because the loop has a present (Change now), a connected picture (what is supported across this person), and a control surface (what Ciatta is allowed to observe). Over time is how Pattern is inspected. Add is how Observe happens again.

Picture is not a body diagram and not a metric wall. Empty regions stay empty. Unsupported domains do not get placeholder intelligence.

---

## 4. Cycle 1: onboarding as Observe → Experience

| Step | User job | Experience |
|---|---|---|
| Welcome | Why Ciatta exists | Promise in value order: see change, notice patterns, get context. No engine vocabulary. |
| Account | Make this person durable | Sign in or create account before health writes persist. Guest preview may exist. Evidence does not. |
| Why this information | Consent to Observe | Plain: Ciatta compares you with you, stays quiet when it cannot, never sells a diagnosis. |
| Observe | First observations | Conversation and structured questions. Each answer immediately updates a live Now preview (Building). |
| Optional sources | More Observe | After policy gate. Apple Health / Health Connect. Skip is valid. |
| Land | First Experience | Now in Building, Quiet, or Surfaced Change. Never an empty dashboard waiting to populate. |

Rules:

- Questions are Observe, not a quiz that unlocks the app.
- Connecting a source is still Observe.
- The live preview is Experience selection on whatever is already eligible. Usually Building.
- Do not force every source or every question before Now.
- Auth last in the current guest flow is inventory, not the new law. Durable identity belongs before persisted observations.

---

## 5. Daily use

**Now**

1. If a Change clears Experience: show it.
2. If a Pattern is supported on that Change or its Relationship: continue.
3. Context: connection, evidence, limits.
4. Action only if Guidance allows.
5. Observe Again: one honest next step, or nothing.

If nothing clears: Quiet Now. Show that Ciatta is watching this person, not a list of missing widgets.

**Picture**

Show only currently supported Relationships and retained Knowledge. Tap opens the same Finding Composition. Quiet regions stay blank.

**Over time**

A calendar or sequence of dates for one composition. Re enter past Change / Pattern / Context. Weakening is shown as the composition stopping earlier, not as an internal lifecycle name.

**Add**

Voice, text, or structured entry. Returns into Observe Again on Now. Acknowledge receipt. Do not claim Ciatta learned a clinical fact it cannot validate.

**Account**

Identity, connected sources, permissions, privacy, notifications, export, delete, sign out. Source changes feed Observe.

---

## 6. States (architecture, not empty screens)

| State | When | UI |
|---|---|---|
| Building | Observe begun, Baseline / Change not eligible | What was received. What would make comparison possible. No fake insight. |
| Quiet | Eligible data, nothing selected by Experience | Calm. Completed cycle. Optional Observe Again if useful. |
| Surfaced | Change (and later stages if earned) | Walk the composition. Stop at first unsupported stage. |
| Insufficient source | Permission lost or feed stopped | Impact on what can be shown now. Path to restore. |
| Weakened | Pattern or Knowledge no longer supported | Composition ends earlier. No “deactivated” label. |
| Just added | User completed Observe Again | Receipt, then recompose Now. |
| Safety sensitive | User text implies harm | Separate safety path. Never inferred from a health Pattern. |

Four silence forms, never collapsed:

- No finding
- No surfacing
- No notification
- No guidance

---

## 7. Explanation, without machinery

When anything is Surfaced, the user can reach Context that answers Model §12 in ordinary language:

1. What Ciatta noticed  
2. What evidence supports it  
3. What changed versus this person's reference  
4. What circumstances matter  
5. What connection or repeating structure is supported, if any  
6. How sure, in human words (reuse existing labels such as still learning / confident)  
7. What Ciatta does not know  
8. What this does not mean  

Never user facing as concepts: Evidence Ledger, Feature, Baseline, Change Event, Pattern lifecycle, gate names, orchestrator, table names, confidence scores as numbers, Safety as a score.

---

## 8. Copy and claims

- No diagnosis, causation, hormones, ovulation, PMS, PMDD, or treatment from a Relationship or Pattern.
- Association language only for the current Stage 2 test case (cycle associated with mood), and only when the Relationship test confirms.
- All on screen strings through `displayCopy()`. No dashes in copy.
- LLMs may draft language. They must not create evidence.

---

## 9. Implementation inventory (does not set IA)

Reuse live behavior. Project into the loop. Do not rename tables to clean the UI. Do not invent thresholds, crisis detection, or causal claims.

| Current | New job |
|---|---|
| `observations`, onboarding answers, HealthKit / Health Connect | Observe |
| Personal sleep comparison, baseline night/day minima | Change (when meaningful) |
| `relationships`, two independent signals test | Context connection |
| `cross_domain_understandings` | Relationship until real Pattern criteria exist. Do not label as Pattern in UI until they do. |
| `understandings` narrative / strength | Project to Finding / Knowledge. Not a product object. |
| `deriveGuidance` ACTIONABLE strong / very strong, enumerated only | Action |
| Engine silence, RLS, client write surface | Keep |
| `TodayScreen` | Candidate shell to rebuild as Now |
| `UnderstandingSheet` | Candidate overlay to rebuild as Finding Composition |
| `YouScreen` | Candidate for Account |
| `CoreScreen`, body silhouette, Discoveries / Unwritten | Do not determine Picture |
| Guest questions then auth last then Today / Core | Do not determine cycle 1 |
| Five equal tabs, Log, Journey as peer tabs | Discard as experience law |

First content case for testing the architecture: existing cycle associated with mood slice, plus personal sleep Change if eligible. Content is not the IA.

---

## 10. Validation (experience, not interface liking)

A person should be able to say, in their own words:

- What changed, compared with what, over what period  
- What repeated, if anything  
- What it connects to, if anything  
- What supports it  
- What it does not mean  
- When Ciatta has nothing reliable to say  

Research signals from Model §14 still apply: what they explore, trust, ignore, return to, teach Ciatta, and would miss.

---

## 11. Build order

1. This architecture (done as design)  
2. Low fidelity wireflow: cycle 1 → Now → Composition → Picture → Over time → Account, including Building / Quiet / Surfaced  
3. Interactive prototype with silence  
4. Clinical / Health Informatics review (meaning, time, overclaim, data vs interpretation, limits)  
5. Usability against study criteria  
6. Visual design  
7. Production UI (Stage 7 semantic cutover may land in the same window)  
8. Native validation  

Do not polish Today, Core, or UnderstandingSheet into this product.

---

## 12. Closed product decisions

1. Standing chrome: **Now + Picture + Account**. Picture is the standing “what connects / what is known” job from Model §13. It is not Core.  
2. Current time surface name: **Now**. Not Today as a calendar brand, even though the n of 1 frame is the current date.  
3. Onboarding: **first Observe → Experience cycle**, with live Now preview. Account before persisted health writes.

## 13. Remaining open

1. Exact visual of Picture (connected statements vs quiet map) after prototype.  
2. Whether Over time is a full screen modal or an inline mode on the composition.  
3. How much of cycle 1 can be skipped once a source already supplies enough for Building.

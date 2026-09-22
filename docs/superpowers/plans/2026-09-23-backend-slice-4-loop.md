# Backend Slice 4: Recommendations, Actions, Outcomes, Learning and Today Then and Now Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the second half of the loop the spec describes (observe, connect, contextualise, try or watch, observe again, learn, consider, act or don't). After Slice 3c an insight exists; this slice stores what she is offered about it (recommendations), what she chooses (watching, an action with an intent), what happened after (an outcome she reports and one the server measures), what was learned (learning events), and what Today should say when she comes back (new, updated, seen again, resolved, or no meaningful change) rather than repeating the same discovery.

**Architecture:** Two migrations add the loop tables from spec 5.5 and the RPCs the app calls. Recommendations and learning events are written only by the `intelligence` function, which gains three pure modules (recommend, outcomes, learning) that run after the insight step. Actions, outcomes (the reported half) and considerations are hers to write under owner RLS. Watching a thread changes `threads.status`, which the client may never touch, so it goes through a security definer RPC with its own revoke. `get_today()` is one read that composes the Today state under RLS; `record_visit()` moves `profiles.last_visit_at` afterwards. In the app the existing local store keeps its shape and, in real mode, is backed by these rows and RPCs, so Today does not change and the Insight screen's watch toggle is rebound in one place.

**Tech Stack:** as Slice 3c: Supabase Postgres 17, `pg_cron` and `pg_net`, Deno edge functions, pgTAP, `tsx --test` with `node:test`, Expo 57, React Native 0.86, `@supabase/supabase-js` 2.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md`, sections 5.5 (loop tables), 6 (pipeline order: insight gate, recommendations, Today state; the language rule), 7 (Today row: `get_today`, since last visit, actions; the Watch toggle and Try a walk row), 9 Slice 4, 11 tests 1 (second half) and 3.

**Prior slices this rests on:** Slice 3c (`threads`, `thread_evidence`, `insights`, the `intelligence` job and function, `realRepo.loadInsight()`), Slice 2 (`changes`, `daily_metrics`), Slice 1 (`profiles.last_visit_at`, `enable_owner_rls`, `enqueue_job`).

## Decisions taken before planning

| Decision | Choice | Why |
|---|---|---|
| What grounds a recommendation | An insight, a thread, or a change, exactly one | Spec 5.5 says insight or thread. The one `try` this slice offers, a short walk, is what the app engine already suggests from a sustained drop in steps, and that is a `changes` row, not a thread. Refusing to ground it would drop the only recommendation that leads to a measurable action. |
| What an action needs to be measured | `metric` and `wanted` columns beside the spec's title, intent and expected outcome | An outcome "measured" from nothing is a fabrication. An action names the measure it hopes to move and which way; when it names none, the measured outcome is `unknown`, never guessed. |
| Before and after windows | Three days before the start, three days from the start, exactly as `walkOutcomes` in `src/lib/engine.ts` | The app already shows "after your planned walks" from those windows. The server measures the same way, cross checked by test, so the two never disagree. |
| When an outcome is measured | Only once the after window has fully elapsed, and once | Measuring a half elapsed window reports a number as if it were the result. `insufficient_evidence` is the honest answer when either window holds fewer than two values. |
| Watching | `threads.status = 'watching'` through `set_thread_watch`, security definer, ownership checked inside | Slice 3c's binding constraint: the client never writes `threads` or `insights`. Turning watching off restores `recurring` or `new` from the count, not a status the function would not have written. |
| Her stance | `considerations` rows are owner writable and are also written by the RPCs that dismiss or accept | A dismissal with a reason is hers; it must survive the recommendation being expired or regenerated. |
| Today's then and now | Computed in `get_today()` from `insight_views` and `profiles.last_visit_at`, never stored as a label | Five states: new, updated, continuing (seen again), resolved, unchanged. A stored label would go stale the moment the function ran again. |
| Notifications | None | Spec 12: out of scope. Today saying what changed since last time is the whole of "then and now" here. |
| Screens | `TodayScreen` unchanged; `InsightScreen`'s watch toggle rebound from local state to the store | The local store already abstracts watching, interventions and accept; in real mode it is backed by rows and RPCs. One binding line in a screen is the smallest honest change. |
| Demo mode | Unchanged | The sample person's loop stays in memory as today. |
| Live project | Applied at Task 10 through the Supabase connector, as Slice 3c was on 22 September | The founder's go was given for 3c's push; this slice's push follows the same route once its acceptance script passes locally. |

## Global Constraints

The Slice 3c constraints apply unchanged (no inference as fact, no cause or diagnosis, unknown is never none or zero, absence is never a value, owner only access, service role key never in `src/` or logs, revoke then grant on every function, no dashes in copy, no product name, no redesign, new migration files only, `npm test` and `supabase test db` clean after every task, commits with no attribution trailers). Added here:

- A recommendation is an offer, never an instruction. Titles use the frames the wording module holds; "if it feels appropriate" travels with every `try`.
- A measured outcome is written with the evidence it was measured from, and never overwrites what she reported. The two columns are separate on purpose.
- Nothing in this slice writes `threads` or `insights` from the client. Every status change goes through the function or a security definer RPC.
- Migrations already applied to the live project are never edited; the live project holds everything through `20260922100200`.

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260923100000_loop.sql` | tables `recommendations`, `considerations`, `actions`, `outcomes`, `learning_events`, `insight_views`; RLS; grants; job triggers |
| `supabase/migrations/20260923100100_loop_rpcs.sql` | `get_today`, `record_visit`, `record_insight_view`, `set_thread_watch`, `start_action`, `end_action`, `report_outcome`, `dismiss_recommendation`, `accept_recommendation` |
| `supabase/tests/loop.test.sql`, `supabase/tests/loop_rpcs.test.sql` | pgTAP for Tasks 1 and 2 |
| `supabase/functions/intelligence/wording.ts` | gains the recommendation, learning and since frames |
| `supabase/functions/intelligence/recommend.ts` | pure: what to offer, grounded and keyed |
| `supabase/functions/intelligence/outcomes.ts` | pure: measure an action's before and after |
| `supabase/functions/intelligence/learning.ts` | pure: what was learned since the last run |
| `supabase/functions/intelligence/index.ts` | three new steps after insights: outcomes, learning, recommendations |
| `src/data/loopRows.ts`, `src/data/loopRows.test.ts` | projects `get_today` into the shapes the store and adapter read |
| `src/data/repo.ts`, `src/data/adapter.ts`, `src/state/session.tsx`, `src/state/cycleStore.tsx` | real mode reads and writes the loop |
| `src/screens/InsightScreen.tsx` | watch toggle bound to the store |
| `scripts/loop-part-two.ts` | acceptance: the second half of section 11 test 1, and test 3 |

---

### Task 1: The loop tables

**Files:** create `supabase/migrations/20260923100000_loop.sql`, `supabase/tests/loop.test.sql`.

**Produces:** enum `recommendation_type` (observe, log, reflect, try, review, prepare, explore, discuss, connect, continue, no_action_yet). Table `recommendations` (user_id, type, insight_id, thread_id, change_id with `recommendations_one_grounding` check, `key text` unique per user for idempotent upserts, title, body, status in active, accepted, dismissed, expired, dismissed_at, dismissal_reason); server written, owner select. Table `considerations` (basis_kind in insight, thread, recommendation; basis_id; status in active, dismissed, completed, expired; reason in not_relevant, already_handled, dont_want_to, waiting, other; note); owner RLS through `enable_owner_rls`. Table `actions` (title, kind, intent, expected_outcome, metric, wanted in higher, lower, started_on date, started_at, target_end_at, ended_at, status in planned, active, ended, abandoned, created_from_insight_id, created_from_recommendation_id; unique (user_id, kind, started_on)); owner RLS. Table `outcomes` (action_id unique per user, reported and measured over the same five values, reported_at, measured_at, measured_evidence jsonb); owner select, owner insert and update on the reported columns only (column grants), service role all. Table `learning_events` (thread_id, action_id, outcome_id, type in pattern_recurred, pattern_resolved, outcome_measured, outcome_reported, insight_updated, summary not null, evidence jsonb, occurred_at, `key` unique per user); server written, owner select. Table `insight_views` (insight_id unique per user, first_seen_at, last_seen_at, viewed_count, status_when_last_seen); owner RLS. Triggers on `actions` and `outcomes` enqueue an `intelligence` job for the owner, as `daily_metrics` enqueues baselines.

- [x] Tests: each table exists with RLS on; anon holds nothing; A cannot read B in any of the six; authenticated cannot insert into recommendations or learning_events; authenticated can insert an action and read it back; authenticated can insert an outcome with `reported` but an update to `measured` is refused (42501); a recommendation with two groundings is refused; inserting an action queues one intelligence job and a second insert queues no second; a learning event with an empty summary is refused.
- [x] Run, see them fail; implement; `supabase migration up`; pass; commit "Store what she is offered, what she chooses, and what happened after".

### Task 2: The loop RPCs

**Files:** create `supabase/migrations/20260923100100_loop_rpcs.sql`, `supabase/tests/loop_rpcs.test.sql`.

**Produces**, all `set search_path = ''`, revoke from public, anon, authenticated, then grant execute to authenticated:
- `record_visit()` security invoker: sets her `profiles.last_visit_at = now()` and returns the previous value.
- `record_insight_view(insight_id uuid)` security invoker: upserts her `insight_views` row, bumping `viewed_count` and stamping `status_when_last_seen` from the insight.
- `set_thread_watch(thread_id uuid, watching boolean)` security definer: refuses (P0002) unless the thread is hers; on, sets `status = 'watching'` and writes a consideration (basis thread, active); off, restores `recurring` when `observation_count >= 2` else `new`, and marks the consideration dismissed with reason `other`.
- `start_action(kind text, title text, intent text, metric text, wanted text, insight_id uuid, recommendation_id uuid)` security invoker: inserts the action (status active, `started_on = current_date`, `target_end_at = now() + 3 days`), returns its id; when a recommendation id is given, `accept_recommendation` is applied.
- `end_action(action_id uuid, status text)` security invoker: sets ended_at and status in ended, abandoned.
- `report_outcome(action_id uuid, reported text)` security invoker: upserts her outcome's reported half only.
- `dismiss_recommendation(id uuid, reason text)` and `accept_recommendation(id uuid)` security definer: ownership checked, status set, a consideration row written with the reason.
- `get_today()` security invoker returning jsonb: `last_visit_at`; the newest live insight with its thread status and count and a `since` of new, updated, continuing, resolved or unchanged computed against her `insight_views` row; active and accepted recommendations; actions started in the last 14 days with their outcome; learning events since her last visit, newest first, at most five.

- [x] Tests: revoke and grant on every function; `set_thread_watch` on B's thread as A raises; on then off round trips the status; `record_insight_view` twice gives `viewed_count` 2; `get_today` says `new` before a view, `unchanged` after a view with nothing changed, `continuing` after the insight's `updated_at` moves with status continuing, `updated` when status is updated, `resolved` for a resolved insight; `report_outcome` never touches `measured`; `start_action` twice on one day yields one walk; `record_visit` returns the previous stamp.
- [x] Run, fail, implement, pass; commit "Let her watch, try, report and come back, without ever writing the trace herself".

### Task 3: Words for offers, outcomes and what changed since last time

**Files:** modify `supabase/functions/intelligence/wording.ts`, `src/data/wording.test.ts`.

**Produces:** `recommendationText(type, ctx)` returning `{ title, body }` from fixed frames per type (observe: "Watch your next cycle" for a cycle thread, otherwise "Watch what happens next time"; try walk: "A short walk today" with the standing "only if it feels appropriate" body; reflect: "Describe what changed"; prepare: "Prepare for an appointment"; review: "View the evidence"; no_action_yet: "Nothing to do yet"); `learningText(event)` (pattern_recurred: "The same combination came back: seen N times now"; outcome_measured: "After <action>, <metric> ran <higher or lower>, about N% over the next three days" or the insufficient line; outcome_reported: "You said <action> left things <reported>"; insight_updated; pattern_resolved); `sinceText(state)` for the five states. Every string passes the forbidden list and `COPY_DASH`.

- [x] Tests first, then implement; commit "Say what is offered and what was learned in the same careful words".

### Task 4: What to offer

**Files:** create `supabase/functions/intelligence/recommend.ts`, `src/data/recommend.test.ts`.

**Produces:** `buildRecommendations(input): RecommendationCandidate[]` with `input = { today, insights (live), threads, changes, dailyMetrics (last 7 days: day, steps, energy), painEpisodes (last 2 days: severity), openActions (kind, started_on) }` and `RecommendationCandidate = { key, type, insightId?, threadId?, changeId?, title, body }`. Rules: for every live insight, `observe` keyed on its thread (unless the thread is `watching`, then `continue`), `reflect` and `review` keyed on the insight, `prepare` when the thread's count is at least three. One `try` (walk) when a `steps` change with direction lower was detected within three days, the last week's energy averages at most 2.8 or is unrecorded, no pain episode of severity eight or more in the last two days, and no walk action started today; keyed on the change. Deterministic order by key.

- [x] Tests: the seven rules above, each on and off; keys stable across runs; every title and body clean; an insight with `valid_to` set yields nothing.
- [x] Commit "Offer only what the record can ground".

### Task 5: Measuring what happened after

**Files:** create `supabase/functions/intelligence/outcomes.ts`, `src/data/outcomes.test.ts`.

**Produces:** `measureOutcome(action, days, today): MeasuredOutcome | null` where `days` is `{ day, steps, sleep_hours, resting_hr, hrv, active_minutes, energy }[]` oldest first. Null until `started_on + 3 <= today`. Windows as `walkOutcomes`: three days before the start, three from it. `measured`: `unknown` without a metric; `insufficient_evidence` when either window holds fewer than two values; `improved` when the after mean moves at least 10 percent in the wanted direction; `worse` when it moves at least 10 percent against; else `unchanged`. `evidence` carries both means, the counts, the ratio and, for kind walk, the energy delta when both windows have check ins.

- [x] Tests: each verdict; the not yet elapsed case; cross check: the engine's `walkOutcomes` and this agree on the steps ratio for one shared fixture.
- [x] Commit "Measure the three days after against the three before, and say when that is not enough".

### Task 6: What was learned

**Files:** create `supabase/functions/intelligence/learning.ts`, `src/data/learning.test.ts`.

**Produces:** `buildLearningEvents(input): LearningCandidate[]` from `{ threadsBefore (key to count), threadsAfter, insightsWritten (status), outcomesMeasured, outcomesReported (without an event yet) }`. Keys: `pattern_recurred:<thread>:<count>`, `insight_updated:<insight>`, `outcome_measured:<outcome>`, `outcome_reported:<outcome>:<value>`, `pattern_resolved:<thread>`. Summaries from `learningText`; evidence jsonb carries the numbers.

- [x] Tests: a count that rose yields one event and a second run yields none; a reported outcome yields one event per value; summaries clean.
- [x] Commit "Record what was learned, once".

### Task 7: The function closes the loop

**Files:** modify `supabase/functions/intelligence/index.ts`; `scripts/loop-part-one.ts` stays green.

After the insights loop: read her actions (last 30 days) with outcomes, and the `daily_metrics` rows their windows need; measure every action whose window has elapsed and whose `measured` is null, upsert `outcomes` (service role, measured columns only, never `reported`), end actions past `target_end_at`; build learning events from the prior thread counts already held in `prior`, upsert by key; build recommendations, upsert by key without touching an existing row's status, expire recommendations whose insight is no longer live or whose change is older than seven days. Log counts only: `intelligence outcomes measured n`, `learning events written n`, `recommendations upserted n, expired n`.

- [x] `npm run check:functions` (with Deno on PATH), `npm run test:loop` still PASS, commit "Close the loop: measure, learn, offer".

### Task 8: The app reads and writes the loop

**Files:** create `src/data/loopRows.ts`, `src/data/loopRows.test.ts`; modify `src/data/repo.ts`, `src/data/adapter.ts`, `src/state/session.tsx`, `src/state/cycleStore.tsx`, `src/screens/InsightScreen.tsx`.

- `Repo` gains `loadToday(): Promise<TodayLoop | null>`, `recordVisit()`, `recordInsightView(id)`, `setThreadWatch(threadId, on)`, `startAction(kind, title, intent, metric, wanted, insightId?, recommendationId?)`, `reportOutcome(actionId, reported)`, `dismissRecommendation(id, reason)`. Demo repo: `loadToday` returns null and the writes are no ops.
- `loopRows.ts`: `TodayLoop = { since, insight: { id, threadId, threadStatus, count } | null, recommendations, actions (with `date` as `started_on`), learning }`; `sinceCopy(since)` the five kicker lines; `interventionsFrom(actions)` the engine's `Intervention[]`.
- Session loads the loop beside the insight, once, same `ignore` pattern, then calls `recordVisit()` once per session after the first successful load.
- Adapter: `Data.loop`; in real mode with an insight, `today.kicker` is `sinceCopy(loop.since)`.
- Store: in real mode `watching.nextCycle` is `loop.insight.threadStatus === 'watching'`, `setWatching('nextCycle', on)` calls `setThreadWatch`, `interventions` come from `interventionsFrom(loop.actions)`, `accept('walk')` calls `startAction('walk', ...)` with metric steps and wanted higher, all with optimistic local state and a reload on success. Demo mode unchanged.
- `InsightScreen`: the watch toggle reads and writes the store instead of `useState`.

- [x] Tests: `loopRows` projection including null; the five since lines pass `displayCopy` unchanged; adapter kicker in real mode with and without a loop; `npm test` and `npx tsc --noEmit` clean.
- [x] Commit "Show her what changed since last time, and let her watch and try from the phone".

### Task 9: The learning loop, second half, end to end

**Files:** create `scripts/loop-part-two.ts`, `package.json` script `test:loop2`.

Runs part one's seed, then as her: `record_insight_view`, `set_thread_watch` on; seeds a new cycle (a period start 26 days on, a low sleep week before it, its change and its link), queues and posts: the thread's count is 3 and status `recurring`, the insight is `updated`, a `pattern_recurred` learning event exists, `get_today().since` reads `updated`; starts a walk action through `start_action` with steps seeded low before and higher after; queues and posts: the outcome is measured `improved` with evidence, an `outcome_measured` event exists, `get_today` lists the action with its outcome and the events; a final post with nothing new writes no new row anywhere (section 11 test 3). Prints PASS and deletes the seed user.

- [x] Commit "Prove the second half of the loop: watch, recur, try, measure, learn, then silence".

### Task 10: Live

Through the Supabase connector: apply the two migrations with their exact file versions, deploy `intelligence` with the three new modules, run one tick, confirm `scheduler_health`, record counts in the plan and the closing commit. Advisors re-run.

- [x] Commit "Close Slice 4 on the live project".

**Done 22 September, evening.** `20260923100000_loop` and `20260923100100_loop_rpcs` applied with their exact versions; `intelligence` version 2 deployed with the eight sources (`intelligence/*.ts` and `baselines/paging.ts`). Smoke test: one job queued for a live account with no health rows, one tick, function answer 200 `{"processed":true,"threads":0,"insights":0,"outcomes":0,"learning":0,"recommendations":0,"expired":0}`, job `done` after one attempt; `scheduler_health` configured for all three drains. The security advisor now warns that `set_thread_watch`, `accept_recommendation` and `dismiss_recommendation` are security definer functions signed in users can call: that is intentional and the reason they exist (the client may never write `threads` or `recommendations`; each checks the row is hers before touching one named column), so the warning stands and is not a defect. Two `claim failed PGRST303` lines in the function log (13:55 and 18:55 UTC) were transient token errors from the platform; each run answered 500 without claiming and the next tick retried. Worth a later look: both drains post ten requests every five minutes whether or not a job is pending, which is thousands of empty invocations a day; posting `least(batch, pending)` would end that.

Test counts at close: `npm test` 400, `supabase test db` 455, `npm run test:loop` and `npm run test:loop2` PASS, `npm run check:functions` clean.

## Self review

- Every table in spec 5.5 now exists: recommendations, considerations, actions, outcomes, learning_events, insight_views.
- Section 7's Today row is met by `get_today`; the Watch toggle and Try a walk row write `threads.status`, `recommendations` and `actions` as the map says.
- Section 11 test 1 runs to its end locally, and test 3 is the last step of the same script.
- No screen is redesigned; one toggle is rebound. No notification is sent. No number is shown for confidence.

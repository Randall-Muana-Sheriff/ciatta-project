# Apple Health repair, 27 September 2026

This is a record of a repair, written after the work, in the place the plans live so it is found beside them. It covers what was reported, what was actually wrong, what changed, what is live, and what is still open.

## What was reported

A tester on TestFlight build 13 (1.3.0) connected Apple Health and said it did not work: the app looked the same after connecting as before.

## What was actually wrong

The connection and the first read had worked. Ninety days of samples reached the live project. Five separate faults stood between that data and anything she could see.

| # | Fault | Where | Effect |
|---|---|---|---|
| 1 | The links step paired every reading with every other reading inside a week, and built a date for each comparison | `supabase/functions/baselines/links.ts` | On a real record the step cost more CPU than one request is given. The platform killed the worker (status 546) before it could report a failure, so the job stayed `running`, was reclaimed fifteen minutes later, and was killed again. Jobs were picked up hundreds of times. No baseline, change, link, thread or insight was ever written. |
| 2 | A killed worker cannot call `fail_baselines_job` | `claim_baselines_job`, `claim_intelligence_job` | Nothing ever retired a job the worker kept dying on. |
| 3 | A night with only "in bed" samples was written as `sleep_hours = 0` | `src/lib/healthSamples.ts` | A phone with no watch records where she was, not whether she slept. Those nights read as nights of no sleep, and every average over her nights was wrong. The same fold added durations across sources, so a night held by the phone and the watch was counted twice in time in bed, and it put each sample on the calendar day it ended, which split every night that began before midnight. |
| 4 | Her days were loaded once, at sign in, and Apple Health was read once, on connecting | `src/state/session.tsx`, `src/screens/ProfileScreen.tsx` | After a successful read the screens showed nothing new until the app was closed and opened again, and her record then stopped on the day she connected. |
| 5 | The Sleep screen read `sleep`, which real mode left null | `src/data/adapter.ts` | "Nothing here yet", whatever her record held. |

## What changed

| File | Change |
|---|---|
| `supabase/functions/baselines/links.ts`, `index.ts` | Every link now has an event in it. A continuous device reading (`provenance = MEASURED`) never anchors a scan, and two of them are never paired. The day of each observation is worked out once. The affordability rule counts events times readings. |
| `supabase/migrations/20260927100000_claims_give_up.sql` | Before claiming, a stale job already picked up five times is closed as failed with the reason Abandoned. |
| `supabase/functions/intelligence/threads.ts` | One occurrence per event, however many readings sit beside it. An event beside a measure counts only when a sustained change in that measure was detected within seven days. The times the measure had moved the other way are kept as `contradicts` evidence. |
| `src/lib/healthSamples.ts` | A night is kept as the stretches its samples covered and merged before it is measured. It belongs to the day she woke on, and the day turns over at 18:00. `sleep_hours` is written only when an asleep sample exists. |
| `supabase/functions/ingest-health/batch.ts` | `sleep_hours` of zero is dropped, because build 13 still sends it. A null is carried through and clears the column. |
| `supabase/migrations/20260927100100_sleep_zero_is_unknown.sql` | Clears the zeros already stored and adds the check `sleep_hours is null or sleep_hours > 0`. |
| `src/lib/healthSync.ts` | A read covers whole days: it starts at 18:00 on the evening before its first day, and writes a row only for days from the first through today. A new mode, `refresh`, reads the last seven days. When a read returned any sleep at all, the days in its window it found no night for are written with their sleep fields null; when it returned none, nothing is cleared, because access taken away looks the same. |
| `src/lib/healthRefresh.ts`, `src/state/healthRefresh.ts` | On opening and on coming back to the front: if she has connected Apple Health herself, read the last week, at most once an hour. A phone that last wrote days under an older fold reads the ninety days again, once. It never asks for access. A read made with no signal leaves nothing behind and is made again; one measure that never arrives does not bring the ninety days back on every open. |
| `src/lib/healthSync.ts` (`portFor`) | Every post first asks who is signed in, and refuses when it is no longer the account the read was started for, so what is left of a read never lands in the record of whoever signs in next. |
| `src/state/session.tsx`, `src/screens/ProfileScreen.tsx` | `reloadRecord()` reads her days and her insight again after any read that went through. |
| `src/data/sleepView.ts`, `src/screens/SleepScreen.tsx`, `src/ui/charts.tsx` | The Sleep screen is drawn from her own nights. A week with no night is a gap in the chart. Her typical is named only once twenty nights stand behind it, the same floor the server holds a baseline to. |

## What is live

Applied to the live project through the Supabase connector on 27 September:

- migrations `20260927100000_claims_give_up` and `20260927100100_sleep_zero_is_unknown`, recorded under their file versions
- `baselines` version 4, `intelligence` version 3, `ingest-health` version 4
- the jobs that had been looping were closed as failed with the reason WorkerLimit

After the deploy the first real record ran through whole: the baselines job finished on its first attempt in under two seconds, wrote its links, and the intelligence job that follows it finished on its first attempt.

iOS build 15 (1.3.0) was sent to TestFlight the same day. Build 14 was cancelled before it was submitted and never reached a tester.

Test counts at close: `npm test` 449, `supabase test db` 470, `npm run test:loop` and `npm run test:loop2` PASS, `npm run check:functions` clean.

## What a tester has to do

Update to build 15 and open the app. Nothing else. On its first open the app reads the last ninety days again, which rewrites every night under the corrected fold, and the screens load what was read.

## What this does not change

A record that has just begun has no usual yet. A baseline needs twenty days of a measure between 35 and 90 days back, and an insight needs a sustained change near something that recurred. Until her record holds that, Today says there is nothing to compare, and that is the truth of her record and not a fault.

## Still open

- **Summed quantities are summed from raw samples.** A phone and a watch that both counted the same walk are both added, so steps and exercise minutes can read high for someone who carries both. HealthKit removes that overlap itself when asked for statistics instead of samples. This needs a device to verify and was left alone.
- **Both drains post ten requests every five minutes whether or not a job is waiting.** Posting `least(batch, pending)` would end that.
- **Health Connect on Android** is deferred.
- **`npx expo lint` is not set up**, and running it rewrites `package.json` and the lockfile to install ESLint. Revert with `git checkout` and `npm ci` if it is run by accident.

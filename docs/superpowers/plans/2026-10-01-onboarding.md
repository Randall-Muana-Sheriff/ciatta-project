# Onboarding: First Steps After Sign In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A short first run after sign in. Today a new account lands on Today reading "Nothing to compare yet", and the one thing that would give her record something to work with, connecting Apple Health, is under Profile → Settings where nobody is sent. The first tester did not find it, and the app read as broken. Five screens, every one skippable, say what the record is, connect the source, take her cycle situations and her name, and say what to expect over the next weeks. Completion is stamped on her profile so a reinstall does not repeat it, and the whole thing can be opened again from Profile.

**Architecture:** One migration adds `profiles.onboarded_at`, owner updatable like `first_name`. The session loads it beside her name and the Gate in `App.tsx` shows `OnboardingScreen` instead of `Root` while it is null in real mode. The Apple Health step runs exactly the flow Profile runs, which is lifted out of `ProfileScreen` into a hook both use; the cycle step is the body of the Your Cycle screen, lifted into a form both render. The order of steps and what each needs is a pure rule in `src/lib/onboarding.ts`, tested under node:test. Nothing new is asked that no part of the app reads.

**Tech Stack:** as the slices before it: Supabase Postgres 17, pgTAP, `tsx --test` with `node:test`, Expo 57, React Native 0.86, `@supabase/supabase-js` 2.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md` section 7 (Today), and the master spec's language rules (no cause, no diagnosis, unknown is never zero). The spec has no onboarding section; this plan records the decisions it would have held.

**What this replaces:** the first app's twelve step flow (`src/screens/onboarding/` at `9fe1b55`): welcome, a question bank conversation, understanding, reflection, mental health, documents, records, wearables, calendar, notifications, policies, account. It wrote into a model that is retired, and "Understanding" is a product object the spec bans.

## Decisions taken before planning

| Decision | Choice | Why |
|---|---|---|
| Length | Five screens, each with a way past it | The record needs weeks of data before it can say anything; a long interview on day one is a promise the app cannot keep. Every screen can be skipped and the whole run can be opened again later. |
| Intent and concern questions | Left out | They were the best part of the first flow, but nothing in the current schema or engine reads the answers. Storing them would be data taken for no use. A later slice that defines the use can add them. |
| Where completion lives | `profiles.onboarded_at`, server side | A reinstall or a second phone must not repeat it. Owner updatable, like `first_name`, through the existing "owner update" policy. |
| A project without the column | The app shows no onboarding | The build reaches phones pointed at a project that may not have the migration yet. A read that fails for a missing column is treated as "nothing to show"; her record is never blocked behind a column. |
| Apple Health step | The same flow as Profile, through one hook | One connect flow, not two. On Android one honest line that device data comes later, no button. |
| Cycle step | The Your Cycle form, lifted out of its screen | Same situations, same save, same `setupDone`. Skipping leaves the profile as it was. |
| Name step | Confirm, prefilled | Apple and Google already gave it; she corrects it rather than types it. Writes `first_name` directly, as the sign in screen does. |
| Demo mode | Never shows onboarding | The example person has nothing to set up. |
| Where it can be opened again | Profile → Settings, "First steps" | A row, not a toggle; it does not clear `onboarded_at`, it opens the screens. |
| Copy | No dashes, no product name, `displayCopy()` on anything not written here | AGENTS.md. |
| Live project | The migration goes to the user's own project now; Jenny's live project when access to it returns | This machine can no longer reach the live project; the app tolerates the missing column until it is applied there. |

## Global Constraints

The slice constraints apply unchanged (no inference as fact, unknown is never none or zero, owner only access, no dashes in copy, no product name, no redesign of existing screens, new migration files only, `npm test` and `supabase test db` clean after every task, commits with no attribution trailers). Added here:

- Onboarding never asks for a permission on its own: the Apple Health prompt appears only when she taps the button.
- Nothing she skips is stored as a refusal; skipping leaves her record exactly as it was.
- No screen in the run is a dead end: each has a primary action and a way past it.

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261001100000_onboarded.sql`, `supabase/tests/onboarded.test.sql` | `profiles.onboarded_at`; owner can stamp her own, not another's |
| `src/lib/onboarding.ts`, `src/lib/onboarding.test.ts` | the steps in order for a platform, and whether a profile needs the run |
| `src/data/repo.ts`, `src/data/repo.test.ts` | `loadProfile()` (name and onboarded), `saveFirstName()`, `markOnboarded()` |
| `src/state/session.tsx` | `onboarded`, `finishOnboarding()`, `reopenOnboarding()`, `setFirstName()` |
| `src/state/connectAppleHealth.ts` | the connect flow as a hook, lifted from `ProfileScreen` |
| `src/ui/CycleProfileForm.tsx` | the Your Cycle form body, lifted from `CycleProfileScreen` |
| `src/screens/OnboardingScreen.tsx` | the five steps |
| `App.tsx`, `src/screens/ProfileScreen.tsx`, `src/screens/CycleProfileScreen.tsx` | the Gate, the "First steps" row, the screen that now renders the form |

---

### Task 1: Where completion lives

**Files:** create `supabase/migrations/20261001100000_onboarded.sql`, `supabase/tests/onboarded.test.sql`.

**Produces:** `alter table public.profiles add column onboarded_at timestamptz`. No new policy: "owner update" already covers it.

- [ ] Tests: column exists and is null for a new profile; A can stamp her own; A's update of B's row touches nothing; anon cannot read it.
- [ ] `supabase migration up`, pass, commit "Remember that she has been through the first steps".

### Task 2: The steps, as a rule

**Files:** create `src/lib/onboarding.ts`, `src/lib/onboarding.test.ts`.

**Produces:** `STEPS` in order (welcome, source, cycle, name, expect); `stepsFor({ platform })` drops nothing but marks the source step as `available` only on iOS; `needsOnboarding(mode, onboardedAt)` true only for real mode with a null stamp; `next(step)` and `isLast(step)`.

- [ ] Tests: order; iOS has the source step available and Android does not; demo and loading never need it; a stamped profile never does; a read that failed (undefined) never does.
- [ ] Commit "Name the first steps and when they are owed".

### Task 3: The record knows

**Files:** `src/data/repo.ts`, `src/data/repo.test.ts`, `src/state/session.tsx`.

**Produces:** `loadProfile(): Promise<{ firstName: string | null; onboardedAt: string | null | undefined }>` where `undefined` means the column could not be read; `saveFirstName(name)`; `markOnboarded()`. `firstName()` stays for its callers. The session holds `onboarded: boolean | null` (null while loading), `finishOnboarding()` (stamps, then flips), `reopenOnboarding()` (flips only), `setFirstName()`.

- [ ] Tests: a profile read with the column returns it; a read that fails for the column still returns the name with `onboardedAt` undefined; `markOnboarded` updates her row only; demo returns onboarded and writes nothing.
- [ ] Commit "Load whether she has been through the first steps".

### Task 4: One connect flow, one cycle form

**Files:** create `src/state/connectAppleHealth.ts`, `src/ui/CycleProfileForm.tsx`; `src/screens/ProfileScreen.tsx`, `src/screens/CycleProfileScreen.tsx`.

**Produces:** `useConnectAppleHealth()` returning `{ note, connecting, connect }` with the exact steps Profile runs today (availability, permission, recovery read, status, `recordRefresh`, `reloadRecord`). `CycleProfileForm({ draft, setDraft })` rendering the situations list and the detail fields. Both screens render the lifted pieces; no visible change.

- [ ] `npm test` and `tsc` clean; the Profile connect flow reads line for line as before.
- [ ] Commit "Lift the connect flow and the cycle form out of their screens".

### Task 5: The screens

**Files:** create `src/screens/OnboardingScreen.tsx`.

**Produces:** one screen with `StepProgress`, rendering the current step:
1. **Your own record.** What it keeps, what it shows, what it never does (no diagnosis, nothing left for cause). Continue; "Skip for now".
2. **Connect a source.** iOS: the connect button and the hook's note; Continue once active, "Not now" otherwise. Android: one line, Continue.
3. **Your cycle.** The form; Save and continue; "Skip for now".
4. **Your name.** A field prefilled from sign in; Continue saves when changed.
5. **What to expect.** Three short lines: what Today shows first and when, where to log, where the first steps live if she wants them again. Start.

Every "Skip" and "Start" calls `finishOnboarding()`.

- [ ] `tsc` clean; copy checked for dashes and the product name.
- [ ] Commit "Walk her through the first steps".

### Task 6: The gate, and the way back in

**Files:** `App.tsx`, `src/screens/ProfileScreen.tsx`.

**Produces:** the Gate renders `OnboardingScreen` inside `CycleStoreProvider` while `needsOnboarding` holds; Profile → Settings gains a "First steps" row that calls `reopenOnboarding()`.

- [ ] `npm test`, `tsc`, `expo export` for iOS clean.
- [ ] Commit "Show the first steps once, and keep them reachable".

### Task 7: Verification and ship

- [ ] `npm test`, `supabase test db`, `npm run check:functions`, both loop scripts.
- [ ] Migration applied to the user's own project with `supabase db push`.
- [ ] iOS build to TestFlight; Android APK rebuilt.
- [ ] Record counts and the build number here.

## Self review

- Every screen has a primary action and a way past it.
- Nothing is asked that nothing reads.
- The sign in screen, Today, and every detail screen are unchanged.
- A phone pointed at a project without the column sees the app it sees today.

# Onboarding Backend Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first session keep the promises its own screens make: record the consent it collects, store the symptoms it says Ciatta will watch for, and let a correction change one answer instead of restarting.

**Architecture:** Three small, independent additions to an onboarding flow that already ships. One new table (`consents`) because consent is a legal record with its own lifetime, not a profile field. One enum value (`condition_kind.symptom`) because the symptoms she reports are the same shape as the conditions she reports: a named thing, undated, that changes how a later finding reads. One pure function (`correctionTarget`) because "which step should this correction open" is a decision worth testing rather than a magic number in a handler.

**Tech Stack:** Postgres 17 with RLS and pgTAP, Supabase, TypeScript, React Native 0.86.3 on Expo 57, `tsx --test` with `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md` for the data model, provenance and RLS rules this must obey. The onboarding behaviour itself has no spec file: it was specified in chat as the Ciatta onboarding promise, and the clauses this plan implements are quoted verbatim in Global Constraints below so an executor needs no other document.

## Global Constraints

- **Never represent an inference as a measured fact.** Everything onboarding writes is her own report and carries `provenance = 'REPORTED'`.
- **Missing data is unknown.** Never zero, never "none", never a placeholder. An absence is reported as absent.
- **A user must only be able to access their own data.** Every new table carries RLS with an owner policy and explicit grants. Revoke then grant, never additive.
- **No em dash, en dash or hyphen in user facing copy**, and every remote or templated string passes through `displayCopy()` in `src/lib/displayCopy.ts`. Commit subjects and bodies follow the same rule; git trailers are exempt.
- **Read the versioned Expo docs** at `https://docs.expo.dev/versions/v57.0.0/` before writing any Expo specific code.
- From the Ciatta onboarding promise, the clauses this plan exists to satisfy:
  - *"Let her correct Ciatta. She can confirm, edit, skip, or say 'That's not quite right.' Corrections teach Ciatta about her, rather than forcing her to restart."*
  - *"Explain the value of each permission. Ask for access when relevant, explain what it enables, and allow her to decline without blocking onboarding."*
  - *"Capture her baseline and history. Preserve what she already knows, what she has experienced, what has changed, and when. Distinguish user-reported information from measured or imported data."*
- **Verification commands** (run from `ciatta-mobile-app/`): `npx tsc --noEmit`, `npm test`, `npx supabase db reset && npx supabase test db`. The local stack needs Docker; OrbStack's daemon has been down, so start it before Task 1.
- **Baseline to hold:** 416 app tests passing, `tsc` exit 0.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261010100000_consents.sql` | **Create.** The `consents` table, its enum, RLS and grants. |
| `supabase/migrations/20261010100100_symptom_kind.sql` | **Create.** Adds `symptom` to `condition_kind`. |
| `supabase/tests/consents.test.sql` | **Create.** pgTAP: shape, RLS, grants, isolation. |
| `supabase/tests/conditions.test.sql` | **Create.** pgTAP: `conditions` shape and the new enum value. |
| `src/lib/onboarding.ts` | **Modify.** Add `Consent`, `consentsFor`, `correctionTarget`. Pure. |
| `src/data/onboarding.test.ts` | **Modify.** Tests for the three additions. |
| `src/data/repo.ts` | **Modify.** `completeOnboarding` writes consents and symptoms. |
| `src/screens/OnboardingScreen.tsx` | **Modify.** Separate marketing consent; correction opens the right step. |

---

### Task 1: Consent becomes a record

Right now the sign up screen says *"By signing up, you agree to Ciatta's Terms of Use, to get emails and updates, and you acknowledge that you have read our Privacy Policy"* and **nothing is stored**. There is no record of what she agreed to, when, or to which version, and no way to honour a withdrawal.

It also bundles three consents into one tap. Under GDPR marketing consent must be separately given and separately withdrawable, so the screen gets its own control for it. This is not gold plating: three separate rows written from one bundled tap would be recording something that did not happen.

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261010100000_consents.sql`
- Create: `ciatta-mobile-app/supabase/tests/consents.test.sql`
- Modify: `ciatta-mobile-app/src/lib/onboarding.ts`
- Modify: `ciatta-mobile-app/src/data/onboarding.test.ts`
- Modify: `ciatta-mobile-app/src/data/repo.ts`
- Modify: `ciatta-mobile-app/src/screens/OnboardingScreen.tsx`

**Interfaces:**
- Consumes: `Answers` from `src/lib/onboarding.ts`; `completeOnboarding(a: Answers)` on `Repo`.
- Produces:
  - `export type ConsentKind = 'terms' | 'privacy' | 'marketing_email'`
  - `export type Consent = { kind: ConsentKind; granted: boolean; policyVersion: string }`
  - `export const POLICY_VERSION: string`
  - `export function consentsFor(a: Answers): Consent[]`
  - `Answers` gains `marketingEmail: boolean`

- [ ] **Step 1: Write the failing pgTAP test**

Create `ciatta-mobile-app/supabase/tests/consents.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_type('public', 'consent_kind', 'the consent kind enum exists');
select has_table('public', 'consents', 'consents exists');

select has_column('public', 'consents', 'granted', 'consents records whether it was given');
select has_column('public', 'consents', 'policy_version', 'consents records which wording she agreed to');
select has_column('public', 'consents', 'occurred_at', 'consents records when');

-- Withdrawal is a new row, never an edit, so the history survives.
select hasnt_column('public', 'consents', 'withdrawn',
  'withdrawal is a later row with granted false, not a flag that erases the original');

-- She owns these rows and may add to them. She may not rewrite history.
select ok(has_table_privilege('authenticated', 'public.consents', 'SELECT'),
  'authenticated can read her own consents');
select ok(has_table_privilege('authenticated', 'public.consents', 'INSERT'),
  'authenticated can record a consent');
select ok(not has_table_privilege('authenticated', 'public.consents', 'UPDATE'),
  'authenticated cannot alter a consent already given');
select ok(not has_table_privilege('authenticated', 'public.consents', 'DELETE'),
  'authenticated cannot delete a consent record');
select ok(not has_table_privilege('anon', 'public.consents', 'SELECT'),
  'anon cannot read consents');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.consents'::regclass),
  'consents has row level security enabled');

select ok(
  exists (select 1 from pg_policies
          where schemaname = 'public' and tablename = 'consents' and cmd = 'SELECT'),
  'consents has an owner select policy');

select ok(
  (select count(*) from pg_indexes
    where schemaname = 'public' and tablename = 'consents'
      and indexname = 'consents_user_kind') = 1,
  'consents is indexed by user and kind, which is how a current state is read');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: FAIL. `consents.test.sql` errors because `public.consents` does not exist.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20261010100000_consents.sql`:

```sql
-- What she agreed to, when, and to which wording.
--
-- A table rather than columns on profiles, because consent has a history and
-- a profile field has only a present. "Did she consent to marketing on the
-- day she signed up, and has she since withdrawn it" is a question a boolean
-- cannot answer, and it is the question that gets asked when someone
-- complains or an auditor arrives.
--
-- Append only by design: there is no update or delete grant below. A
-- withdrawal is a new row with granted false, so the original consent and
-- the moment it ended both survive. Letting her edit the old row would let
-- the record say she never agreed to something she did.
create type public.consent_kind as enum ('terms', 'privacy', 'marketing_email');

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.consent_kind not null,
  -- False is a real value here, not an absence. Declining marketing is
  -- something she did, and the record has to be able to show she was asked
  -- and said no, which is different from never having been asked.
  granted boolean not null,
  -- Which wording she saw. Terms change; a consent to the February text is
  -- not a consent to the August one, and without this the record cannot say
  -- which she agreed to.
  policy_version text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index consents_user_kind on public.consents (user_id, kind, occurred_at desc);

alter table public.consents enable row level security;
create policy "owner select" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owner insert" on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.consents from anon, authenticated;
grant select, insert on public.consents to authenticated;
grant all on public.consents to service_role;

comment on table public.consents is 'Append only. A withdrawal is a new row with granted false, never an edit, so the original consent and the moment it ended both survive.';
comment on column public.consents.granted is 'False is a real value: it records that she was asked and declined, which is different from never having been asked.';
```

- [ ] **Step 4: Run the pgTAP test and watch it pass**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS. All files green, 14 new assertions.

- [ ] **Step 5: Write the failing app test**

Add to `ciatta-mobile-app/src/data/onboarding.test.ts`:

```ts
test('consent is recorded per kind, so marketing can be withdrawn on its own', () => {
  const c = consentsFor(answers({ marketingEmail: true }));
  assert.equal(c.length, 3, 'terms, privacy and marketing are three records');
  assert.deepEqual(
    c.map((x) => x.kind).sort(),
    ['marketing_email', 'privacy', 'terms'],
  );
  for (const x of c) {
    assert.ok(x.policyVersion.trim().length > 0, `${x.kind} recorded with no policy version`);
  }
});

test('declining marketing is recorded as declined, not omitted', () => {
  const c = consentsFor(answers({ marketingEmail: false }));
  const marketing = c.find((x) => x.kind === 'marketing_email');
  assert.ok(marketing, 'declining marketing dropped the record entirely');
  assert.equal(marketing.granted, false, 'a decline must be stored as a decline');
  // Being asked and saying no is not the same as never being asked, and only
  // a stored false can tell those apart later.
});

test('signing up always grants terms and privacy, which are not optional', () => {
  for (const m of [true, false]) {
    const c = consentsFor(answers({ marketingEmail: m }));
    assert.equal(c.find((x) => x.kind === 'terms')?.granted, true);
    assert.equal(c.find((x) => x.kind === 'privacy')?.granted, true);
  }
});
```

Add `consentsFor` to the import block at the top of the file.

- [ ] **Step 6: Run it and watch it fail**

Run: `cd ciatta-mobile-app && npx tsx --test src/data/onboarding.test.ts`
Expected: FAIL with `consentsFor is not exported` or a TypeScript error.

- [ ] **Step 7: Implement the pure part**

In `ciatta-mobile-app/src/lib/onboarding.ts`, add `marketingEmail: boolean` to `Answers`, add `marketingEmail: false` to `emptyAnswers()`, and append:

```ts
export type ConsentKind = 'terms' | 'privacy' | 'marketing_email';

export type Consent = { kind: ConsentKind; granted: boolean; policyVersion: string };

// Bump this when the wording at ciatta.io/terms or ciatta.io/privacy changes.
// A consent to the old text is not a consent to the new one, and the stored
// version is what lets anyone tell which she actually saw.
export const POLICY_VERSION = '2026-10-09';

// Three records from one screen, because they have three different lifetimes.
// Terms and privacy are conditions of having an account at all. Marketing is
// hers to withdraw tomorrow without losing the account, and a record that
// cannot express that cannot honour it.
export function consentsFor(a: Answers): Consent[] {
  return [
    { kind: 'terms', granted: true, policyVersion: POLICY_VERSION },
    { kind: 'privacy', granted: true, policyVersion: POLICY_VERSION },
    // Stored either way. A decline is something she did, and the record must
    // tell "asked and said no" apart from "never asked".
    { kind: 'marketing_email', granted: a.marketingEmail, policyVersion: POLICY_VERSION },
  ];
}
```

- [ ] **Step 8: Run the app test and watch it pass**

Run: `cd ciatta-mobile-app && npx tsx --test src/data/onboarding.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 9: Write the consents in the repo**

In `ciatta-mobile-app/src/data/repo.ts`, inside `completeOnboarding`, immediately before the final `profiles` update, insert:

```ts
      // Before the profile write, so a failure here leaves onboarded_at null
      // and the session resumes rather than completing with no consent on
      // file. An account that exists with no consent record is the one state
      // this table exists to prevent.
      const consents = consentsFor(a);
      must(
        await db.from('consents').insert(
          consents.map((c) => ({
            user_id: userId,
            kind: c.kind,
            granted: c.granted,
            policy_version: c.policyVersion,
            occurred_at: now,
          })),
        ),
      );
```

Add `consentsFor` to the existing `onboarding` import at the top:

```ts
import { type Answers as OnboardingAnswers, consentsFor } from '../lib/onboarding';
```

- [ ] **Step 10: Separate the marketing consent in the UI**

In `ciatta-mobile-app/src/screens/OnboardingScreen.tsx`, replace the single terms paragraph on the `signup` pane with a paragraph plus its own control. Replace the whole `<Text style={[font('caption1'), s.terms]}>…</Text>` block with:

```tsx
            <Text style={[font('caption1'), s.terms]}>
              By continuing you agree to Ciatta&rsquo;s{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
                Terms of Use
              </Text>
              , and you acknowledge that you have read our{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                Privacy Policy
              </Text>
              .
            </Text>
            {/*
              Its own control, and off by default. Marketing consent has to be
              separately given to be worth anything, and a box already ticked
              is not something she gave. Saying no here does not block sign up.
            */}
            <Pressable
              onPress={() => set({ marketingEmail: !a.marketingEmail })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: a.marketingEmail }}
              accessibilityLabel="Send me emails and updates"
              style={({ pressed }) => [s.consentRow, pressed && s.pressed]}
            >
              <View style={[s.checkbox, a.marketingEmail && s.checkboxOn]}>
                {a.marketingEmail ? <Text style={[font('caption1'), { color: C.text }]}>✓</Text> : null}
              </View>
              <Text style={[font('caption1'), s.terms, { textAlign: 'left', flex: 1, marginTop: 0 }]}>
                Send me emails and updates. Optional, and you can stop them at any time.
              </Text>
            </Pressable>
```

Add to the stylesheet:

```tsx
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.tint, borderColor: C.tint },
```

- [ ] **Step 11: Verify everything**

Run: `cd ciatta-mobile-app && npx tsc --noEmit && npm test && npx supabase db reset && npx supabase test db`
Expected: `tsc` exit 0; 419 app tests passing; pgTAP all green.

- [ ] **Step 12: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20261010100000_consents.sql \
        ciatta-mobile-app/supabase/tests/consents.test.sql \
        ciatta-mobile-app/src/lib/onboarding.ts \
        ciatta-mobile-app/src/data/onboarding.test.ts \
        ciatta-mobile-app/src/data/repo.ts \
        ciatta-mobile-app/src/screens/OnboardingScreen.tsx
git commit -m "Record what she agreed to, and let her decline the part that is optional"
```

---

### Task 2: The symptoms she reports become something Ciatta can watch

The reflect screen tells her *"These become the things Ciatta watches for next time."* They do not. They land in `profiles.onboarding` as a json array, which no query reaches, so nothing can watch for them and the sentence is currently untrue.

They are not episodes: she gave no date and no severity, and writing an episode would invent an occurrence. They are the same shape as the conditions she reports, a named thing she says is true of her, undated, that changes how a later finding reads. So they join `conditions` under a third kind.

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261010100100_symptom_kind.sql`
- Create: `ciatta-mobile-app/supabase/tests/conditions.test.sql`
- Modify: `ciatta-mobile-app/src/data/repo.ts`

**Interfaces:**
- Consumes: `condition_kind` enum and `public.conditions` from `20261009100000_onboarding.sql`.
- Produces: `condition_kind` gains the value `symptom`. No TypeScript signature changes.

- [ ] **Step 1: Write the failing pgTAP test**

Create `ciatta-mobile-app/supabase/tests/conditions.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_table('public', 'conditions', 'conditions exists');
select has_type('public', 'condition_kind', 'the condition kind enum exists');

-- Three kinds: a diagnosis, an operation, and something she reports feeling.
select ok(
  'symptom' = any (enum_range(null::public.condition_kind)::text[]),
  'condition_kind includes symptom, so a reported symptom has somewhere to live');
select ok(
  'condition' = any (enum_range(null::public.condition_kind)::text[]),
  'condition_kind still includes condition');
select ok(
  'surgery' = any (enum_range(null::public.condition_kind)::text[]),
  'condition_kind still includes surgery');

-- Her own report, and she can correct it.
select ok(has_table_privilege('authenticated', 'public.conditions', 'SELECT'),
  'authenticated can read her conditions');
select ok(has_table_privilege('authenticated', 'public.conditions', 'INSERT'),
  'authenticated can add a condition');
select ok(has_table_privilege('authenticated', 'public.conditions', 'DELETE'),
  'authenticated can remove one she added by mistake');
select ok(not has_table_privilege('anon', 'public.conditions', 'SELECT'),
  'anon cannot read conditions');

-- Defaulting to active would assert a clinical fact she did not give.
select col_default_is('public', 'conditions', 'status', 'unknown',
  'status defaults to unknown, because listing something does not establish it is current');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: FAIL on the `symptom` assertion. The other nine pass, which confirms the test reaches a real table.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20261010100100_symptom_kind.sql`:

```sql
-- A symptom she reports at onboarding is not an episode.
--
-- An episode is something that happened, with a time and usually a severity.
-- At onboarding she is answering "what have you been noticing", which has
-- neither. Writing an episode would invent an occurrence and give the
-- intelligence layer a dated event that never happened.
--
-- What she is actually giving is the same shape as a condition: a named thing
-- she says is true of her, undated, that changes how a later finding should
-- be read. So it goes in the same table under its own kind, and the reflect
-- screen's promise that Ciatta will watch for these becomes something a query
-- can actually act on.
alter type public.condition_kind add value if not exists 'symptom';
```

**Note for the implementer:** `alter type ... add value` cannot run inside a transaction block in older Postgres. On Postgres 17, which this project uses, it can, and the Supabase CLI wraps migrations in one. If the apply errors with `ALTER TYPE ... ADD cannot run inside a transaction block`, split the value addition into its own migration file with no other statements, which is already the case here.

- [ ] **Step 4: Run the pgTAP test and watch it pass**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS, 10 assertions.

- [ ] **Step 5: Write the symptoms in the repo**

In `ciatta-mobile-app/src/data/repo.ts`, inside `completeOnboarding`, change the `named` array so symptoms are included. Replace:

```ts
      const named = [
        ...a.conditions.map((name) => ({ name, kind: 'condition' as const })),
        ...a.surgeries.map((name) => ({ name, kind: 'surgery' as const })),
      ].filter((r) => r.name.trim());
```

with:

```ts
      // Symptoms join conditions and surgeries here rather than becoming
      // episodes, because she gave no date and no severity and an episode
      // without those would be an occurrence nobody reported. status stays at
      // the column default of unknown for the same reason: that she named it
      // does not establish she has it today.
      const named = [
        ...a.conditions.map((name) => ({ name, kind: 'condition' as const })),
        ...a.surgeries.map((name) => ({ name, kind: 'surgery' as const })),
        ...a.symptoms.map((name) => ({ name, kind: 'symptom' as const })),
      ].filter((r) => r.name.trim());
```

- [ ] **Step 6: Verify**

Run: `cd ciatta-mobile-app && npx tsc --noEmit && npm test && npx supabase db reset && npx supabase test db`
Expected: `tsc` exit 0; 419 app tests passing; pgTAP green.

- [ ] **Step 7: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20261010100100_symptom_kind.sql \
        ciatta-mobile-app/supabase/tests/conditions.test.sql \
        ciatta-mobile-app/src/data/repo.ts
git commit -m "Let the symptoms she named be something a query can find"
```

---

### Task 3: A correction changes one answer, not all of them

The reflect screen offers *"That's not quite right, let me change something"* and then calls `setI(1)`, which drops her at the first question. The promise says corrections must not force her to restart, and being returned to question one after answering nine is close enough to a restart to feel like one.

**Files:**
- Modify: `ciatta-mobile-app/src/lib/onboarding.ts`
- Modify: `ciatta-mobile-app/src/data/onboarding.test.ts`
- Modify: `ciatta-mobile-app/src/screens/OnboardingScreen.tsx`

**Interfaces:**
- Consumes: `StepId`, `Answers`, `stepsFor` from `src/lib/onboarding.ts`.
- Produces: `export function correctionTarget(a: Answers, label: string): StepId`

- [ ] **Step 1: Write the failing test**

Add to `ciatta-mobile-app/src/data/onboarding.test.ts`:

```ts
test('a correction opens the step that holds that answer', () => {
  const a = answers({ conditions: ['Endometriosis'], medications: ['Levothyroxine'] });
  assert.equal(correctionTarget(a, 'Conditions'), 'conditions');
  assert.equal(correctionTarget(a, 'Medications'), 'medications');
  assert.equal(correctionTarget(a, 'Symptoms'), 'symptoms');
  assert.equal(correctionTarget(a, 'In your words'), 'tell');
  assert.equal(correctionTarget(a, 'What brought you here'), 'intent');
  assert.equal(correctionTarget(a, 'Age range'), 'about');
  assert.equal(correctionTarget(a, 'Life stage'), 'about');
});

test('a correction never sends her back to the start by default', () => {
  const a = answers({ opening: 'something' });
  // An unrecognised label is a bug in the caller, not a reason to restart her
  // session. It opens the last question she answered instead.
  const target = correctionTarget(a, 'Not A Real Label');
  assert.notEqual(target, 'welcome', 'an unknown correction label restarted onboarding');
  assert.ok(stepsFor(a).includes(target), 'correction target is not a step in her sequence');
});

test('a correction never opens a step she was never shown', () => {
  // Menopause removes the cycle step; a stale correction label for it must
  // not reintroduce a question the flow decided not to ask.
  const a = answers({ lifeStage: 'menopause' });
  const target = correctionTarget(a, 'Typical cycle');
  assert.ok(stepsFor(a).includes(target), 'correction opened a step not in her sequence');
});
```

Add `correctionTarget` to the import block.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd ciatta-mobile-app && npx tsx --test src/data/onboarding.test.ts`
Expected: FAIL with `correctionTarget is not exported`.

- [ ] **Step 3: Implement it**

Append to `ciatta-mobile-app/src/lib/onboarding.ts`:

```ts
// Which step a correction should open.
//
// The labels are the ones buildReflection puts on each known line, so tapping
// a line on the reflect screen can open the question that produced it. A
// correction is supposed to change one answer; returning her to question one
// after she answered nine is the restart the promise rules out.
const CORRECTION_STEPS: Record<string, StepId> = {
  'In your words': 'tell',
  'What brought you here': 'intent',
  'Age range': 'about',
  'Life stage': 'about',
  'Typical cycle': 'cycle',
  Conditions: 'conditions',
  Surgeries: 'conditions',
  Medications: 'medications',
  Supplements: 'medications',
  Symptoms: 'symptoms',
  'What you want': 'symptoms',
};

export function correctionTarget(a: Answers, label: string): StepId {
  const steps = stepsFor(a);
  const wanted = CORRECTION_STEPS[label];
  // A step she was never shown is not somewhere to send her: choosing
  // menopause removes the cycle question, and a stale label must not put it
  // back. Falling through to the last question she did see keeps her near
  // where she was rather than at the beginning.
  if (wanted && steps.includes(wanted)) return wanted;
  const answered = steps.filter((s) => s !== 'welcome' && s !== 'reflect');
  return answered[answered.length - 1] ?? 'tell';
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `cd ciatta-mobile-app && npx tsx --test src/data/onboarding.test.ts`
Expected: PASS, 22 tests.

- [ ] **Step 5: Make each known line tappable**

In `ciatta-mobile-app/src/screens/OnboardingScreen.tsx`, replace the known rows block on the `reflect` pane:

```tsx
                {reflection.known.map((k) => (
                  <View key={k.label} style={s.knownRow}>
                    <Text style={[font('caption1'), s.quiet]}>{k.label}</Text>
                    <Text style={[font('body'), { color: C.text }]}>{displayCopy(k.value)}</Text>
                  </View>
                ))}
```

with:

```tsx
                {reflection.known.map((k) => (
                  <Pressable
                    key={k.label}
                    onPress={() => setI(steps.indexOf(correctionTarget(a, k.label)))}
                    accessibilityRole="button"
                    accessibilityLabel={`Change ${k.label}`}
                    style={({ pressed }) => [s.knownRow, pressed && s.pressed]}
                  >
                    <Text style={[font('caption1'), s.quiet]}>{k.label}</Text>
                    <Text style={[font('body'), { color: C.text }]}>{displayCopy(k.value)}</Text>
                    <Text style={[font('caption2'), { color: C.tint }]}>Change</Text>
                  </Pressable>
                ))}
```

and replace the blanket correction control:

```tsx
              <TextButton label="That's not quite right, let me change something" onPress={() => setI(1)} />
```

with:

```tsx
              <TextButton label="Start the questions again" onPress={() => setI(1)} />
```

Add `correctionTarget` to the `../lib/onboarding` import.

- [ ] **Step 6: Verify**

Run: `cd ciatta-mobile-app && npx tsc --noEmit && npm test`
Expected: `tsc` exit 0; 422 app tests passing.

- [ ] **Step 7: Commit**

```bash
git add ciatta-mobile-app/src/lib/onboarding.ts \
        ciatta-mobile-app/src/data/onboarding.test.ts \
        ciatta-mobile-app/src/screens/OnboardingScreen.tsx
git commit -m "Let a correction change one answer instead of starting over"
```

---

### Task 4: Apply the three migrations to the live project

Controller task, after the user says go. Nothing in Tasks 1 to 3 reaches her phone until this runs, and `20261009100000_onboarding.sql` from the previous session is still unapplied, so onboarding is currently invisible: the Gate's `onboarded_at` read fails and falls through to Today.

- [ ] Record the live row counts first, so a later "did the apply lose anything" question has an answer:

```sql
select
  (select count(*) from auth.users) as users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.observations) as observations;
```

- [ ] Apply in filename order, each with `set lock_timeout = '3s';` in the session, off peak:
  1. `20261009100000_onboarding.sql`
  2. `20261010100000_consents.sql`
  3. `20261010100100_symptom_kind.sql`

  The guard is not ceremony. `20261009100000` alters `profiles`, which every signed in read touches, and the `access exclusive` lock it needs queues behind any open read and then blocks every reader behind itself. If an apply fails on the timeout, that is the guard working: run it again rather than raising the timeout.

- [ ] **Insert the version rows by hand and verify them.** On this project `apply_migration` applies the DDL and records no version row, which was caught last time only by checking: three migrations applied while `schema_migrations` still ended at the previous version, leaving the live schema ahead of its own history. Do not assume the tool recorded anything.

```sql
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261009100000', 'onboarding'),
  ('20261010100000', 'consents'),
  ('20261010100100', 'symptom_kind')
on conflict (version) do nothing;
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;
```

- [ ] Verify the grants live, each one named rather than eyeballed:

```sql
select
  has_table_privilege('anon','public.consents','select') as anon_reads_consents,
  has_table_privilege('authenticated','public.consents','insert') as she_can_consent,
  has_table_privilege('authenticated','public.consents','update') as she_can_rewrite_consent,
  has_table_privilege('authenticated','public.conditions','delete') as she_can_remove_a_condition,
  (select relrowsecurity from pg_class where oid='public.consents'::regclass) as consents_rls;
```

Expected: `anon_reads_consents` false, `she_can_consent` true, `she_can_rewrite_consent` **false**, `she_can_remove_a_condition` true, `consents_rls` true.

- [ ] Run `get_advisors` for security and rule on anything new before telling the user it is done.

- [ ] Create a throwaway account on the phone, walk the first session, and confirm: three rows in `consents` with the marketing one matching what was tapped, one row per symptom in `conditions` with `kind = 'symptom'`, `onboarded_at` set, and her opening sentence in `raw_inputs` with `input_mode` matching how she entered it. Then delete that account and confirm the cascade removed all of it.

---

## Self-Review

**1. Spec coverage.** The three promise clauses quoted in Global Constraints each map to a task: corrections to Task 3, permission explained and declinable to Task 1's separate marketing control, preserving what she knows and distinguishing reported from measured to Task 2 plus the `provenance = 'REPORTED'` already written. The backend design spec's RLS and grant rules are enforced by the pgTAP in Tasks 1 and 2 rather than asserted in prose.

**Gap, named rather than hidden:** the promise also says *"Bring in existing health information... health record imports, lab results, documents, and previous notes."* Only Apple Health is wired. Documents, labs and record imports are Slice 5 in the backend design and are deliberately not in this plan; this plan finishes what the shipped screens already claim.

**2. Placeholder scan.** No TBDs. Every code step carries the real SQL or TypeScript, every test step the real assertions, every expected failure stated with its message.

**3. Type consistency.** `ConsentKind` values match the `consent_kind` enum exactly (`terms`, `privacy`, `marketing_email`). `Consent.policyVersion` is camelCase in TypeScript and `policy_version` in the column, converted at the one place that writes it. `correctionTarget` returns `StepId`, the same union `stepsFor` returns and `step` is typed as. `Answers.marketingEmail` is added in Task 1 Step 7 and read in Task 1 Step 10 and nowhere earlier. The `symptom` enum value is added in Task 2 Step 3 before Task 2 Step 5 writes it.

**One ordering constraint for the executor:** Task 1 and Task 2 both modify `completeOnboarding` in `src/data/repo.ts`, in different places. Run them in order; if they are dispatched in parallel the second will conflict.

# Cycle Situations and Bowel Movement Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cycle tracking that adapts to each person's declared situations (Regular, Irregular, Endometriosis, PCOS / PMOS, Postpartum, Perimenopause, Hormonal contraception, No periods right now), plus bowel movements as their own log type.

**Architecture:** Cycles are built from logged Period episodes (`src/lib/cycleModel.ts`), not a fixed 27 day length. A `CycleProfile` (`src/lib/cycleProfile.ts`) holds the situations the person chose. `src/lib/cycleLens.ts` turns profile plus cycle windows into a `Lens`: the header, chart, extra log options and notes each screen shows. All three are pure TypeScript and unit tested in node. Screens read `lens` from `useCycleInsights()`.

**Tech Stack:** Expo 57, React Native, TypeScript (strict), react-native-svg, AsyncStorage. Tests: `node:test` + `node:assert/strict`, run through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-15-cycle-situations-design.md` (read the "Revisions during planning" section; it overrides earlier lines).

## Global Constraints

- All app code lives in `ciatta-mobile-app/`. Paths below are relative to it. Run commands from it.
- Keep Jost and the existing design. Reuse `Panel`, `ListGroup`, `ListRow` (`src/ui/chrome.tsx`), `DetailScreen`, `PrimaryButton`, `SecondaryButton`, `LinkButton`, `Tag`, `SecLabel` (`src/ui/kit.tsx`), `ChoiceChips`, `FieldLabel`, `StepHeader`, `Stepper` (`src/ui/cycleInputs.tsx`). Text styles only through `font()` from `src/theme.ts`.
- UI copy never contains an em dash, en dash or hyphen. Compound words become separate words.
- The app never names a diagnosis or cause; situations are "what you told us". No fertility or ovulation prediction is ever shown.
- Tap targets are at least 44 pt.
- Saved data key stays `ciatta.cycle.v1`; older saves must still load.
- Type check: `npx tsc --noEmit -p .` must print nothing. Tests: `npm test` must pass.
- **Commits:** the files this plan touches already hold uncommitted work (the Health rebuild and Phase 1 intelligence). Before Task 1, ask the user whether to commit that work first. Do not run any task's commit step until they have answered; if they say not to commit, skip every commit step.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `package.json` | modify | add `tsx` dev dependency and `test` script |
| `src/lib/cycleProfile.ts` | create | Situation list, `CycleProfile`, selection rules |
| `src/lib/cycleModel.ts` | create | period starts, cycle windows, regularity, phases, day bands |
| `src/data/cycleLog.ts` | modify | bowel options and fields, bleeding kinds, sample cycles, sample periods and bowel movements |
| `src/data/daily.ts` | modify | use `sampleCycleStarts` |
| `src/lib/cyclePatterns.ts` | modify | signals from new model, bowel observation, `painSplit`, bowel month counts |
| `src/lib/engine.ts` | modify | metadata for the `bowelPain` observation |
| `src/lib/cycleLens.ts` | create | `lensFor`, `safetyNotes` |
| `src/state/cycleStore.tsx` | modify | profile state and persistence, lens in `useCycleInsights` |
| `src/screens/CycleProfileScreen.tsx` | create | "Your Cycle" setup and edit screen |
| `src/navigation.ts`, `src/Root.tsx` | modify | register `cycleProfile` |
| `src/screens/ProfileScreen.tsx` | modify | "Your Cycle" row |
| `src/ui/lineCharts.tsx` | modify | `LengthDots`, `PostpartumTimeline`, `MonthsSince` |
| `src/screens/CycleScreen.tsx` | modify | situation header |
| `src/ui/stoolScale.tsx` | create | stool type picker |
| `src/screens/CycleLogScreen.tsx` | modify | lens options, bowel step, safety notes |
| `src/ui/HealthDashboard.tsx`, `src/screens/MyHealthScreen.tsx` | modify | cycle card from lens |
| `src/screens/CycleHistoryScreen.tsx` | modify | timing rows without a phase |
| `src/screens/JourneyScreen.tsx` | modify | bowel movement row in month detail |
| `src/lib/bodyMap.ts` | modify | bowel pain point |

---

### Task 1: Test tooling and the cycle profile

**Files:**
- Modify: `package.json`
- Create: `src/lib/cycleProfile.ts`
- Test: `src/lib/cycleProfile.test.ts`

**Interfaces:**
- Produces: `Situation`, `SITUATIONS`, `CONTRACEPTION`, `Contraception`, `CycleProfile`, `EMPTY_PROFILE`, `SAMPLE_PROFILE`, `toggleSituation(p, s): CycleProfile`, `has(p, s): boolean`.

- [ ] **Step 1: Add the test runner**

Run: `npm install --save-dev tsx@^4`
Then add to `scripts` in `package.json`:

```json
"test": "tsx --test \"src/**/*.test.ts\""
```

(`tsconfig.json` already excludes `**/*.test.ts`, so tests don't affect `tsc`.)

- [ ] **Step 2: Write the failing test** `src/lib/cycleProfile.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_PROFILE, SAMPLE_PROFILE, toggleSituation } from './cycleProfile';

test('situations combine freely', () => {
  const p = toggleSituation(toggleSituation(EMPTY_PROFILE, 'Endometriosis'), 'Perimenopause');
  assert.deepEqual(p.situations, ['Endometriosis', 'Perimenopause']);
});

test('regular and irregular exclude each other', () => {
  const p = toggleSituation(toggleSituation(EMPTY_PROFILE, 'Regular'), 'Irregular');
  assert.deepEqual(p.situations, ['Irregular']);
});

test('no periods right now clears regular and irregular', () => {
  const p = toggleSituation({ ...EMPTY_PROFILE, situations: ['Irregular', 'Endometriosis'] }, 'No periods right now');
  assert.deepEqual(p.situations, ['Endometriosis', 'No periods right now']);
});

test('picking regular clears no periods right now', () => {
  const p = toggleSituation({ ...EMPTY_PROFILE, situations: ['No periods right now'] }, 'Regular');
  assert.deepEqual(p.situations, ['Regular']);
});

test('tapping a selected situation removes it', () => {
  assert.deepEqual(toggleSituation(SAMPLE_PROFILE, 'Endometriosis').situations, ['Irregular']);
});

test('sample profile is endometriosis plus irregular', () => {
  assert.deepEqual(SAMPLE_PROFILE, { situations: ['Endometriosis', 'Irregular'], setupDone: true });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `./cycleProfile`.

- [ ] **Step 4: Implement** `src/lib/cycleProfile.ts`

```ts
// What the person told us about their cycle. These are their own words for
// their situation, never a diagnosis, and any combination is allowed.

export const SITUATIONS = [
  { id: 'Regular', sub: 'Your periods come at about the same time each month' },
  { id: 'Irregular', sub: 'Your cycle length changes a lot, or periods skip' },
  { id: 'Endometriosis', sub: 'You have endometriosis, or think you might' },
  { id: 'PCOS / PMOS', sub: 'Polycystic ovary syndrome, now also called PMOS' },
  { id: 'Postpartum', sub: 'You gave birth in the last year or so' },
  { id: 'Perimenopause', sub: 'Your cycle is changing in the years before menopause' },
  { id: 'Hormonal contraception', sub: 'Pill, hormonal IUD, implant, injection, ring or patch' },
  { id: 'No periods right now', sub: 'Your periods have stopped, for any reason' },
] as const;

export type Situation = (typeof SITUATIONS)[number]['id'];

export const CONTRACEPTION = ['Pill', 'Hormonal IUD', 'Implant', 'Injection', 'Ring or patch', 'Other'] as const;
export type Contraception = (typeof CONTRACEPTION)[number];

export type CycleProfile = {
  situations: Situation[];
  birthDate?: string; // ISO day, Postpartum
  breastfeeding?: boolean; // Postpartum
  lastPeriod?: string; // ISO day, Perimenopause, used when no period is logged
  contraception?: Contraception;
  setupDone: boolean;
};

export const EMPTY_PROFILE: CycleProfile = { situations: [], setupDone: false };
export const SAMPLE_PROFILE: CycleProfile = { situations: ['Endometriosis', 'Irregular'], setupDone: true };

// Choices that can't be true at the same time.
const EXCLUSIVE: Partial<Record<Situation, Situation[]>> = {
  Regular: ['Irregular', 'No periods right now'],
  Irregular: ['Regular', 'No periods right now'],
  'No periods right now': ['Regular', 'Irregular'],
};

export function toggleSituation(p: CycleProfile, s: Situation): CycleProfile {
  if (p.situations.includes(s)) return { ...p, situations: p.situations.filter((x) => x !== s) };
  const drop = EXCLUSIVE[s] ?? [];
  return { ...p, situations: [...p.situations.filter((x) => !drop.includes(x)), s] };
}

export const has = (p: CycleProfile, s: Situation) => p.situations.includes(s);
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: 6 tests pass.

- [ ] **Step 6: Commit** (only if the user agreed to commits)

```bash
git add package.json package-lock.json src/lib/cycleProfile.ts src/lib/cycleProfile.test.ts
git commit -m "Add the cycle profile and a node test runner"
```

---

### Task 2: Adaptive cycle model

**Files:**
- Create: `src/lib/cycleModel.ts`
- Test: `src/lib/cycleModel.test.ts`

**Interfaces:**
- Consumes: `CycleProfile`, `has` (Task 1); `addDays`, `daysBetween`, `parseDay`, `Episode` from `src/data/cycleLog.ts`.
- Produces:
  - `type Phase = 'Before period' | 'During period' | 'After period' | 'Between periods'`, `PHASES: Phase[]`
  - `type CycleWindow = { index: number; start: Date; end: Date | null; length: number | null }`
  - `type Regularity = 'predictable' | 'unpredictable'`
  - `periodStarts(episodes: Episode[]): Date[]`
  - `cycleWindows(starts: Date[]): CycleWindow[]`
  - `windowFor(date: Date, windows: CycleWindow[]): CycleWindow | null`
  - `completedLengths(windows): number[]`, `medianLength(windows): number | null`
  - `regularity(windows, profile): Regularity`
  - `phaseOf(date, w, predicted: number | null): Phase | null`
  - `BANDS`, `bandOf(days: number): { max: number; label: string; phrase: string }`

- [ ] **Step 1: Write the failing test** `src/lib/cycleModel.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, emptyForm, type Episode, formToEpisode, isoDay } from '../data/cycleLog';
import { bandOf, cycleWindows, medianLength, periodStarts, phaseOf, regularity } from './cycleModel';
import type { CycleProfile } from './cycleProfile';

const NOW = new Date(2026, 8, 15);
const day = (ago: number) => addDays(NOW, -ago);
const bleed = (kind: string, ago: number): Episode => formToEpisode({ ...emptyForm(), kinds: [kind], periodStart: ago }, false, NOW);
const profile = (p: Partial<CycleProfile>): CycleProfile => ({ situations: [], setupDone: true, ...p });
// Completed lengths oldest first; the current cycle started 5 days ago.
function windowsOf(lengths: number[]) {
  let ago = 5;
  const starts = [day(ago)];
  for (const l of [...lengths].reverse()) {
    ago += l;
    starts.unshift(day(ago));
  }
  return cycleWindows(starts);
}

test('periodStarts uses only period episodes', () => {
  const starts = periodStarts([bleed('Period', 40), bleed('Spotting', 20), bleed('Postpartum bleeding', 10), bleed('Period', 5)]);
  assert.deepEqual(starts.map(isoDay), [isoDay(day(40)), isoDay(day(5))]);
});

test('cycleWindows merges starts under 10 days apart and measures lengths', () => {
  const w = cycleWindows([day(70), day(40), day(36), day(5)]);
  assert.deepEqual(w.map((x) => x.length), [30, 35, null]);
  assert.equal(w[2].end, null);
});

test('medianLength takes the middle completed length', () => {
  assert.equal(medianLength(windowsOf([28, 30, 29])), 29);
  assert.equal(medianLength(cycleWindows([day(3)])), null);
});

test('three steady cycles are predictable', () => {
  assert.equal(regularity(windowsOf([28, 29, 30]), profile({ situations: ['Regular'] })), 'predictable');
});

test('a spread over 7 days is unpredictable', () => {
  assert.equal(regularity(windowsOf([26, 41, 30]), profile({ situations: ['Regular'] })), 'unpredictable');
});

test('fewer than 3 completed cycles is unpredictable', () => {
  assert.equal(regularity(windowsOf([28, 29]), profile({})), 'unpredictable');
});

test('some situations always mean unpredictable', () => {
  for (const s of ['Irregular', 'PCOS / PMOS', 'Perimenopause', 'No periods right now'] as const) {
    assert.equal(regularity(windowsOf([28, 28, 28]), profile({ situations: [s] })), 'unpredictable');
  }
});

test('postpartum stays unpredictable until 3 periods have returned', () => {
  const w = windowsOf([28, 28, 28]); // starts 89, 61, 33 and 5 days ago
  assert.equal(regularity(w, profile({ situations: ['Postpartum'], birthDate: isoDay(day(50)) })), 'unpredictable');
  assert.equal(regularity(w, profile({ situations: ['Postpartum'], birthDate: isoDay(day(70)) })), 'predictable');
});

test('completed cycles keep all four phases', () => {
  const [w] = cycleWindows([day(40), day(10)]);
  assert.equal(phaseOf(day(38), w, null), 'During period');
  assert.equal(phaseOf(day(34), w, null), 'After period');
  assert.equal(phaseOf(day(25), w, null), 'Between periods');
  assert.equal(phaseOf(day(12), w, null), 'Before period');
});

test('an open cycle without a prediction has no phase after the first week', () => {
  const [w] = cycleWindows([day(20)]);
  assert.equal(phaseOf(day(19), w, null), 'During period');
  assert.equal(phaseOf(day(0), w, null), null);
});

test('an open predictable cycle uses the predicted length', () => {
  const [w] = cycleWindows([day(26)]);
  assert.equal(phaseOf(day(0), w, 28), 'Before period');
});

test('bandOf groups days since a period', () => {
  assert.equal(bandOf(3).label, '0 to 7 days');
  assert.equal(bandOf(35).label, '22 to 35 days');
  assert.equal(bandOf(36).label, 'Over 35 days');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `./cycleModel`.

- [ ] **Step 3: Implement** `src/lib/cycleModel.ts`

```ts
import { addDays, daysBetween, type Episode, parseDay } from '../data/cycleLog';
import { type CycleProfile, has, type Situation } from './cycleProfile';

// Cycles come from the periods someone actually logged. A next period is only
// predicted when recent cycles are steady and nothing they told us makes
// timing unreliable. Completed cycles keep their phases, because the next
// start is already known; that is a fact, not a prediction.

export type Phase = 'Before period' | 'During period' | 'After period' | 'Between periods';
export const PHASES: Phase[] = ['Before period', 'During period', 'After period', 'Between periods'];

export type CycleWindow = { index: number; start: Date; end: Date | null; length: number | null };
export type Regularity = 'predictable' | 'unpredictable';

// Period starts closer together than this are the same period logged twice.
const MERGE_DAYS = 10;
const STEADY_SPREAD = 7;
const UNPREDICTABLE: Situation[] = ['Irregular', 'PCOS / PMOS', 'Perimenopause', 'No periods right now'];

// Only a logged Period starts a cycle. Spotting, postpartum bleeding and
// withdrawal or breakthrough bleeds never do.
export function periodStarts(episodes: Episode[]): Date[] {
  return episodes
    .filter((e) => e.kinds.includes('Period'))
    .map((e) => parseDay(e.periodStart ?? e.date))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function cycleWindows(starts: Date[]): CycleWindow[] {
  const kept: Date[] = [];
  for (const d of [...starts].sort((a, b) => a.getTime() - b.getTime())) {
    if (!kept.length || daysBetween(kept[kept.length - 1], d) >= MERGE_DAYS) kept.push(d);
  }
  return kept.map((start, index) => {
    const end = kept[index + 1] ?? null;
    return { index, start, end, length: end ? daysBetween(start, end) : null };
  });
}

export function windowFor(date: Date, windows: CycleWindow[]): CycleWindow | null {
  for (let i = windows.length - 1; i >= 0; i--) if (date >= windows[i].start) return windows[i];
  return null;
}

export const completedLengths = (windows: CycleWindow[]) =>
  windows.map((w) => w.length).filter((n): n is number => n != null);

export function medianLength(windows: CycleWindow[]): number | null {
  const xs = completedLengths(windows).slice(-6).sort((a, b) => a - b);
  return xs.length ? xs[Math.floor(xs.length / 2)] : null;
}

export function regularity(windows: CycleWindow[], profile: CycleProfile): Regularity {
  if (profile.situations.some((s) => UNPREDICTABLE.includes(s))) return 'unpredictable';
  if (has(profile, 'Postpartum')) {
    const birth = profile.birthDate ? parseDay(profile.birthDate) : null;
    const back = birth ? windows.filter((w) => w.start >= birth).length : 0;
    if (back < 3) return 'unpredictable';
  }
  const recent = completedLengths(windows).slice(-6);
  if (recent.length < 3) return 'unpredictable';
  return Math.max(...recent) - Math.min(...recent) <= STEADY_SPREAD ? 'predictable' : 'unpredictable';
}

// `predicted` is the expected length of an open cycle, or null when timing
// isn't predictable. Then an open cycle only has phases in its first week.
export function phaseOf(date: Date, w: CycleWindow, predicted: number | null): Phase | null {
  const since = daysBetween(w.start, date);
  if (since <= 4) return 'During period';
  const next = w.end ?? (predicted != null ? addDays(w.start, predicted) : null);
  if (next) {
    const until = daysBetween(date, next);
    if (until >= 1 && until <= 3) return 'Before period';
  }
  if (since <= 7) return 'After period';
  return next ? 'Between periods' : null;
}

// Where an event falls when there is no phase: days since a period started.
export const BANDS = [
  { max: 7, label: '0 to 7 days', phrase: 'in the first week after a period started' },
  { max: 21, label: '8 to 21 days', phrase: '8 to 21 days after a period started' },
  { max: 35, label: '22 to 35 days', phrase: '22 to 35 days after a period started' },
  { max: Infinity, label: 'Over 35 days', phrase: 'more than 35 days after a period started' },
] as const;

export const bandOf = (days: number) => BANDS.find((b) => days <= b.max)!;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests pass (Task 1 plus 12 new).

- [ ] **Step 5: Commit** (only if the user agreed to commits)

```bash
git add src/lib/cycleModel.ts src/lib/cycleModel.test.ts
git commit -m "Build cycles from logged periods"
```

---

### Task 3: Bowel movement and bleeding kinds in the record, sample cycles

**Files:**
- Modify: `src/data/cycleLog.ts`
- Modify: `src/data/daily.ts:1,63`
- Test: `src/data/cycleLog.test.ts`

**Interfaces:**
- Produces:
  - `WHAT_HAPPENED` now `['Period', 'Spotting', 'Pain', 'Symptoms', 'Bowel movement', 'Other']`
  - `BLEEDING_KINDS: readonly string[]` = Period, Spotting, Postpartum bleeding, Withdrawal bleed, Breakthrough bleeding
  - `STOOL_TYPES` (`{ type: 1..7; word: string }[]`), `BOWEL_PAIN`, `BOWEL_FLAGS`
  - `EpisodeForm` and `Episode` gain `stool: number | null`, `bowelPain: string | null`, `bowelFlags: string[]`
  - `normalizeEpisode(e: Episode): Episode`
  - `sampleCycleStarts(now?: Date): Date[]` (replaces `cycleStartDates`; `TYPICAL_LENGTH` is removed)

- [ ] **Step 1: Write the failing test** `src/data/cycleLog.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  daysBetween,
  emptyForm,
  type Episode,
  episodeTitle,
  formToEpisode,
  isoDay,
  normalizeEpisode,
  sampleCycleStarts,
  sampleEpisodes,
  summarize,
} from './cycleLog';
import { cycle } from './sample';

const NOW = new Date(2026, 8, 15);

test('sample cycles vary by more than a week', () => {
  const starts = sampleCycleStarts(NOW);
  const gaps = starts.slice(1).map((d, i) => daysBetween(starts[i], d));
  assert.deepEqual(gaps, [34, 26, 41, 30]);
  assert.equal(daysBetween(starts[starts.length - 1], NOW), cycle.day - 1);
});

test('sample record logs a period at each cycle start and three painful bowel movements', () => {
  const eps = sampleEpisodes(NOW);
  const periods = eps.filter((e) => e.kinds.includes('Period'));
  assert.deepEqual(periods.map((e) => e.periodStart), sampleCycleStarts(NOW).map(isoDay));
  assert.equal(eps.filter((e) => e.kinds.includes('Bowel movement') && e.bowelPain === 'During').length, 3);
});

test('a bowel movement is dated by its day and summarised', () => {
  const e = formToEpisode(
    { ...emptyForm(), kinds: ['Bowel movement'], day: 2, stool: 6, bowelPain: 'During', bowelFlags: ['Urgency'] },
    false,
    NOW,
  );
  assert.equal(e.date, isoDay(addDays(NOW, -2)));
  assert.equal(e.periodStart, null);
  assert.equal(episodeTitle(e), 'Bowel movement');
  const section = summarize(e, NOW).find((s) => s.label === 'Bowel movement');
  assert.deepEqual(section?.lines, ['Type 6, Mushy', 'Pain during', 'Urgency']);
});

test('other bleeding kinds record dates and keep their own names', () => {
  const e = formToEpisode({ ...emptyForm(), kinds: ['Withdrawal bleed'], periodStart: 3 }, false, NOW);
  assert.equal(e.periodStart, isoDay(addDays(NOW, -3)));
  assert.equal(episodeTitle(e), 'Withdrawal bleed');
  assert.ok(summarize(e, NOW).some((s) => s.label === 'Withdrawal bleed'));
});

test('older saved episodes gain empty bowel fields', () => {
  const { stool, bowelPain, bowelFlags, ...old } = formToEpisode(emptyForm(), false, NOW);
  assert.deepEqual(normalizeEpisode(old as Episode), { ...old, stool: null, bowelPain: null, bowelFlags: [] });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL, `sampleCycleStarts` / `normalizeEpisode` are not exported.

- [ ] **Step 3: Options.** In `src/data/cycleLog.ts` replace line 10 (`export const WHAT_HAPPENED = …`) with:

```ts
export const WHAT_HAPPENED = ['Period', 'Spotting', 'Pain', 'Symptoms', 'Bowel movement', 'Other'] as const;

// Every kind of bleeding someone can log. Only a Period starts a new cycle.
export const BLEEDING_KINDS: readonly string[] = [
  'Period', 'Spotting', 'Postpartum bleeding', 'Withdrawal bleed', 'Breakthrough bleeding',
];

// The seven stool types of the Bristol scale, in plain words.
export const STOOL_TYPES = [
  { type: 1, word: 'Hard lumps' },
  { type: 2, word: 'Lumpy' },
  { type: 3, word: 'Cracked' },
  { type: 4, word: 'Smooth' },
  { type: 5, word: 'Soft pieces' },
  { type: 6, word: 'Mushy' },
  { type: 7, word: 'Watery' },
] as const;
export const BOWEL_PAIN = ['None', 'During', 'After', 'During and after'] as const;
export const BOWEL_FLAGS = ['Blood', 'Urgency', 'Straining', 'Felt incomplete'] as const;
```

- [ ] **Step 4: Fields.** In `EpisodeForm`, after `helpedAmount: string | null;` add:

```ts
  stool: number | null;
  bowelPain: string | null;
  bowelFlags: string[];
```

In `emptyForm()` change the last line to:

```ts
    helpedAmount: null, note: '', stool: null, bowelPain: null, bowelFlags: [],
```

After `emptyForm` add:

```ts
// Episodes saved before bowel movements existed.
export const normalizeEpisode = (e: Episode): Episode => ({ stool: null, bowelPain: null, bowelFlags: [], ...e });
```

- [ ] **Step 5: Sample cycles.** Replace the whole `// ── Cycles ──` block (the `TYPICAL_LENGTH`, `PAST_LENGTHS` and `cycleStartDates` definitions) with:

```ts
// ── Cycles ─────────────────────────────────────────────────────

// Completed cycle lengths in the sample record, oldest first. They vary by
// more than a week, as they do for the sample profile.
const SAMPLE_LENGTHS = [34, 26, 41, 30];

// Start of each sample cycle, oldest first. The last one is the current cycle.
// Only sample data uses this; real cycles come from logged periods.
export function sampleCycleStarts(now = new Date()): Date[] {
  const starts = [addDays(startOfDay(now), -(cycle.day - 1))];
  for (const len of [...SAMPLE_LENGTHS].reverse()) starts.unshift(addDays(starts[0], -len));
  return starts;
}
```

- [ ] **Step 6: Saving and summarising.** In `formToEpisode` replace
`const bleeding = form.kinds.includes('Period') || form.kinds.includes('Spotting');` with:

```ts
  const bleeding = form.kinds.some((k) => BLEEDING_KINDS.includes(k));
```

Replace `episodeTitle` with:

```ts
export function episodeTitle(ep: Pick<Episode, 'kinds'>): string {
  if (ep.kinds.includes('Pain')) return 'Pain Episode';
  const bleed = BLEEDING_KINDS.find((k) => ep.kinds.includes(k));
  if (bleed) return bleed;
  if (ep.kinds.includes('Bowel movement')) return 'Bowel movement';
  if (ep.kinds.includes('Symptoms')) return 'Symptoms';
  return 'Cycle Experience';
}
```

In `summarize`, replace the bleeding section's label line
`label: ep.kinds.includes('Period') ? 'Period' : 'Spotting',` with:

```ts
      label: BLEEDING_KINDS.find((k) => ep.kinds.includes(k)) ?? 'Period',
```

and directly after that section's closing `},` add:

```ts
    {
      label: 'Bowel movement',
      lines: ep.kinds.includes('Bowel movement')
        ? [
            ...(ep.stool != null ? [`Type ${ep.stool}, ${STOOL_TYPES[ep.stool - 1].word}`] : []),
            ...(ep.bowelPain ? [ep.bowelPain === 'None' ? 'No pain' : `Pain ${ep.bowelPain.toLowerCase()}`] : []),
            ...(ep.bowelFlags ?? []),
          ]
        : [],
    },
```

- [ ] **Step 7: Sample record.** Replace the whole `sampleEpisodes` function with:

```ts
function blankEpisode(id: string, date: Date): Episode {
  const { day: _day, periodStart: _start, periodEnd: _end, flare: _flare, ...rest } = emptyForm();
  return {
    ...rest,
    id,
    loggedAt: date.toISOString(),
    date: isoDay(date),
    periodStart: null,
    periodEnd: null,
    flareUpUserReported: null,
    noteContext: [],
    similar: false,
  };
}

export function sampleEpisodes(now = new Date()): Episode[] {
  const starts = sampleCycleStarts(now);
  const today = startOfDay(now);

  // A logged period at the start of every sample cycle.
  const periods = starts.map((start, i) => {
    const end = addDays(start, 4);
    return {
      ...blankEpisode(`sample-period-${i}`, start),
      kinds: ['Period'],
      periodStart: isoDay(start),
      periodEnd: end <= today ? isoDay(end) : null,
      flow: i === starts.length - 1 ? 'Heavy' : 'Moderate',
    };
  });

  // Painful bowel movements during three recent periods.
  const bowel = [2, 3, 4].map((c, i) => ({
    ...blankEpisode(`sample-bowel-${i}`, addDays(starts[c], 1)),
    kinds: ['Bowel movement'],
    stool: 6,
    bowelPain: 'During',
    bowelFlags: ['Urgency'],
  }));

  const pain = SEEDS.map(
    ([c, d, start, end, severity, locations, sensations, affect, context, flare, helped, helpedAmount, dayImpact = [], trajectory = [], symptoms = []], i) => ({
      ...blankEpisode(`sample-${i}`, addDays(starts[c], d)),
      kinds: symptoms.length ? ['Pain', 'Symptoms'] : ['Pain'],
      start,
      end,
      locations,
      sensations,
      severity,
      affect,
      trajectory,
      dayImpact,
      symptoms,
      context,
      flareUpUserReported: flare,
      helped,
      helpedAmount,
    }),
  );

  return [...periods, ...bowel, ...pain];
}
```

- [ ] **Step 8: Daily sample.** In `src/data/daily.ts` change line 1 to import `sampleCycleStarts` instead of `cycleStartDates`, and line 63 to:

```ts
  const starts = sampleCycleStarts(now);
```

- [ ] **Step 9: Run the tests**

Run: `npm test`
Expected: all pass. (`npx tsc` still fails until Task 4 rewires `cyclePatterns.ts`; that is expected.)

- [ ] **Step 10: Commit** (only if the user agreed to commits)

```bash
git add src/data/cycleLog.ts src/data/cycleLog.test.ts src/data/daily.ts
git commit -m "Add bowel movements, bleeding kinds and irregular sample cycles"
```

---

### Task 4: Patterns on the new model

**Files:**
- Modify: `src/lib/cyclePatterns.ts`
- Modify: `src/lib/engine.ts:422-426`
- Test: `src/lib/cyclePatterns.test.ts`

**Interfaces:**
- Consumes: Task 2 model; Task 3 fields.
- Produces:
  - `signals(episodes, windows, predicted: number | null = null): Signal[]`
  - `Signal` gains `daysSincePeriod: number | null`, `bowel: boolean`, `bowelPain: boolean`
  - `Observation['id']` gains `'bowelPain'`
  - `painSplit(sigs, now?): { during: number; outside: number }`
  - `MonthSummary` gains `bowel: number`, `bowelPain: number`
  - re-exports `PHASES`, `Phase`, `CycleWindow` so existing imports keep working
  - `cycleWindows()` is no longer exported from here (it lives in `cycleModel.ts` with a new signature)

- [ ] **Step 1: Write the failing test** `src/lib/cyclePatterns.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, emptyForm, type EpisodeForm, formToEpisode } from '../data/cycleLog';
import { cycleWindows } from './cycleModel';
import { cycleSummaries, monthSummary, observations, painSplit, signals } from './cyclePatterns';

const NOW = new Date(2026, 8, 15);
const day = (ago: number) => addDays(NOW, -ago);
const episode = (form: Partial<EpisodeForm>) => formToEpisode({ ...emptyForm(), ...form }, false, NOW);
const windows = cycleWindows([day(60), day(30), day(5)]);

test('signals carry days since period and bowel pain', () => {
  const [s] = signals([episode({ kinds: ['Bowel movement'], day: 2, bowelPain: 'After' })], windows, null);
  assert.equal(s.daysSincePeriod, 3);
  assert.equal(s.bowel, true);
  assert.equal(s.bowelPain, true);
  assert.equal(s.phase, 'During period');
});

test('pain with bowel movements chosen as context counts as bowel pain', () => {
  const [s] = signals([episode({ kinds: ['Pain'], day: 1, context: ['Pain with bowel movements'] })], windows, null);
  assert.equal(s.bowelPain, true);
});

test('three painful bowel movements make an observation grouped by phase', () => {
  const eps = [2, 3, 32].map((d) => episode({ kinds: ['Bowel movement'], day: d, bowelPain: 'During' }));
  const sigs = signals(eps, windows, null);
  const found = observations(sigs, windows, cycleSummaries(sigs, windows), NOW).find((o) => o.id === 'bowelPain');
  assert.equal(found?.text, 'Pain with bowel movements showed up most during your period: 2 of the 3 times you logged it.');
});

test('without a phase, bowel pain is grouped by days since a period', () => {
  const open = cycleWindows([day(50)]);
  const eps = [10, 12, 15].map((d) => episode({ kinds: ['Bowel movement'], day: d, bowelPain: 'During' }));
  const sigs = signals(eps, open, null);
  const found = observations(sigs, open, cycleSummaries(sigs, open), NOW).find((o) => o.id === 'bowelPain');
  assert.equal(
    found?.text,
    'Pain with bowel movements showed up most more than 35 days after a period started: 2 of the 3 times you logged it.',
  );
});

test('painSplit counts pain days in and outside a period', () => {
  const eps = [3, 15, 16].map((d) => episode({ kinds: ['Pain'], day: d }));
  assert.deepEqual(painSplit(signals(eps, windows, null), NOW), { during: 1, outside: 2 });
});

test('monthSummary counts bowel movements and painful ones', () => {
  const eps = [
    episode({ kinds: ['Bowel movement'], day: 1, bowelPain: 'None' }),
    episode({ kinds: ['Bowel movement'], day: 2, bowelPain: 'During' }),
  ];
  const ms = monthSummary(signals(eps, windows, null), NOW.getFullYear(), NOW.getMonth());
  assert.equal(ms.bowel, 2);
  assert.equal(ms.bowelPain, 1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL (`painSplit` is not exported; `signals` has no `daysSincePeriod`).

- [ ] **Step 3: Replace the top of `src/lib/cyclePatterns.ts`** (lines 1–43: imports, `Phase`, `PHASES`, `CycleWindow`, `cycleWindows`, `windowFor`, `phaseOf`) with:

```ts
import { daysBetween, type Episode, type EpisodeForm, parseDay } from '../data/cycleLog';
import { bandOf, type CycleWindow, type Phase, phaseOf, windowFor } from './cycleModel';

export { type CycleWindow, type Phase, PHASES } from './cycleModel';

// The reading of the Cycle record. It describes what recurred; it never
// names a cause or a condition. A pattern is only surfaced once it has shown
// up in at least MIN_CYCLES separate cycles.

const MIN_CYCLES = 3;
const MIN_BOWEL = 3;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
```

- [ ] **Step 4: Signals.** Add to the `Signal` type after `phase: Phase | null;`:

```ts
  daysSincePeriod: number | null;
  bowel: boolean;
  bowelPain: boolean;
```

Replace the `signals` function signature and the object it builds:

```ts
export function signals(episodes: Episode[], windows: CycleWindow[], predicted: number | null = null): Signal[] {
  return episodes
    .map((episode) => {
      const date = parseDay(episode.date);
      const cycle = windowFor(date, windows);
      const said = [...episode.context, ...episode.noteContext];
      const bowel = episode.kinds.includes('Bowel movement');
      return {
        episode,
        date,
        cycle,
        phase: cycle ? phaseOf(date, cycle, predicted) : null,
        daysSincePeriod: cycle ? daysBetween(cycle.start, date) : null,
        hours: hoursOf(episode),
        pain: episode.kinds.includes('Pain'),
        bowel,
        bowelPain: (bowel && episode.bowelPain != null && episode.bowelPain !== 'None') || said.includes('Pain with bowel movements'),
        sleepDisrupted:
          said.includes('Poor sleep') ||
          episode.changes.includes('Could not sleep') ||
          episode.dayImpact.includes('Could not sleep') ||
          episode.affect.includes('Could not sleep') ||
          episode.symptoms.includes('Sleep disruption'),
        stress: said.includes('Stress'),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
```

- [ ] **Step 5: Bowel observation.** Change the `Observation` id to
`id: 'beforePeriod' | 'flareSleep' | 'duration' | 'bowelPain';`. Above `observations` add:

```ts
const PHASE_PHRASE: Record<Phase, string> = {
  'During period': 'during your period',
  'Before period': 'in the days before your period',
  'After period': 'in the days after your period',
  'Between periods': 'between periods',
};
```

Inside `observations`, just before `return out;` add:

```ts
  // Pain with bowel movements, by phase, or by days since a period when
  // there is no phase.
  const bowel = sigs.filter((s) => s.bowelPain);
  if (bowel.length >= MIN_BOWEL) {
    const where = (s: Signal) =>
      s.phase ? PHASE_PHRASE[s.phase] : s.daysSincePeriod != null ? bandOf(s.daysSincePeriod).phrase : 'with no period logged before it';
    const top = tally(bowel.map((s) => [where(s)]))[0];
    out.push({
      id: 'bowelPain',
      text: `Pain with bowel movements showed up most ${top.label}: ${top.count} of the ${bowel.length} times you logged it.`,
      brief: `Pain with bowel movements has come up most ${top.label}, ${top.count} of the ${bowel.length} times you logged it.`,
    });
  }
```

- [ ] **Step 6: painSplit and month counts.** After `observations` add:

```ts
// Pain days in the last 90 days, during a period and outside one.
export function painSplit(sigs: Signal[], now = new Date()): { during: number; outside: number } {
  const recent = sigs.filter((s) => s.pain && daysBetween(s.date, now) >= 0 && daysBetween(s.date, now) <= 90);
  const days = (xs: Signal[]) => new Set(xs.map((s) => s.episode.date)).size;
  return {
    during: days(recent.filter((s) => s.phase === 'During period')),
    outside: days(recent.filter((s) => s.phase !== 'During period')),
  };
}
```

Add `bowel: number; bowelPain: number;` to `MonthSummary`, and to the object `monthSummary` returns:

```ts
    bowel: mine.filter((s) => s.bowel).length,
    bowelPain: mine.filter((s) => s.bowel && s.bowelPain).length,
```

Remove the now unused `addDays`, `cycleStartDates` and `TYPICAL_LENGTH` imports if any remain.

- [ ] **Step 7: Engine metadata.** In `src/lib/engine.ts`, inside `cyclePatterns`' `meta` object, after the `duration` line add:

```ts
    bowelPain: { title: 'Pain with bowel movements', domains: ['Pain', 'Cycle'], recurrence: 3 },
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: all pass. `npx tsc --noEmit -p .` now only reports errors in `src/state/cycleStore.tsx` (old `cycleWindows()` call), which Task 6 fixes.

- [ ] **Step 9: Commit** (only if the user agreed to commits)

```bash
git add src/lib/cyclePatterns.ts src/lib/cyclePatterns.test.ts src/lib/engine.ts
git commit -m "Read patterns from logged cycles and add bowel pain"
```

---

### Task 5: Situation lens and safety notes

**Files:**
- Create: `src/lib/cycleLens.ts`
- Test: `src/lib/cycleLens.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces:

```ts
type LensHeader = { value: string; label: string };
type LensChart = 'none' | 'lengthDots' | 'postpartumTimeline' | 'monthsSince';
type Lens = {
  header: LensHeader;
  secondary: LensHeader | null;
  chart: LensChart;
  kinds: string[];      // "What happened" options
  symptoms: string[];   // Symptoms step options
  contexts: string[];   // "Around the time" options
  predicts: boolean;
  painSplit: boolean;   // show pain days in and outside a period
  empty: boolean;       // nothing to show a cycle from
  notes: string[];
  tags: string[];       // the situations, for the header
  lengths: number[];
  weeksSinceBirth: number | null;
  periodWeeks: number[];
  monthsSince: number | null;
};
lensFor(input: { profile: CycleProfile; windows: CycleWindow[]; regularity: Regularity; now?: Date }): Lens
safetyNotes(form: Pick<EpisodeForm, 'kinds' | 'flow' | 'bowelFlags'>, profile: CycleProfile): string[]
```

- [ ] **Step 1: Write the failing test** `src/lib/cycleLens.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, isoDay } from '../data/cycleLog';
import { lensFor, safetyNotes } from './cycleLens';
import { cycleWindows, regularity } from './cycleModel';
import type { CycleProfile } from './cycleProfile';

const NOW = new Date(2026, 8, 15);
const day = (ago: number) => addDays(NOW, -ago);
// Completed lengths oldest first; the current cycle started 11 days ago.
function windowsOf(lengths: number[]) {
  let ago = 11;
  const starts = [day(ago)];
  for (const l of [...lengths].reverse()) {
    ago += l;
    starts.unshift(day(ago));
  }
  return cycleWindows(starts);
}
function lens(profile: Partial<CycleProfile>, windows = windowsOf([34, 26, 41, 30])) {
  const p: CycleProfile = { situations: [], setupDone: true, ...profile };
  return lensFor({ profile: p, windows, regularity: regularity(windows, p), now: NOW });
}

test('irregular endometriosis: days since period, length dots, endometriosis pain questions', () => {
  const l = lens({ situations: ['Endometriosis', 'Irregular'] });
  assert.deepEqual(l.header, { value: 'Day 12', label: 'Since your last period' });
  assert.deepEqual(l.secondary, { value: '41 days', label: 'Longest gap' });
  assert.equal(l.chart, 'lengthDots');
  assert.equal(l.predicts, false);
  assert.equal(l.painSplit, true);
  assert.ok(l.contexts.includes('Pain with bowel movements'));
  assert.ok(l.kinds.includes('Bowel movement'));
});

test('regular steady cycles show the day and a likely next period', () => {
  const l = lens({ situations: ['Regular'] }, windowsOf([28, 29, 30]));
  assert.deepEqual(l.header, { value: 'Day 12', label: 'Current cycle' });
  assert.deepEqual(l.secondary, { value: '28 to 30 days', label: 'Recent range' });
  assert.equal(l.predicts, true);
  assert.match(l.notes[0], /next period may start around/);
});

test('postpartum shows weeks since birth and no predictions', () => {
  const l = lens({ situations: ['Postpartum'], birthDate: isoDay(day(98)), breastfeeding: true }, []);
  assert.deepEqual(l.header, { value: 'Week 14', label: 'Since birth' });
  assert.deepEqual(l.secondary, { value: 'None yet', label: 'Periods since birth' });
  assert.equal(l.chart, 'postpartumTimeline');
  assert.ok(l.kinds.includes('Postpartum bleeding'));
  assert.ok(l.symptoms.includes('Low mood'));
  assert.equal(l.empty, false);
});

test('perimenopause counts months since the last period', () => {
  const l = lens({ situations: ['Perimenopause'], lastPeriod: isoDay(day(95)) }, []);
  assert.deepEqual(l.header, { value: '3 months', label: 'Since your last period' });
  assert.equal(l.chart, 'monthsSince');
  assert.equal(l.monthsSince, 3);
  assert.ok(l.symptoms.includes('Hot flashes'));
});

test('hormonal contraception adds its bleed types and drops ovulation', () => {
  const l = lens({ situations: ['Hormonal contraception'], contraception: 'Pill' });
  assert.ok(l.kinds.includes('Withdrawal bleed'));
  assert.ok(l.kinds.includes('Breakthrough bleeding'));
  assert.ok(l.kinds.includes('Period'));
  assert.ok(!l.contexts.includes('Ovulation'));
  assert.ok(l.contexts.includes('Missed pill'));
});

test('no periods right now tracks symptoms by month', () => {
  assert.deepEqual(lens({ situations: ['No periods right now'] }).header, { value: 'No periods', label: 'Tracking symptoms by month' });
});

test('nothing logged and nothing set shows an empty state', () => {
  const l = lens({ setupDone: false }, []);
  assert.equal(l.empty, true);
  assert.equal(l.header.value, 'No period logged yet');
});

test('endometriosis during perimenopause merges both lenses', () => {
  const l = lens({ situations: ['Endometriosis', 'Perimenopause'], lastPeriod: isoDay(day(95)) }, []);
  assert.equal(l.header.label, 'Since your last period');
  assert.ok(l.contexts.includes('Pain during sex'));
  assert.ok(l.symptoms.includes('Night sweats'));
  assert.equal(l.painSplit, true);
});

test('options have no duplicates and Other stays last', () => {
  const l = lens({ situations: ['PCOS / PMOS', 'Perimenopause', 'Endometriosis'] });
  assert.equal(new Set(l.symptoms).size, l.symptoms.length);
  assert.equal(l.symptoms[l.symptoms.length - 1], 'Other');
  assert.equal(new Set(l.contexts).size, l.contexts.length);
});

test('safety notes appear only when triggered', () => {
  const none: CycleProfile = { situations: [], setupDone: true };
  assert.deepEqual(safetyNotes({ kinds: ['Period'], flow: 'Heavy', bowelFlags: [] }, none), []);
  assert.match(safetyNotes({ kinds: ['Period'], flow: 'Very heavy', bowelFlags: [] }, none)[0], /Soaking through/);
  assert.match(
    safetyNotes({ kinds: ['Postpartum bleeding'], flow: 'Heavy', bowelFlags: [] }, { ...none, situations: ['Postpartum'] })[0],
    /urgent care/,
  );
  assert.match(safetyNotes({ kinds: ['Bowel movement'], flow: null, bowelFlags: ['Blood'] }, none)[0], /Blood in your stool/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `./cycleLens`.

- [ ] **Step 3: Implement** `src/lib/cycleLens.ts`

```ts
import {
  addDays,
  BLEEDING_KINDS,
  CONTEXT,
  daysBetween,
  type EpisodeForm,
  parseDay,
  shortDate,
  SYMPTOMS,
  WHAT_HAPPENED,
} from '../data/cycleLog';
import { completedLengths, type CycleWindow, medianLength, type Regularity } from './cycleModel';
import { type CycleProfile, has, type Situation } from './cycleProfile';

// How the Cycle experience reads for one person: the header, the chart, the
// extra things worth logging, and short notes. Every situation they chose
// adds to it; the header follows the one that most changes timing.

export type LensHeader = { value: string; label: string };
export type LensChart = 'none' | 'lengthDots' | 'postpartumTimeline' | 'monthsSince';

export type Lens = {
  header: LensHeader;
  secondary: LensHeader | null;
  chart: LensChart;
  kinds: string[];
  symptoms: string[];
  contexts: string[];
  predicts: boolean;
  painSplit: boolean;
  empty: boolean;
  notes: string[];
  tags: string[];
  lengths: number[];
  weeksSinceBirth: number | null;
  periodWeeks: number[];
  monthsSince: number | null;
};

const EXTRA_SYMPTOMS: Partial<Record<Situation, string[]>> = {
  'PCOS / PMOS': ['Acne', 'Hair growth', 'Hair loss', 'Ovulation signs'],
  Postpartum: ['Low mood', 'Anxious or on edge'],
  Perimenopause: ['Hot flashes', 'Night sweats', 'Brain fog', 'Joint pain'],
};

const EXTRA_CONTEXTS: Partial<Record<Situation, string[]>> = {
  Endometriosis: ['Pain with bowel movements', 'Pain when urinating', 'Pain during sex'],
};

const unique = (xs: string[]) => [...new Set(xs)];

function kindsFor(p: CycleProfile): string[] {
  const out: string[] = [];
  for (const k of WHAT_HAPPENED) {
    out.push(k);
    if (k === 'Spotting') {
      if (has(p, 'Postpartum')) out.push('Postpartum bleeding');
      if (has(p, 'Hormonal contraception')) out.push('Withdrawal bleed', 'Breakthrough bleeding');
    }
  }
  return out;
}

function symptomsFor(p: CycleProfile): string[] {
  const extra = p.situations.flatMap((s) => EXTRA_SYMPTOMS[s] ?? []);
  return unique([...SYMPTOMS.filter((s) => s !== 'Other'), ...extra, 'Other']);
}

function contextsFor(p: CycleProfile): string[] {
  const extra = p.situations.flatMap((s) => EXTRA_CONTEXTS[s] ?? []);
  if (has(p, 'Hormonal contraception') && p.contraception === 'Pill') extra.push('Missed pill');
  const base = CONTEXT.filter((c) => !(c === 'Ovulation' && has(p, 'Hormonal contraception')));
  return unique([...extra, ...base]);
}

export function lensFor({
  profile,
  windows,
  regularity,
  now = new Date(),
}: {
  profile: CycleProfile;
  windows: CycleWindow[];
  regularity: Regularity;
  now?: Date;
}): Lens {
  const lengths = completedLengths(windows);
  const current = windows[windows.length - 1] ?? null;
  const since = current ? daysBetween(current.start, now) : 0;
  const birth = has(profile, 'Postpartum') && profile.birthDate ? parseDay(profile.birthDate) : null;
  const periLast = has(profile, 'Perimenopause') ? current?.start ?? (profile.lastPeriod ? parseDay(profile.lastPeriod) : null) : null;
  const notes: string[] = [];
  let header: LensHeader;
  let secondary: LensHeader | null = null;
  let chart: LensChart = 'none';
  let weeksSinceBirth: number | null = null;
  let periodWeeks: number[] = [];
  let monthsSince: number | null = null;

  if (birth) {
    weeksSinceBirth = Math.floor(daysBetween(birth, now) / 7);
    const back = windows.filter((w) => w.start >= birth);
    periodWeeks = back.map((w) => Math.floor(daysBetween(birth, w.start) / 7));
    header = { value: `Week ${weeksSinceBirth}`, label: 'Since birth' };
    secondary = { value: back.length ? String(back.length) : 'None yet', label: 'Periods since birth' };
    chart = 'postpartumTimeline';
    notes.push(
      profile.breastfeeding
        ? 'Periods often stay away while breastfeeding, so no next period date is shown.'
        : 'Cycles often take a few months to settle after birth, so no next period date is shown yet.',
    );
  } else if (periLast) {
    monthsSince = Math.floor(daysBetween(periLast, now) / 30.44);
    header = { value: monthsSince === 1 ? '1 month' : `${monthsSince} months`, label: 'Since your last period' };
    secondary = lengths.length ? { value: `${lengths[lengths.length - 1]} days`, label: 'Last cycle' } : null;
    chart = 'monthsSince';
    notes.push('12 months in a row without a period marks menopause.');
  } else if (has(profile, 'No periods right now')) {
    header = { value: 'No periods', label: 'Tracking symptoms by month' };
  } else if (!current) {
    header = { value: 'No period logged yet', label: 'Log a period to see your cycle here' };
  } else if (regularity === 'predictable') {
    const median = medianLength(windows)!;
    header = { value: `Day ${since + 1}`, label: 'Current cycle' };
    secondary = { value: `${Math.min(...lengths)} to ${Math.max(...lengths)} days`, label: 'Recent range' };
    notes.push(`Your cycles usually run about ${median} days, so your next period may start around ${shortDate(addDays(current.start, median))}.`);
  } else {
    header = { value: `Day ${since + 1}`, label: 'Since your last period' };
    secondary = lengths.length ? { value: `${Math.max(...lengths)} days`, label: 'Longest gap' } : null;
    chart = lengths.length ? 'lengthDots' : 'none';
    notes.push('Your cycle lengths vary, so no next period date is shown.');
  }

  if (has(profile, 'Postpartum') && !birth) notes.push('Add when you gave birth in Your Cycle to see weeks since birth.');
  if (has(profile, 'Hormonal contraception')) {
    notes.push('Bleeding on hormonal contraception is often a withdrawal bleed, so only bleeds you log as a period start a new cycle.');
  }

  return {
    header,
    secondary,
    chart,
    kinds: kindsFor(profile),
    symptoms: symptomsFor(profile),
    contexts: contextsFor(profile),
    predicts: regularity === 'predictable' && !birth && !periLast,
    painSplit: has(profile, 'Endometriosis'),
    empty: !current && !birth && !periLast && !has(profile, 'No periods right now'),
    notes,
    tags: [...profile.situations],
    lengths,
    weeksSinceBirth,
    periodWeeks,
    monthsSince,
  };
}

// Care prompts on the review step, only when what was logged calls for one.
export function safetyNotes(form: Pick<EpisodeForm, 'kinds' | 'flow' | 'bowelFlags'>, profile: CycleProfile): string[] {
  const out: string[] = [];
  const bleeding = form.kinds.some((k) => BLEEDING_KINDS.includes(k));
  const heavy = form.flow === 'Heavy' || form.flow === 'Very heavy';
  if (bleeding && has(profile, 'Postpartum') && heavy) {
    out.push('Heavy bleeding after birth needs urgent care. Call your clinician or emergency services now.');
  } else if (bleeding && form.flow === 'Very heavy') {
    out.push('Soaking through a pad or tampon in about an hour is worth a call to a clinician today.');
  }
  if (form.kinds.includes('Bowel movement') && form.bowelFlags.includes('Blood')) {
    out.push('Blood in your stool is worth telling a clinician about soon.');
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit** (only if the user agreed to commits)

```bash
git add src/lib/cycleLens.ts src/lib/cycleLens.test.ts
git commit -m "Add the situation lens and safety notes"
```

---

### Task 6: Store the profile and expose the lens

**Files:**
- Modify: `src/state/cycleStore.tsx`

**Interfaces:**
- Produces: `useCycle()` gains `profile: CycleProfile`, `setProfile(p: CycleProfile)`. `useCycleInsights()` returns `{ windows, signals, summaries, observations, template, profile, regularity, lens }`.

- [ ] **Step 1: Imports.** Replace lines 4 and 6 with:

```ts
import { addDays, type Episode, type EpisodeForm, isoDay, normalizeEpisode, sampleEpisodes, startOfDay } from '../data/cycleLog';
import { lensFor } from '../lib/cycleLens';
import { cycleWindows, medianLength, periodStarts, regularity } from '../lib/cycleModel';
import { cycleSummaries, observations, signals, similarTemplate } from '../lib/cyclePatterns';
import { type CycleProfile, SAMPLE_PROFILE } from '../lib/cycleProfile';
```

- [ ] **Step 2: Store type.** Add to `Store`:

```ts
  // What the person told us about their cycle.
  profile: CycleProfile;
  setProfile: (profile: CycleProfile) => void;
```

- [ ] **Step 3: State, load and save.** Add `const [profile, setProfile] = useState<CycleProfile>(SAMPLE_PROFILE);` after the `episodes` state. In the load effect, add `profile?: CycleProfile;` to the saved type and replace `if (saved.episodes?.length) setEpisodes(saved.episodes);` with:

```ts
        // The sample record is rebuilt around today; only the person's own
        // episodes come from storage.
        if (saved.episodes) {
          const own = saved.episodes.filter((e) => !e.id.startsWith('sample-')).map(normalizeEpisode);
          setEpisodes([...sampleEpisodes(), ...own]);
        }
        if (saved.profile) setProfile(saved.profile);
```

Save effect:

```ts
    AsyncStorage.setItem(KEY, JSON.stringify({ episodes, watching, interventions, profile })).catch(() => {});
  }, [episodes, watching, interventions, profile]);
```

Add `profile, setProfile,` to the memoised store object and `profile` to its dependency list.

- [ ] **Step 4: Insights.** Replace `useCycleInsights` with:

```ts
export function useCycleInsights() {
  const { episodes, profile } = useCycle();
  return useMemo(() => {
    const windows = cycleWindows(periodStarts(episodes));
    const reg = regularity(windows, profile);
    const sigs = signals(episodes, windows, reg === 'predictable' ? medianLength(windows) : null);
    const summaries = cycleSummaries(sigs, windows);
    return {
      windows,
      signals: sigs,
      summaries,
      observations: observations(sigs, windows, summaries),
      template: similarTemplate(episodes),
      profile,
      regularity: reg,
      lens: lensFor({ profile, windows, regularity: reg }),
    };
  }, [episodes, profile]);
}
```

- [ ] **Step 5: Type check and tests**

Run: `npx tsc --noEmit -p . && npm test`
Expected: no tsc output; all tests pass.

- [ ] **Step 6: Commit** (only if the user agreed to commits)

```bash
git add src/state/cycleStore.tsx
git commit -m "Keep the cycle profile and derive the lens"
```

---

### Task 7: Your Cycle screen

**Files:**
- Create: `src/screens/CycleProfileScreen.tsx`
- Modify: `src/navigation.ts` (add `| 'cycleProfile'` to `Screen`)
- Modify: `src/Root.tsx` (import and add `cycleProfile: CycleProfileScreen,` to `DETAIL_SCREENS`)
- Modify: `src/screens/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `useCycle().profile`, `setProfile` (Task 6); `SITUATIONS`, `CONTRACEPTION`, `toggleSituation`, `has` (Task 1).

- [ ] **Step 1: Create** `src/screens/CycleProfileScreen.tsx`

```tsx
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { addDays, daysBetween, isoDay, parseDay, startOfDay } from '../data/cycleLog';
import { CONTRACEPTION, type Contraception, type CycleProfile, has, SITUATIONS, toggleSituation } from '../lib/cycleProfile';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { C, font } from '../theme';
import { ListGroup, ListRow } from '../ui/chrome';
import { ChoiceChips, FieldLabel, Stepper } from '../ui/cycleInputs';
import { Icon } from '../ui/icons';
import { DetailScreen, PrimaryButton } from '../ui/kit';

const weeksAgo = (iso: string | undefined, now: Date) => (iso ? Math.max(0, Math.round(daysBetween(parseDay(iso), now) / 7)) : null);
const weeksLabel = (n: number) => (n === 0 ? 'This week' : n === 1 ? '1 week ago' : `${n} weeks ago`);

// Your Cycle: every situation that fits, and the one or two details each needs.
export function CycleProfileScreen() {
  const nav = useNav();
  const { profile, setProfile } = useCycle();
  const [draft, setDraft] = useState<CycleProfile>(profile);
  const now = new Date();
  const birth = weeksAgo(draft.birthDate, now);
  const last = weeksAgo(draft.lastPeriod, now);

  const setWeeks = (key: 'birthDate' | 'lastPeriod', n: number) =>
    setDraft((d) => ({ ...d, [key]: isoDay(addDays(startOfDay(now), -Math.max(0, n) * 7)) }));
  const save = () => {
    setProfile({ ...draft, setupDone: true });
    nav.back();
  };

  return (
    <DetailScreen
      title="Your Cycle"
      onBack={nav.back}
      footer={
        <View style={p.footer}>
          <PrimaryButton label="Save" onPress={save} />
        </View>
      }
    >
      <Text style={[font('subhead'), { color: C.secondary, marginBottom: 16 }]}>
        Pick everything that fits. You can change this any time.
      </Text>
      <ListGroup>
        {SITUATIONS.map((s, n) => {
          const on = has(draft, s.id);
          return (
            <ListRow
              key={s.id}
              first={n === 0}
              title={s.id}
              sub={s.sub}
              onPress={() => setDraft((d) => toggleSituation(d, s.id))}
              right={on ? <Icon name="check" size={20} color={C.tint} weight={2} /> : <View style={p.blank} />}
            />
          );
        })}
      </ListGroup>

      {has(draft, 'Postpartum') ? (
        <>
          <FieldLabel>When did you give birth?</FieldLabel>
          <Stepper
            label="Birth"
            value={birth == null ? 'Not set' : weeksLabel(birth)}
            onEarlier={() => setWeeks('birthDate', (birth ?? -1) + 1)}
            onLater={() => setWeeks('birthDate', (birth ?? 1) - 1)}
            laterDisabled={birth == null || birth === 0}
          />
          <FieldLabel>Are you breastfeeding?</FieldLabel>
          <ChoiceChips
            single
            options={['Yes', 'No']}
            selected={draft.breastfeeding == null ? [] : [draft.breastfeeding ? 'Yes' : 'No']}
            onToggle={(v) => setDraft((d) => ({ ...d, breastfeeding: d.breastfeeding === (v === 'Yes') ? undefined : v === 'Yes' }))}
          />
        </>
      ) : null}

      {has(draft, 'Perimenopause') ? (
        <>
          <FieldLabel hint="Only used until you log a period here.">When was your last period?</FieldLabel>
          <Stepper
            label="Last period"
            value={last == null ? 'Not set' : weeksLabel(last)}
            onEarlier={() => setWeeks('lastPeriod', (last ?? -1) + 1)}
            onLater={() => setWeeks('lastPeriod', (last ?? 1) - 1)}
            laterDisabled={last == null || last === 0}
          />
        </>
      ) : null}

      {has(draft, 'Hormonal contraception') ? (
        <>
          <FieldLabel>Which kind?</FieldLabel>
          <ChoiceChips
            single
            options={CONTRACEPTION}
            selected={draft.contraception ? [draft.contraception] : []}
            onToggle={(v) => setDraft((d) => ({ ...d, contraception: d.contraception === v ? undefined : (v as Contraception) }))}
          />
        </>
      ) : null}
    </DetailScreen>
  );
}

const p = StyleSheet.create({
  blank: { width: 20 },
  footer: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
});
```

- [ ] **Step 2: Register the screen.** `src/navigation.ts`: add `| 'cycleProfile'` after `| 'movement'`. `src/Root.tsx`: `import { CycleProfileScreen } from './screens/CycleProfileScreen';` and `cycleProfile: CycleProfileScreen,` in `DETAIL_SCREENS`.

- [ ] **Step 3: Profile row.** In `src/screens/ProfileScreen.tsx` add `import { useCycle } from '../state/cycleStore';` and, after `DetailsGroup`, this component:

```tsx
function CycleGroup({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const { profile } = useCycle();
  return (
    <ListGroup header="Your Cycle">
      <ListRow
        first
        icon="drop"
        tint={C.coral}
        title="Cycle Situation"
        sub={profile.situations.join(' · ') || 'Not set yet'}
        onPress={() => onOpen('cycleProfile')}
      />
    </ListGroup>
  );
}
```

Render `<CycleGroup onOpen={nav.push} />` right after each `<DetailsGroup onOpen={nav.push} />` (Overview and Health Info segments).

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit -p .`
Expected: no output.

- [ ] **Step 5: Look at it.** Temporarily set `src/Root.tsx` to `useState<Tab>('profile')` and `useState<Screen[]>(['cycleProfile'])`, relaunch (`xcrun simctl terminate booted com.ciatta.mobileapp; xcrun simctl launch booted com.ciatta.mobileapp`), screenshot (`xcrun simctl io booted screenshot "$SCRATCH/cycle-profile.png"`, where `$SCRATCH` is your session scratchpad directory) and view it. Expect the eight rows with checks on Endometriosis and Irregular. Restore both defaults to `'today'` and `[]`.

- [ ] **Step 6: Commit** (only if the user agreed to commits)

```bash
git add src/screens/CycleProfileScreen.tsx src/navigation.ts src/Root.tsx src/screens/ProfileScreen.tsx
git commit -m "Add the Your Cycle screen"
```

---

### Task 8: Situation charts

**Files:**
- Modify: `src/ui/lineCharts.tsx`

**Interfaces:**
- Produces: `LengthDots({ lengths: number[] })`, `PostpartumTimeline({ weeks: number; periodWeeks: number[] })`, `MonthsSince({ months: number })`.

- [ ] **Step 1: Import `M`.** Change the theme import to `import { C, font, fonts, M } from '../theme';`.

- [ ] **Step 2: Add the three charts** above `const s = StyleSheet.create`:

```tsx
// Completed cycle lengths as points on one line. The dashed tick is the
// middle length; the open point is the latest cycle.
export function LengthDots({ lengths }: { lengths: number[] }) {
  if (!lengths.length) return null;
  const W = 320;
  const H = 44;
  const pad = 12;
  const lo = Math.min(21, ...lengths);
  const hi = Math.max(45, ...lengths);
  const x = (n: number) => pad + ((n - lo) / (hi - lo)) * (W - pad * 2);
  const sorted = [...lengths].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const lastIdx = lengths.length - 1;
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={pad} x2={W - pad} y1={16} y2={16} stroke={C.separator} strokeWidth={1} />
        <Line x1={x(median)} x2={x(median)} y1={6} y2={26} stroke={C.secondary} strokeWidth={1} strokeDasharray="3 3" />
        {lengths.map((n, i) => (
          <Circle key={i} cx={x(n)} cy={16} r={i === lastIdx ? 5 : 4} fill={i === lastIdx ? C.card : M.timeDepth} stroke={M.timeDepth} strokeWidth={1.5} />
        ))}
        <SvgText x={pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>{`${lo} days`}</SvgText>
        <SvgText x={W - pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">{`${hi} days`}</SvgText>
      </Svg>
    </View>
  );
}

// Weeks since birth on one line, with a point for each period that returned.
export function PostpartumTimeline({ weeks, periodWeeks }: { weeks: number; periodWeeks: number[] }) {
  const W = 320;
  const H = 44;
  const pad = 12;
  const span = Math.max(52, weeks);
  const x = (w: number) => pad + (Math.min(w, span) / span) * (W - pad * 2);
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={pad} x2={W - pad} y1={16} y2={16} stroke={C.separator} strokeWidth={1} />
        <Line x1={pad} x2={x(weeks)} y1={16} y2={16} stroke={M.timeDepth} strokeWidth={2} />
        {periodWeeks.map((w, i) => (
          <Circle key={i} cx={x(w)} cy={16} r={4} fill={M.reported} />
        ))}
        <Circle cx={x(weeks)} cy={16} r={5} fill={C.card} stroke={M.timeDepth} strokeWidth={1.5} />
        <SvgText x={pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>Birth</SvgText>
        <SvgText x={W - pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">{`${span} weeks`}</SvgText>
      </Svg>
    </View>
  );
}

// Twelve steps toward a year without a period; the filled ones have passed.
export function MonthsSince({ months }: { months: number }) {
  const W = 320;
  const H = 44;
  const pad = 12;
  const step = (W - pad * 2) / 11;
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {Array.from({ length: 12 }, (_, i) => (
          <Circle
            key={i}
            cx={pad + i * step}
            cy={16}
            r={5}
            fill={i < months ? M.timeDepth : 'none'}
            stroke={i < months ? M.timeDepth : C.separator}
            strokeWidth={1.5}
          />
        ))}
        <SvgText x={pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>1</SvgText>
        <SvgText x={W - pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">12 months</SvgText>
      </Svg>
    </View>
  );
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit -p .`
Expected: no output. (The charts are viewed on screen in Task 9.)

- [ ] **Step 4: Commit** (only if the user agreed to commits)

```bash
git add src/ui/lineCharts.tsx
git commit -m "Add the cycle length, postpartum and months since charts"
```

---

### Task 9: Cycle home header per situation

**Files:**
- Modify: `src/screens/CycleScreen.tsx`

**Interfaces:**
- Consumes: `useCycleInsights().lens`, `profile`; `painSplit` (Task 4); charts (Task 8); `Tag` from kit.

- [ ] **Step 1: Imports.** Replace the import block with:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { painSplit, tally } from '../lib/cyclePatterns';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { C, font, RADIUS } from '../theme';
import { ListGroup, ListRow, Panel } from '../ui/chrome';
import { ObservationCard } from '../ui/cycleInputs';
import { DetailScreen, PrimaryButton, SecLabel, SecondaryButton, SourceFooter, Tag } from '../ui/kit';
import { LengthDots, MonthsSince, PostpartumTimeline } from '../ui/lineCharts';
```

- [ ] **Step 2: Derived values.** Replace lines 16–29 (from `const { signals, … } = useCycleInsights();` to `const flares = …`) with:

```tsx
  const { signals, summaries, observations, template, lens, profile } = useCycleInsights();

  const current = summaries[summaries.length - 1] ?? null;
  const last4 = summaries.slice(-4);
  const mine = current ? signals.filter((s) => s.cycle === current.window) : [];
  const pain = mine.filter((s) => s.pain);
  const top = (lists: string[][], n: number) => tally(lists).slice(0, n).map((x) => x.label);

  const locations = top(pain.map((s) => s.episode.locations), 2);
  const sensations = top(pain.map((s) => s.episode.sensations), 2);
  const symptoms = top(mine.map((s) => s.episode.symptoms), 3);
  const overallLocations = top(signals.filter((s) => s.pain).map((s) => s.episode.locations), 3);
  const flares = mine.filter((s) => s.episode.flareUpUserReported).length;
  const split = lens.painSplit ? painSplit(signals) : null;
```

- [ ] **Step 3: Header.** Replace the `<View style={cy.tiles}> … </View>` block (lines 48–61) with:

```tsx
      <Pressable
        onPress={() => nav.push('cycleProfile')}
        accessibilityRole="button"
        accessibilityLabel={`What you told us: ${lens.tags.join(', ') || 'nothing yet'}. Edit`}
        style={cy.told}
      >
        <Text style={[font('footnote'), { color: C.secondary }]}>What you told us</Text>
        <View style={cy.tagRow}>
          {lens.tags.length ? lens.tags.map((t) => <Tag key={t} label={t} tone="neutral" />) : <Tag label="Not set" tone="neutral" />}
        </View>
      </Pressable>

      {!profile.setupDone ? (
        <Panel style={cy.below}>
          <Text style={[font('headline'), { color: C.text }]}>Tell us about your cycle</Text>
          <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>
            Conditions and life stages change what is useful to track and what can be predicted.
          </Text>
          <View style={{ marginTop: 12 }}>
            <SecondaryButton label="Set Up Your Cycle" onPress={() => nav.push('cycleProfile')} />
          </View>
        </Panel>
      ) : null}

      <View style={cy.tiles}>
        <View style={cy.tile}>
          <Text style={[font('footnote'), { color: C.secondary }]}>{lens.header.label}</Text>
          <Text style={[font('title2', 'semibold'), { color: C.text }]}>{lens.header.value}</Text>
        </View>
        {lens.secondary ? (
          <View style={cy.tile}>
            <Text style={[font('footnote'), { color: C.secondary }]}>{lens.secondary.label}</Text>
            <Text style={[font('title2', 'semibold'), { color: C.text }]}>{lens.secondary.value}</Text>
          </View>
        ) : null}
      </View>

      {lens.chart !== 'none' ? (
        <Panel style={cy.below}>
          {lens.chart === 'lengthDots' ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Cycle lengths</Text>
              <LengthDots lengths={lens.lengths} />
            </>
          ) : null}
          {lens.chart === 'postpartumTimeline' && lens.weeksSinceBirth != null ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Since birth</Text>
              <PostpartumTimeline weeks={lens.weeksSinceBirth} periodWeeks={lens.periodWeeks} />
            </>
          ) : null}
          {lens.chart === 'monthsSince' && lens.monthsSince != null ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Months since your last period</Text>
              <MonthsSince months={lens.monthsSince} />
            </>
          ) : null}
        </Panel>
      ) : null}

      {lens.notes.map((n) => (
        <Text key={n} style={[font('footnote'), cy.note]}>
          {n}
        </Text>
      ))}

      {split ? (
        <Panel style={cy.below}>
          <Text style={[font('footnote'), { color: C.secondary }]}>Pain days, last 90 days</Text>
          <View style={[cy.tiles, { marginBottom: 0, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[font('title3', 'semibold'), { color: C.text }]}>{split.during}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>During your period</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[font('title3', 'semibold'), { color: C.text }]}>{split.outside}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>Outside your period</Text>
            </View>
          </View>
        </Panel>
      ) : null}

      <View style={cy.below} />
```

- [ ] **Step 4: Rows that assumed a current cycle.** Change the Pain row sub to
`sub={current ? `${current.painDays} days this cycle` : 'No period logged yet'}` and, in Over Time, render the Cycle length row only when there are lengths:

```tsx
          {lens.lengths.length ? <ListRow first title="Cycle length" sub={`${lens.lengths.slice(-4).join(' → ')} days`} /> : null}
          <ListRow first={!lens.lengths.length} title="Pain days" sub={last4.map((c) => c.painDays).join(' → ') || 'None logged'} />
```

- [ ] **Step 5: Styles.** Add to `cy`:

```tsx
  told: { minHeight: 44, gap: 6, marginBottom: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  below: { marginBottom: 16 },
  chartLabel: { color: C.secondary, marginBottom: 6 },
  note: { color: C.secondary, marginBottom: 8 },
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit -p .`
Expected: no output.

- [ ] **Step 7: Look at it.** Temporarily set `src/Root.tsx` to `useState<Tab>('myhealth')` and `useState<Screen[]>(['cycle'])`, relaunch, screenshot and view. Expect: tags Endometriosis and Irregular; "Since your last period / Day 12"; "Longest gap / 41 days"; the length dots; the note; the pain split panel. Restore the defaults.

- [ ] **Step 8: Commit** (only if the user agreed to commits)

```bash
git add src/screens/CycleScreen.tsx
git commit -m "Show each cycle situation on the Cycle screen"
```

---

### Task 10: Logging with the lens, the bowel step and safety notes

**Files:**
- Create: `src/ui/stoolScale.tsx`
- Modify: `src/screens/CycleLogScreen.tsx`

**Interfaces:**
- Consumes: `lens.kinds`, `lens.symptoms`, `lens.contexts`, `profile` (Task 6); `safetyNotes` (Task 5); `STOOL_TYPES`, `BOWEL_PAIN`, `BOWEL_FLAGS`, `BLEEDING_KINDS` (Task 3).
- Produces: `StoolScale({ value: number | null; onChange: (type: number) => void })`.

- [ ] **Step 1: Create** `src/ui/stoolScale.tsx`

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { STOOL_TYPES } from '../data/cycleLog';
import { C, font, RADIUS } from '../theme';

// Simple line pictures for the seven stool types, drawn in one weight.
function Picture({ type, color }: { type: number; color: string }) {
  const line = { stroke: color, strokeWidth: 1.5, fill: 'none' } as const;
  return (
    <Svg width={44} height={24} viewBox="0 0 44 24">
      {type === 1 ? [8, 17, 27, 36].map((cx, i) => <Circle key={cx} cx={cx} cy={i % 2 ? 9 : 15} r={3.5} {...line} />) : null}
      {type === 2 ? (
        <Path d="M6 12a5 5 0 0 1 8-4a5 5 0 0 1 8 0a5 5 0 0 1 8 0a5 5 0 0 1 8 4a5 5 0 0 1-8 4a5 5 0 0 1-8 0a5 5 0 0 1-8 0a5 5 0 0 1-8-4z" {...line} />
      ) : null}
      {type === 3 ? (
        <>
          <Rect x={4} y={7} width={36} height={10} rx={5} {...line} />
          <Path d="M14 7v3M22 17v-3M30 7v3" {...line} />
        </>
      ) : null}
      {type === 4 ? <Rect x={4} y={7} width={36} height={10} rx={5} {...line} /> : null}
      {type === 5 ? [10, 22, 34].map((cx) => <Ellipse key={cx} cx={cx} cy={12} rx={5} ry={4} {...line} />) : null}
      {type === 6 ? <Path d="M5 14c2-5 5-2 7-5s5 3 8 0 5-2 7 1 6-2 8 2-2 5-6 4-6 2-10 1-8 1-12-1-5-1-2-3z" {...line} /> : null}
      {type === 7 ? <Path d="M4 10c4-3 8 3 12 0s8 3 12 0 8 3 12 0M4 16c4-3 8 3 12 0s8 3 12 0 8 3 12 0" {...line} /> : null}
    </Svg>
  );
}

export function StoolScale({ value, onChange }: { value: number | null; onChange: (type: number) => void }) {
  return (
    <View style={s.list}>
      {STOOL_TYPES.map(({ type, word }) => {
        const on = value === type;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Type ${type}, ${word}`}
            style={[s.row, on && s.on]}
          >
            <Picture type={type} color={on ? C.text : C.secondary} />
            <Text style={[font('subhead', on ? 'semibold' : 'regular'), { color: on ? C.text : C.secondary, flex: 1 }]}>{word}</Text>
            <Text style={[font('footnote'), { color: C.secondary }]}>Type {type}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS, backgroundColor: C.card },
  on: { backgroundColor: C.cardHi },
});
```

- [ ] **Step 2: Imports in `CycleLogScreen.tsx`.** In the `../data/cycleLog` import remove `CONTEXT`, `SYMPTOMS`, `WHAT_HAPPENED` and add `BLEEDING_KINDS`, `BOWEL_FLAGS`, `BOWEL_PAIN`. Add:

```tsx
import { safetyNotes } from '../lib/cycleLens';
import { StoolScale } from '../ui/stoolScale';
```

- [ ] **Step 3: Steps.** Add `| 'bowel'` to `StepId`. In `stepsFor` replace
`if (kinds.includes('Period') || kinds.includes('Spotting')) steps.push('period');` with:

```tsx
  if (kinds.some((k) => BLEEDING_KINDS.includes(k))) steps.push('period');
  if (kinds.includes('Bowel movement')) steps.push('bowel');
```

- [ ] **Step 4: Lens in the screen.** Change `const { template } = useCycleInsights();` to
`const { template, lens, profile } = useCycleInsights();`. In the `what` step use `options={lens.kinds}`; in `symptoms` use `options={lens.symptoms}`; in `around` use `options={lens.contexts}`.

- [ ] **Step 5: Period step title.** Replace the first two lines of the `period` step body
(`const spotting = …` and the `StepHeader` using it) with:

```tsx
      const kind = BLEEDING_KINDS.find((k) => form.kinds.includes(k)) ?? 'Period';
      return (
        <>
          <StepHeader title={kind === 'Period' ? 'When was your period?' : `When was the ${kind.toLowerCase()}?`} hint="Rough dates are fine." />
```

(keep the rest of the step as it is).

- [ ] **Step 6: Bowel step.** Add to `body` after `period`:

```tsx
    bowel: () => (
      <>
        <StepHeader title="Tell us about the bowel movement" hint="Pick the picture closest to what you saw." />
        <Stepper
          label="Day"
          value={dayAgoLabel(form.day)}
          onEarlier={() => set('day', form.day + 1)}
          onLater={() => set('day', Math.max(0, form.day - 1))}
          laterDisabled={form.day === 0}
        />
        <FieldLabel>Type</FieldLabel>
        <StoolScale value={form.stool} onChange={(n) => set('stool', form.stool === n ? null : n)} />
        <FieldLabel>Pain</FieldLabel>
        <ChoiceChips
          single
          options={BOWEL_PAIN}
          selected={form.bowelPain ? [form.bowelPain] : []}
          onToggle={(v) => set('bowelPain', form.bowelPain === v ? null : v)}
        />
        <FieldLabel>Also true</FieldLabel>
        <ChoiceChips options={BOWEL_FLAGS} selected={form.bowelFlags} onToggle={(v) => toggle('bowelFlags', v)} />
      </>
    ),
```

- [ ] **Step 7: Safety notes.** In the `summary` step, after the closing `</Panel>` add:

```tsx
        {safetyNotes(form, profile).map((note) => (
          <Panel key={note} style={[l.gap, l.care]}>
            <Icon name="info" size={20} color={C.secondary} weight={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[font('headline'), { color: C.text }]}>Worth knowing</Text>
              <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>{note}</Text>
            </View>
          </Panel>
        ))}
```

- [ ] **Step 8: Type check and tests**

Run: `npx tsc --noEmit -p . && npm test`
Expected: no tsc output; all tests pass.

- [ ] **Step 9: Look at it.** Temporarily:
  - `src/state/cycleStore.tsx`: draft default `{ mode: 'new', form: { kinds: ['Bowel movement'], stool: 6, bowelPain: 'During', bowelFlags: ['Blood'] } }`
  - `src/Root.tsx`: tab `'myhealth'`, stack `['cycleLog']`
  - `src/screens/CycleLogScreen.tsx`: `useState(0)` for `index` → `useState(1)`

Relaunch and screenshot: the bowel step with pictures. Then set `index` to `useState(2)` (summary) and screenshot: the "Blood in your stool" note. Restore all three defaults.

- [ ] **Step 10: Commit** (only if the user agreed to commits)

```bash
git add src/ui/stoolScale.tsx src/screens/CycleLogScreen.tsx
git commit -m "Log bowel movements and adapt the log to each situation"
```

---

### Task 11: Health, History, Journey and the body map

**Files:**
- Modify: `src/ui/HealthDashboard.tsx`, `src/screens/MyHealthScreen.tsx`
- Modify: `src/screens/CycleHistoryScreen.tsx`
- Modify: `src/screens/JourneyScreen.tsx`
- Modify: `src/lib/bodyMap.ts`

**Interfaces:**
- Consumes: `Lens` (Task 5), `BANDS`, `bandOf` (Task 2), `Signal.bowelPain`, `MonthSummary.bowel`, `bowelPain` (Task 4).

- [ ] **Step 1: Dashboard props.** In `src/ui/HealthDashboard.tsx` add `import type { Lens } from '../lib/cycleLens';`, add `lens` to the destructured props and `lens: Lens;` to their type. Replace
`const current = summaries[summaries.length - 1];` and `const cycleDay = …` with:

```tsx
  const current = summaries[summaries.length - 1] ?? null;
```

- [ ] **Step 2: Cycle card.** Replace the Cycle `<Card …> … </Card>` with:

```tsx
      <Card title="Cycle" meta={lens.header.value} onPress={() => open('cycle')}>
        <View style={d.row3}>
          <Stat label={lens.header.label} value={lens.header.value} />
          {lens.secondary ? <Stat label={lens.secondary.label} value={lens.secondary.value} /> : null}
          <Stat label="Pain days" value={`${current?.painDays ?? 0}`} sub="this cycle" color={M.reported} />
        </View>
        {done.length ? (
          <>
            <Text style={[font('footnote'), d.chartLabel]}>Cycle length, last {done.length} cycles</Text>
            <HairlineChart
              values={done.map((c) => c.window.length)}
              color={M.timeDepth}
              dots
              height={52}
              first={shortDate(done[0].window.start)}
              last={shortDate(done[done.length - 1].window.start)}
            />
          </>
        ) : null}
      </Card>
```

In the Pain and Flare Ups card change `current.maxSeverity`, `current.flares`, `current.hours` to `current?.maxSeverity`, `current?.flares ?? 0`, `current?.hours` (keep the `!= null` checks).

- [ ] **Step 3: Pass the lens.** In `src/screens/MyHealthScreen.tsx` change to
`const { signals, summaries, lens } = useCycleInsights();` and add `lens={lens}` to `<HealthDashboard … />`.

- [ ] **Step 4: History timing.** In `src/screens/CycleHistoryScreen.tsx` add `import { BANDS, bandOf } from '../lib/cycleModel';` and replace the `timing` line with:

```tsx
  const unplaced = pain.filter((s) => s.phase == null && s.daysSincePeriod != null);
  const timing = [
    ...PHASES.map((phase) => ({ label: phase, count: pain.filter((s) => s.phase === phase).length })),
    ...BANDS.map((b) => ({
      label: `${b.label} after a period`,
      count: unplaced.filter((s) => bandOf(s.daysSincePeriod!) === b).length,
    })).filter((x) => x.count > 0),
  ];
```

- [ ] **Step 5: Journey.** In `MonthDetail` in `src/screens/JourneyScreen.tsx`, after the `Flare up` row add:

```tsx
      {ms.bowel ? (
        <Row title="Bowel movements" value={`${ms.bowel} logged${ms.bowelPain ? `, ${ms.bowelPain} with pain` : ''}`} />
      ) : null}
```

- [ ] **Step 6: Body map.** In `readBody` in `src/lib/bodyMap.ts`, directly after the `for (const [region, list] of byRegion) { … }` loop add:

```ts
  // Bowel movements she logged as painful sit on the lower abdomen, unless
  // pain she logged there already does.
  const bowel = signals.filter((s) => s.bowelPain && daysBetween(s.date, now) <= 30);
  if (bowel.length && !points.has('lower_abdomen')) {
    const latest = bowel[bowel.length - 1];
    put({
      region: 'lower_abdomen',
      meaning: 'reported',
      state: daysBetween(latest.date, now) <= 14 ? 'lit' : 'historical',
      halo: false,
      title: 'Bowel movement pain',
      detail: `You logged pain with ${plural(bowel.length, 'bowel movement')} in the last month.`,
      source: 'You reported',
      screen: 'cycleHistory',
    });
  }
```

- [ ] **Step 7: Type check and tests**

Run: `npx tsc --noEmit -p . && npm test`
Expected: no tsc output; all tests pass.

- [ ] **Step 8: Commit** (only if the user agreed to commits)

```bash
git add src/ui/HealthDashboard.tsx src/screens/MyHealthScreen.tsx src/screens/CycleHistoryScreen.tsx src/screens/JourneyScreen.tsx src/lib/bodyMap.ts
git commit -m "Carry cycle situations and bowel movements into Health, History and Journey"
```

---

### Task 12: Verify every situation on screen

**Files:** none changed permanently.

- [ ] **Step 1: Preview setup.** Temporarily:
  - `src/Root.tsx`: tab `'myhealth'`, stack `['cycle']`.
  - `src/state/cycleStore.tsx`: comment out `if (saved.profile) setProfile(saved.profile);` so the default profile is used.

- [ ] **Step 2: One screenshot per profile.** For each value below, set it as the `useState<CycleProfile>(…)` default in `cycleStore.tsx`, relaunch (`xcrun simctl terminate booted com.ciatta.mobileapp; xcrun simctl launch booted com.ciatta.mobileapp`), take a screenshot to the scratchpad, and view it:

| Name | Profile | Expect in header |
|---|---|---|
| regular | `{ situations: ['Regular'], setupDone: true }` | "Since your last period" (sample data varies by 15 days, so no prediction even for Regular) |
| endo | `SAMPLE_PROFILE` | Day 12, Longest gap 41 days, dots, pain split |
| pcos | `{ situations: ['PCOS / PMOS'], setupDone: true }` | Day 12, dots |
| postpartum | `{ situations: ['Postpartum'], birthDate: isoDay(addDays(startOfDay(new Date()), -98)), breastfeeding: true, setupDone: true }` | Week 14, Periods since birth, timeline |
| peri | `{ situations: ['Perimenopause', 'Endometriosis'], setupDone: true }` | 0 months since last period (sample current cycle), months dots, pain split |
| pill | `{ situations: ['Hormonal contraception'], contraception: 'Pill', setupDone: true }` | withdrawal bleed note |
| none | `{ situations: ['No periods right now'], setupDone: true }` | No periods |
| unset | `EMPTY_PROFILE` | "Tell us about your cycle" panel |

Also open the Health tab Dashboard (stack `[]`) once to check the Cycle card, and the Body view to check the lower abdomen point.

- [ ] **Step 3: Restore.** Put back the `SAMPLE_PROFILE` default, uncomment the saved profile line, restore Root to `'today'` and `[]`. Run `npx tsc --noEmit -p . && npm test` and `git diff --stat` to confirm no preview edits remain.

- [ ] **Step 4: Report** to the user with the screenshots' findings, including anything that looked wrong.

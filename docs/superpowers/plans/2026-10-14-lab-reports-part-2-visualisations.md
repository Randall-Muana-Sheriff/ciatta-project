# Lab Reports Part 2: Visualisations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A saved report opens as one screen that shows the whole report at a glance, by panel, its trends across every report, where its results sit on her body systems, and, for hormones, where she was in her cycle. All of it is drawn by code from saved rows.

**Architecture:** Pure modules carry every rule:
- `labs.ts`: `testKey` and `changeSinceLast`
- `labSystems.ts`: `labSystem` and `reportSystems`
- `labCycle.ts`: `cycleDayAt`, `phaseRanges` and `chosenRange`
- `labReport.ts`: `reportResults`, `countLine` and `reportPanels`

A new `LabReportScreen` renders them. Records and Add a Lab Report open it through a handoff, the same way `labHandoff` does for one test.

**Tech Stack:** Expo 57 / React Native, react-native-svg, node:test via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-14-lab-reports-and-clinical-analysis-design.md` (Part 2).

## Spec amendments carried by this plan

- **Phase at the draw uses the app's own rules** (`cycleModel.ts`):
  - The observational phase comes from `phaseOf`: During period, Before period, After period, Between periods.
  - The clinical estimate comes from `estimatedPhase`, shown as "Likely follicular". It is anchored to her median cycle length, as Today already does.
  - Where the lab printed phase ranges, the range for the estimated phase is highlighted and named as likely. The cycle day is always shown beside it, so she or her clinician can check the choice.
- **Cycle day is unknown** when no logged period start lies within 45 days before the draw date.

## Global Constraints

- Run app commands from `ciatta-mobile-app/`. `npm test`, `npx tsc --noEmit`.
- UI copy has no em dash, en dash or hyphen. Remote text renders through `displayCopy()`.
- Keep Jost and the existing design. Every screen sits on Ground (`DetailScreen`). Reuse `LabRangeBar`, `LabStatusTag`, `STATUS_COLOR`, `CardFill`, `Eyebrow`, `SecondaryButton`.
- Absence is never normal. No range means "No range given" and no bar.
- Nothing here is worded or drawn by a model.

## Review Focus

1. **The same test spelled differently by two labs** ("Hemoglobin A1c" and "HbA1c"). She expects one trend, not two. Pinned in Task 1 (`testKey` tests).
2. **A test whose unit changed between labs** (mg/dL then mmol/L). She expects no percentage change across units. Pinned in Task 1.
3. **A hormone drawn with no periods logged around it.** She expects "not known", never an estimated day. Pinned in Task 1 (`cycleDayAt` returns null past 45 days and before the first start).
4. **A provider draw on the same day as an uploaded report from the same lab.** She expects each report to open on its own results. Pinned in Task 2 (`reportResults` keeps report rows to their document and provider rows to the day).
5. **A test Ciatta has no body system for.** She expects it listed under Whole Body, not dropped or guessed. Pinned in Task 4.

---

### Task 1: The rules

**Files:**
- Modify: `ciatta-mobile-app/src/lib/labs.ts`
- Create: `ciatta-mobile-app/src/lib/labSystems.ts`
- Create: `ciatta-mobile-app/src/lib/labCycle.ts`
- Test: `ciatta-mobile-app/src/lib/labViews.test.ts`

**Interfaces:**
- Consumes: `CycleWindow`, `windowFor`, `phaseOf`, `estimatedPhase`, `estimatedPhaseLabel`, `ClinicalPhase`, `Phase` from `src/lib/cycleModel.ts`; `daysBetween`, `parseDay` from `src/data/cycleLog.ts`.
- Produces:
  - `testKey(name: string): string` and `changeSinceLast(history: readonly LabResult[]): string` in `labs.ts`. `labHistory` matches by `testKey`.
  - `labSystem(name: string): string | null` and `reportSystems(results: readonly LabResult[]): { systems: { system: string; results: LabResult[]; flagged: boolean }[]; whole: LabResult[] }` in `labSystems.ts`
  - In `labCycle.ts`:
    - `isCycleHormone(name: string): boolean`
    - `type CycleAt = { day: number; phase: Phase | null; likely: ClinicalPhase }`
    - `cycleDayAt(on: string, windows: CycleWindow[], usualLength: number | null): CycleAt | null`
    - `type PhaseRange = { phase: string; text: string; low: number | null; high: number | null }`
    - `phaseRanges(text: string | null): PhaseRange[]`
    - `chosenRange(ranges: PhaseRange[], likely: ClinicalPhase | null): PhaseRange | null`
    - `cycleLine(at: CycleAt | null): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/labViews.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cycleWindows } from './cycleModel';
import { chosenRange, cycleDayAt, cycleLine, isCycleHormone, phaseRanges } from './labCycle';
import { changeSinceLast, type LabResult, labHistory, testKey } from './labs';
import { labSystem, reportSystems } from './labSystems';

const r = (over: Partial<LabResult>): LabResult => ({
  id: Math.random().toString(16).slice(2),
  name: 'TSH',
  value: 2,
  valueText: null,
  unit: 'mIU/L',
  low: 0.4,
  high: 4,
  rangeText: '0.4 to 4.0',
  flag: null,
  status: 'final',
  source: 'report',
  lab: 'Quest',
  on: '2026-06-12',
  ...over,
});

// ── Test identity ────────────────────────────────────────────────────

test('the same test spelled differently by two labs is one test', () => {
  assert.equal(testKey('Hemoglobin A1c'), testKey('HbA1c'));
  assert.equal(testKey(' HEMOGLOBIN  A1C '), testKey('A1C'));
  assert.equal(testKey('Vitamin D, 25 Hydroxy'), testKey('25 hydroxy vitamin D'));
  assert.equal(testKey('TSH'), testKey('Thyroid Stimulating Hormone'));
  assert.notEqual(testKey('Free T4'), testKey('TSH'));
});

test('a test history gathers every spelling of it, oldest first', () => {
  const h = labHistory([r({ name: 'HbA1c', on: '2026-06-01', value: 5.9 }), r({ name: 'Hemoglobin A1c', on: '2026-01-01', value: 5.6 })], 'A1C');
  assert.deepEqual(h.map((x) => x.value), [5.6, 5.9]);
});

// ── Change since last ────────────────────────────────────────────────

test('the change since the previous result, in words', () => {
  assert.equal(changeSinceLast([r({ value: 50, on: '2026-03-03' }), r({ value: 59, on: '2026-06-12' })]), 'Up 18% since 3 Mar 2026');
  assert.equal(changeSinceLast([r({ value: 50, on: '2026-03-03' }), r({ value: 40, on: '2026-06-12' })]), 'Down 20% since 3 Mar 2026');
  assert.equal(changeSinceLast([r({ value: 50, on: '2026-03-03' }), r({ value: 50, on: '2026-06-12' })]), 'No change since 3 Mar 2026');
  assert.equal(changeSinceLast([r({ value: 50 })]), 'No earlier result');
});

test('results in different units are never compared', () => {
  assert.equal(changeSinceLast([r({ value: 100, unit: 'mg/dL' }), r({ value: 5.5, unit: 'mmol/L', on: '2026-07-01' })]), 'Earlier result in a different unit');
});

test('results in words are not compared', () => {
  assert.equal(changeSinceLast([r({ value: null, valueText: 'Negative' }), r({ value: null, valueText: 'Positive', on: '2026-07-01' })]), 'No earlier result');
});

// ── Body systems ─────────────────────────────────────────────────────

test('each test goes to one body system by an explicit table', () => {
  assert.equal(labSystem('Ferritin'), 'Circulatory');
  assert.equal(labSystem('Hemoglobin'), 'Circulatory');
  assert.equal(labSystem('HbA1c'), 'Metabolic');
  assert.equal(labSystem('TSH'), 'Metabolic');
  assert.equal(labSystem('ALT'), 'Digestive');
  assert.equal(labSystem('Creatinine'), 'Urinary');
  assert.equal(labSystem('Estradiol'), 'Reproductive');
  assert.equal(labSystem('C Reactive Protein'), 'Immune');
  assert.equal(labSystem('Calcium'), 'Musculoskeletal');
  assert.equal(labSystem('Something Unusual'), null);
});

test('a report lights the systems it touches, flags the ones with results outside range, and keeps the rest under Whole Body', () => {
  const rs = [r({ name: 'Ferritin', value: 8, low: 15, high: 150, rangeText: '15 to 150' }), r({ name: 'TSH' }), r({ name: 'Mystery marker' })];
  const out = reportSystems(rs);
  assert.deepEqual(out.systems.map((s) => [s.system, s.flagged, s.results.length]), [
    ['Circulatory', true, 1],
    ['Metabolic', false, 1],
  ]);
  assert.deepEqual(out.whole.map((x) => x.name), ['Mystery marker']);
});

// ── Cycle ────────────────────────────────────────────────────────────

const windows = cycleWindows([new Date(2026, 4, 20), new Date(2026, 5, 17)]);

test('the cycle hormones are the ones whose ranges depend on the cycle', () => {
  for (const n of ['Estradiol', 'Progesterone', 'LH', 'FSH', 'Prolactin', 'Testosterone, Total']) assert.ok(isCycleHormone(n), n);
  assert.equal(isCycleHormone('TSH'), false);
});

test('the cycle day at a draw is counted from the period before it', () => {
  const at = cycleDayAt('2026-06-19', windows, 28);
  assert.equal(at?.day, 3);
  assert.equal(at?.phase, 'During period');
  assert.equal(at?.likely, 'Menstrual');
  assert.equal(cycleLine(at), 'Cycle day 3, during period');
});

test('with no period logged in the 45 days before a draw, the cycle day is not known', () => {
  assert.equal(cycleDayAt('2026-09-30', windows, 28), null);
  assert.equal(cycleDayAt('2026-04-01', windows, 28), null, 'before her first logged period');
  assert.equal(cycleLine(null), 'Cycle day at this test is not known. Log your periods to see it.');
});

test('a range printed by phase is split into its phases', () => {
  const ranges = phaseRanges('Follicular 12.5 to 166 / Ovulation 85.8 to 498; Luteal 43.8 to 211\nPostmenopausal <54.7');
  assert.deepEqual(ranges.map((p) => [p.phase, p.low, p.high]), [
    ['Follicular', 12.5, 166],
    ['Ovulation', 85.8, 498],
    ['Luteal', 43.8, 211],
    ['Postmenopausal', null, 54.7],
  ]);
  assert.deepEqual(phaseRanges('12.5 to 166'), [], 'one plain range is not phase ranges');
  assert.deepEqual(phaseRanges(null), []);
});

test('the range for her likely phase is the one chosen, and none when the phase is not known', () => {
  const ranges = phaseRanges('Follicular 12.5 to 166 / Luteal 43.8 to 211');
  assert.equal(chosenRange(ranges, 'Luteal')?.phase, 'Luteal');
  assert.equal(chosenRange(ranges, 'Menstrual')?.phase, 'Follicular', 'menstrual days are early follicular');
  assert.equal(chosenRange(ranges, null), null);
  assert.equal(chosenRange(ranges, 'Ovulatory'), null, 'no printed ovulation range, so none is chosen');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/labViews.test.ts`
Expected: FAIL, `./labCycle` cannot be found.

- [ ] **Step 3: Implement**

In `src/lib/labs.ts`, add above `labHistory`:

```ts
// One name per test, whichever lab wrote it: case, spacing and punctuation
// folded, and a small table of the spellings labs commonly use for the
// same test. No guessing beyond the table.
const LAB_ALIASES: Record<string, string> = {
  'hemoglobin a1c': 'a1c',
  hba1c: 'a1c',
  'hgb a1c': 'a1c',
  'glycated hemoglobin': 'a1c',
  'glycohemoglobin': 'a1c',
  'thyroid stimulating hormone': 'tsh',
  'free t4': 'free t4',
  't4 free': 'free t4',
  'thyroxine free': 'free t4',
  'free thyroxine': 'free t4',
  'free t3': 'free t3',
  't3 free': 'free t3',
  'vitamin d 25 hydroxy': 'vitamin d',
  '25 hydroxy vitamin d': 'vitamin d',
  '25 oh vitamin d': 'vitamin d',
  'vitamin d 25 oh': 'vitamin d',
  'vitamin b12': 'b12',
  cobalamin: 'b12',
  hgb: 'hemoglobin',
  hct: 'hematocrit',
  wbc: 'white blood cells',
  'white blood cell count': 'white blood cells',
  rbc: 'red blood cells',
  'red blood cell count': 'red blood cells',
  plt: 'platelets',
  'platelet count': 'platelets',
  'c reactive protein': 'crp',
  'hs crp': 'crp',
  'high sensitivity crp': 'crp',
  'alanine aminotransferase': 'alt',
  sgpt: 'alt',
  'aspartate aminotransferase': 'ast',
  sgot: 'ast',
  'alkaline phosphatase': 'alp',
  'blood urea nitrogen': 'bun',
  'urea nitrogen': 'bun',
  'luteinizing hormone': 'lh',
  'follicle stimulating hormone': 'fsh',
  'estradiol e2': 'estradiol',
  e2: 'estradiol',
  'testosterone total': 'testosterone',
  'total testosterone': 'testosterone',
  'dhea sulfate': 'dhea s',
  'dhea s': 'dhea s',
  'anti mullerian hormone': 'amh',
  'erythrocyte sedimentation rate': 'esr',
  'sed rate': 'esr',
  'glucose fasting': 'glucose',
  'fasting glucose': 'glucose',
  'ldl cholesterol': 'ldl',
  'ldl c': 'ldl',
  'hdl cholesterol': 'hdl',
  'hdl c': 'hdl',
  'cholesterol total': 'total cholesterol',
};

export function testKey(name: string): string {
  const folded = name
    .toLowerCase()
    .replace(/[,()\-/.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return LAB_ALIASES[folded] ?? folded;
}

// What changed since her previous result for the same test, in words.
// Only numbers in the same unit are compared; anything else says why not.
export function changeSinceLast(history: readonly LabResult[]): string {
  const nums = history.filter((h) => h.value != null);
  if (nums.length < 2) return 'No earlier result';
  const cur = nums[nums.length - 1];
  const prev = nums[nums.length - 2];
  const unit = (u: string | null) => (u ?? '').trim().toLowerCase();
  if (unit(cur.unit) !== unit(prev.unit)) return 'Earlier result in a different unit';
  const since = labDay(prev.on);
  if (cur.value === prev.value) return `No change since ${since}`;
  if (prev.value === 0) return `${cur.value! > 0 ? 'Up' : 'Down'} from 0 since ${since}`;
  const pct = Math.round(((cur.value! - prev.value!) / Math.abs(prev.value!)) * 100);
  if (pct === 0) return `No change since ${since}`;
  return `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% since ${since}`;
}
```

Replace `labHistory` with:

```ts
// Every result for one test, oldest first, whatever spelling a lab used.
export function labHistory(results: readonly LabResult[], name: string): LabResult[] {
  const key = testKey(name);
  return results.filter((r) => testKey(r.name) === key).sort((a, b) => a.on.localeCompare(b.on));
}
```

`labDay` is defined below `labHistory` as a `const`. Move the `MONTHS` and `labDay` declarations above the new `testKey` block so `changeSinceLast` can use them.

`src/lib/labSystems.ts`:

```ts
// Which of Ciatta's body systems a lab test belongs to, by an explicit
// table. A test not in the table belongs to none, and is shown under
// Whole Body rather than guessed.

import { isOutside, type LabResult, testKey } from './labs';

const TABLE: Record<string, string[]> = {
  Circulatory: [
    'hemoglobin', 'hematocrit', 'red blood cells', 'white blood cells', 'platelets', 'mcv', 'mch', 'mchc', 'rdw', 'mpv',
    'ferritin', 'iron', 'tibc', 'transferrin', 'transferrin saturation', 'iron saturation', 'b12', 'folate',
  ],
  Metabolic: [
    'glucose', 'a1c', 'insulin', 'total cholesterol', 'ldl', 'hdl', 'triglycerides', 'non hdl cholesterol',
    'tsh', 'free t4', 'free t3', 't4', 't3', 'thyroid peroxidase antibodies', 'tpo antibodies', 'thyroglobulin antibodies', 'vitamin d',
  ],
  Digestive: ['alt', 'ast', 'alp', 'bilirubin', 'bilirubin total', 'total bilirubin', 'bilirubin direct', 'albumin', 'ggt', 'total protein', 'lipase', 'amylase'],
  Urinary: ['creatinine', 'bun', 'egfr', 'bun creatinine ratio', 'urine protein', 'urine specific gravity', 'urine ph', 'microalbumin'],
  Reproductive: ['estradiol', 'progesterone', 'lh', 'fsh', 'prolactin', 'testosterone', 'free testosterone', 'testosterone free', 'shbg', 'amh', 'dhea s', 'hcg'],
  Immune: ['crp', 'esr', 'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils', 'ana', 'rheumatoid factor'],
  Musculoskeletal: ['ck', 'creatine kinase', 'calcium', 'phosphorus', 'phosphate', 'magnesium'],
};

const BY_KEY = new Map<string, string>(Object.entries(TABLE).flatMap(([system, keys]) => keys.map((k) => [k, system] as [string, string])));

export function labSystem(name: string): string | null {
  return BY_KEY.get(testKey(name)) ?? null;
}

export type ReportSystem = { system: string; results: LabResult[]; flagged: boolean };

// The systems a report touches, in the order of the table, each with its
// results and whether any is outside its range. Tests in no system are
// kept apart, never dropped.
export function reportSystems(results: readonly LabResult[]): { systems: ReportSystem[]; whole: LabResult[] } {
  const by = new Map<string, LabResult[]>();
  const whole: LabResult[] = [];
  for (const r of results) {
    const system = labSystem(r.name);
    if (!system) {
      whole.push(r);
      continue;
    }
    by.set(system, [...(by.get(system) ?? []), r]);
  }
  const systems = Object.keys(TABLE)
    .filter((s) => by.has(s))
    .map((system) => ({ system, results: by.get(system)!, flagged: by.get(system)!.some(isOutside) }));
  return { systems, whole };
}
```

`src/lib/labCycle.ts`:

```ts
// Where she was in her cycle when a hormone was drawn, and which of the
// lab's phase ranges that points to.
//
// The cycle day is counted from the period she logged before the draw,
// and is not known when none lies within 45 days. The phase comes from the
// app's own rules: the observational one from phaseOf, and the clinical
// estimate from estimatedPhase, always shown as likely. Nothing here
// assumes a 28 day cycle when she has one of her own.

import { daysBetween, parseDay } from '../data/cycleLog';
import { type ClinicalPhase, type CycleWindow, estimatedPhase, type Phase, phaseOf, windowFor } from './cycleModel';
import { parseRange, testKey } from './labs';

const HORMONES = new Set(['estradiol', 'progesterone', 'lh', 'fsh', 'prolactin', 'testosterone', 'free testosterone', 'testosterone free']);

export const isCycleHormone = (name: string) => HORMONES.has(testKey(name));

export type CycleAt = { day: number; phase: Phase | null; likely: ClinicalPhase };

const MAX_DAYS = 45;

export function cycleDayAt(on: string, windows: CycleWindow[], usualLength: number | null): CycleAt | null {
  const date = parseDay(on);
  const w = windowFor(date, windows);
  if (!w) return null;
  const day = daysBetween(w.start, date) + 1;
  if (day < 1 || day > MAX_DAYS) return null;
  return { day, phase: phaseOf(date, w, usualLength), likely: estimatedPhase(day, usualLength) };
}

export function cycleLine(at: CycleAt | null): string {
  if (!at) return 'Cycle day at this test is not known. Log your periods to see it.';
  return at.phase ? `Cycle day ${at.day}, ${at.phase.toLowerCase()}` : `Cycle day ${at.day}`;
}

export type PhaseRange = { phase: string; text: string; low: number | null; high: number | null };

const PHASE_WORDS = ['follicular', 'ovulation', 'ovulatory', 'mid cycle', 'midcycle', 'luteal', 'postmenopausal', 'menopausal'];

// "Follicular 12.5 to 166 / Luteal 43.8 to 211": the lab's ranges by
// phase. Fewer than two named phases is one plain range, not this.
export function phaseRanges(text: string | null): PhaseRange[] {
  if (!text) return [];
  const out: PhaseRange[] = [];
  for (const part of text.split(/[\/;\n]/)) {
    const m = part.trim().match(/^([A-Za-z][A-Za-z ]*?)\s*(?:phase)?\s*[:\s]\s*([<>≤≥]?\s*\d.*)$/);
    if (!m) continue;
    const label = m[1].trim();
    if (!PHASE_WORDS.includes(label.toLowerCase())) continue;
    const range = m[2].trim();
    out.push({ phase: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(), text: range, ...parseRange(range) });
  }
  return out.length >= 2 ? out : [];
}

const FOR_PHASE: Record<ClinicalPhase, string[]> = {
  Menstrual: ['follicular'],
  Follicular: ['follicular'],
  Ovulatory: ['ovulation', 'ovulatory', 'mid cycle', 'midcycle'],
  Luteal: ['luteal'],
};

export function chosenRange(ranges: PhaseRange[], likely: ClinicalPhase | null): PhaseRange | null {
  if (!likely) return null;
  return ranges.find((r) => FOR_PHASE[likely].includes(r.phase.toLowerCase())) ?? null;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/labViews.test.ts src/lib/labs.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npm test`
Expected: silent typecheck, all tests pass.

```bash
git add src/lib/labs.ts src/lib/labSystems.ts src/lib/labCycle.ts src/lib/labViews.test.ts
git commit -m "Lab views: one name per test across labs, change since last, body systems by table, cycle day and phase ranges at a draw"
```

---

### Task 2: The report at a glance

**Files:**
- Create: `ciatta-mobile-app/src/lib/labReport.ts`
- Test: `ciatta-mobile-app/src/lib/labReport.test.ts`
- Modify: `ciatta-mobile-app/src/lib/labHandoff.ts`
- Modify: `ciatta-mobile-app/src/data/repo.ts`
- Create: `ciatta-mobile-app/src/screens/LabReportScreen.tsx`
- Modify: `ciatta-mobile-app/src/navigation.ts`, `ciatta-mobile-app/src/Root.tsx`
- Modify: `ciatta-mobile-app/src/ui/RecordsView.tsx`
- Modify: `ciatta-mobile-app/src/screens/AddLabsScreen.tsx`

**Interfaces:**
- Consumes: `groupByPanel`, `isOutside`, `labStatus`, `LabResult` (`labs.ts`); `repo.loadLabs`, `repo.removeLabReport`.
- Produces:
  - `type ReportKey = { documentId: string | null; on: string; lab: string | null }`
  - `reportResults(labs: readonly LabResult[], key: ReportKey): LabResult[]`
  - `countLine(results: readonly LabResult[]): string`
  - `reportPanels(results: readonly LabResult[]): { title: string; items: LabResult[] }[]`
  - `chooseReport(key: ReportKey)` and `chosenReport(): ReportKey | null` in `labHandoff.ts`
  - `repo.labReportFile(documentId: string): Promise<string | null>` (a signed URL)
  - Screen `'labReport'`

- [ ] **Step 1: Write the failing tests**

`src/lib/labReport.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LabResult } from './labs';
import { countLine, reportPanels, reportResults } from './labReport';

const r = (over: Partial<LabResult>): LabResult => ({
  id: Math.random().toString(16).slice(2),
  name: 'TSH',
  value: 2,
  valueText: null,
  unit: null,
  low: 0.4,
  high: 4,
  rangeText: '0.4 to 4.0',
  flag: null,
  status: 'final',
  source: 'report',
  lab: 'Quest',
  on: '2026-06-12',
  documentId: 'doc1',
  panel: null,
  ...over,
});

test('a report opens on its own results; a provider draw on the same day keeps its own', () => {
  const labs = [
    r({ id: 'a', documentId: 'doc1' }),
    r({ id: 'b', documentId: 'doc2' }),
    r({ id: 'c', documentId: null, source: 'provider' }),
    r({ id: 'd', documentId: null, source: 'provider', on: '2026-06-13' }),
  ];
  assert.deepEqual(reportResults(labs, { documentId: 'doc1', on: '2026-06-12', lab: 'Quest' }).map((x) => x.id), ['a']);
  assert.deepEqual(reportResults(labs, { documentId: null, on: '2026-06-12', lab: 'Quest' }).map((x) => x.id), ['c']);
});

test('the count line says what is high, low, in range and without a range, leaving out what is none', () => {
  const rs = [
    r({ value: 5 }),
    r({ value: 9 }),
    r({ value: 0.1 }),
    r({ value: 2 }),
    r({ value: 1, low: null, high: null, rangeText: null }),
    r({ value: 1, flag: 'HH' }),
  ];
  assert.equal(countLine(rs), '3 high, 1 low, 1 in range, 1 with no range given');
  assert.equal(countLine([r({ value: 2 })]), '1 in range');
  assert.equal(countLine([r({ value: null, valueText: 'Positive', flag: 'A' })]), '1 abnormal');
});

test('panels keep their printed order, and results outside range come first in each', () => {
  const rs = [
    r({ id: 'h', name: 'Hemoglobin', panel: 'CBC', value: 13, low: 12, high: 15.5 }),
    r({ id: 't', name: 'TSH', panel: 'Thyroid' }),
    r({ id: 'w', name: 'WBC', panel: 'CBC', value: 2, low: 4, high: 11 }),
  ];
  assert.deepEqual(reportPanels(rs).map((p) => [p.title, p.items.map((x) => x.id)]), [
    ['CBC', ['w', 'h']],
    ['Thyroid', ['t']],
  ]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/labReport.test.ts`
Expected: FAIL, `./labReport` cannot be found.

- [ ] **Step 3: Implement the rules and the handoff**

`src/lib/labReport.ts`:

```ts
// One report, as the report screen shows it: which results belong to it,
// the count line, and its panels with what is outside range first.

import { groupByPanel, isOutside, type LabResult, labStatus } from './labs';

export type ReportKey = { documentId: string | null; on: string; lab: string | null };

// A report she added owns exactly the results read from it. A provider
// draw, which has no document, is the provider results of that day at that
// lab.
export function reportResults(labs: readonly LabResult[], key: ReportKey): LabResult[] {
  if (key.documentId) return labs.filter((l) => l.documentId === key.documentId);
  return labs.filter((l) => !l.documentId && l.on === key.on && (l.lab ?? null) === (key.lab ?? null));
}

export function countLine(results: readonly LabResult[]): string {
  let high = 0;
  let low = 0;
  let inRange = 0;
  let none = 0;
  let abnormal = 0;
  for (const r of results) {
    const k = labStatus(r).key;
    if (k === 'high' || k === 'criticalHigh') high++;
    else if (k === 'low' || k === 'criticalLow') low++;
    else if (k === 'inRange') inRange++;
    else if (k === 'abnormal') abnormal++;
    else none++;
  }
  return [
    high ? `${high} high` : null,
    low ? `${low} low` : null,
    abnormal ? `${abnormal} abnormal` : null,
    inRange ? `${inRange} in range` : null,
    none ? `${none} with no range given` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function reportPanels(results: readonly LabResult[]): { title: string; items: LabResult[] }[] {
  return groupByPanel(results.map((r) => ({ ...r, panel: r.panel ?? null }))).map((g) => ({
    title: g.title,
    items: [...g.items.filter(isOutside), ...g.items.filter((r) => !isOutside(r))],
  }));
}
```

Append to `src/lib/labHandoff.ts`:

```ts
// Which report the report screen opens on, left here by the row or the
// save that opened it.
import type { ReportKey } from './labReport';

let report: ReportKey | null = null;

export const chooseReport = (key: ReportKey) => {
  report = key;
};

export const chosenReport = () => report;
```

Put that `import` at the top of the file, not mid file.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/labReport.test.ts`
Expected: PASS.

- [ ] **Step 5: The original file, the screen, and the ways in**

In `src/data/repo.ts`, add to the interface after `removeLabReport`:

```ts
  // A short lived private link to the report's original file.
  labReportFile(documentId: string): Promise<string | null>;
```

Demo repo: `labReportFile: async () => null,`

Real repo:

```ts
    async labReportFile(documentId) {
      const rows = must(await db.from('documents').select('storage_path').eq('id', documentId).limit(1)) as { storage_path: string }[] | null;
      const path = rows?.[0]?.storage_path;
      if (!path) return null;
      const { data, error } = await db.storage.from('documents').createSignedUrl(path, 600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
```

`src/screens/LabReportScreen.tsx`:

```tsx
// One lab report: the whole of it at a glance. The count of what is high,
// low and in range, each panel with what is outside range first, and the
// original file one tap away. Everything here is drawn from the results
// saved from the report; nothing is interpreted.

import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { chooseLab, chosenReport } from '../lib/labHandoff';
import { countLine, reportPanels, reportResults } from '../lib/labReport';
import { type LabResult, labDay } from '../lib/labs';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, EmptyNote, SecondaryButton } from '../ui/kit';
import { LabRangeBar, LabStatusTag } from '../ui/labs';
import { G } from '../ui/scheme';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

export function LabReportScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [key] = useState(() => chosenReport());
  const [labs, setLabs] = useState<LabResult[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    repo.loadLabs().then(setLabs).catch(() => setLabs([]));
  }, [repo]);

  const results = useMemo(() => (key && labs ? reportResults(labs, key) : []), [key, labs]);
  const panels = useMemo(() => reportPanels(results), [results]);
  const clinician = null;

  const openOriginal = useCallback(async () => {
    if (!key?.documentId) return;
    const url = await repo.labReportFile(key.documentId);
    if (!url) {
      setNote('The original could not be opened just now.');
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  }, [key, repo]);

  const remove = useCallback(() => {
    if (!key?.documentId) return;
    Alert.alert(
      'Remove this report?',
      'This report and the results read from it are removed from Ciatta. Your records at your provider are not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void repo
              .removeLabReport(key.documentId!)
              .then(() => nav.back())
              .catch(() => setNote('The report could not be removed just now. Nothing was changed.')),
        },
      ],
    );
  }, [key, repo, nav]);

  if (!key || (labs && !results.length)) {
    return (
      <DetailScreen title="Lab Report" onBack={nav.back}>
        {labs ? <EmptyNote text="This report has no results." /> : null}
      </DetailScreen>
    );
  }

  return (
    <DetailScreen title={key.lab ?? 'Lab Report'} onBack={nav.back}>
      <Text style={[font('caption1'), s.meta]}>{displayCopy(`Collected ${labDay(key.on)}${clinician ? `, ordered by ${clinician}` : ''}`)}</Text>
      <Text style={[font('title3', 'semibold'), s.count]}>{displayCopy(countLine(results))}</Text>
      {key.documentId ? (
        <Pressable onPress={() => void openOriginal()} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={[font('subhead', 'semibold'), s.link]}>View original</Text>
        </Pressable>
      ) : (
        <Text style={[font('caption1'), s.meta]}>From your provider</Text>
      )}
      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 8 }]}>{displayCopy(note)}</Text> : null}

      {panels.map((panel) => (
        <View key={panel.title} style={{ marginTop: SPACE.block }}>
          <Eyebrow>{displayCopy(panel.title)}</Eyebrow>
          <View style={s.card}>
            <CardFill />
            {panel.items.map((r, n) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  chooseLab(r.name);
                  nav.push('lab');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [s.row, n > 0 && s.divided, pressed && { opacity: 0.6 }]}
              >
                <View style={s.top}>
                  <Text style={[font('subhead'), s.ink, { flex: 1 }]} numberOfLines={2}>
                    {displayCopy(r.name)}
                  </Text>
                  <Text style={[font('subhead', 'semibold'), s.ink]}>
                    {r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : displayCopy(r.valueText ?? '')}
                  </Text>
                </View>
                <View style={s.top}>
                  <LabStatusTag result={r} small />
                  <View style={{ flex: 1, maxWidth: 140 }}>
                    <LabRangeBar result={r} height={4} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* PART 2 SECTIONS (Tasks 3 to 5 add trends, body systems and the cycle here) */}

      {key.documentId ? (
        <View style={{ marginTop: SPACE.section }}>
          <SecondaryButton label="Remove This Report" onPress={remove} />
        </View>
      ) : null}
      <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near, lineHeight: 18 }]}>Ranges are each lab's own.</Text>
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  meta: { color: G.meta },
  ink: { color: L.ink },
  count: { color: G.ink, marginTop: 6, marginBottom: 6 },
  link: { color: G.ink, textDecorationLine: 'underline', marginTop: 4 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, paddingHorizontal: 14, overflow: 'hidden' },
  row: { paddingVertical: 12, gap: 6 },
  divided: { borderTopWidth: st, borderTopColor: G.rule },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
```

Register the screen:
- In `src/navigation.ts`, add `| 'labReport'` after `| 'lab'`.
- In `src/Root.tsx`, import `LabReportScreen` and add `labReport: LabReportScreen,` next to `addLabs: AddLabsScreen,`.

In `src/ui/RecordsView.tsx` `LabsSection`, wrap the two draw heading `Text` lines in a `Pressable` that opens the report:

```tsx
          <Pressable
            onPress={() => {
              chooseReport({ documentId: d.results.find((x) => x.documentId)?.documentId ?? null, on: d.on, lab: d.lab });
              onOpen('labReport');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open the report from ${labDay(d.on)}`}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            ...the two existing Text lines unchanged...
          </Pressable>
```

Import `chooseReport` from `../lib/labHandoff`, next to `chooseLab`.

In `src/screens/AddLabsScreen.tsx` `save`, replace `nav.back();` with:

```tsx
      chooseReport({ documentId: id, on, lab: lab.trim() || null });
      nav.back();
      nav.push('labReport');
```

Capture the id with `const id = await repo.saveLabReport({...});`, and import `chooseReport` from `../lib/labHandoff`.

- [ ] **Step 6: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass.

```bash
git add src/lib/labReport.ts src/lib/labReport.test.ts src/lib/labHandoff.ts src/data/repo.ts src/screens/LabReportScreen.tsx src/navigation.ts src/Root.tsx src/ui/RecordsView.tsx src/screens/AddLabsScreen.tsx
git commit -m "Lab report screen: the whole report at a glance, by panel, outside range first, with the original one tap away; opened from Records and after saving"
```

---

### Task 3: Trends

**Files:**
- Modify: `ciatta-mobile-app/src/screens/LabDetailScreen.tsx`
- Modify: `ciatta-mobile-app/src/screens/LabReportScreen.tsx`

**Interfaces:**
- Consumes: `changeSinceLast`, `labHistory` (Task 1).

- [ ] **Step 1: The change line and source shapes on one test**

In `LabDetailScreen`:
- Import `changeSinceLast` from `../lib/labs`.
- Directly after the `LabStatusTag` / basis lines, add:

```tsx
      <Text style={[font('subhead'), s.body, { marginTop: 6 }]}>{displayCopy(changeSinceLast(history))}</Text>
```

- In `History`, replace the `pts.map((r) => <Circle .../>)` with a shape by source: a circle for a provider result, a square for a report.

```tsx
            {pts.map((r) =>
              r.source === 'report' ? (
                <Rect key={r.id} x={x(r.on) - 4.5} y={y(r.value!) - 4.5} width={9} height={9} rx={2} fill={STATUS_COLOR[labStatus(r).key]} />
              ) : (
                <Circle key={r.id} cx={x(r.on)} cy={y(r.value!)} r={5} fill={STATUS_COLOR[labStatus(r).key]} />
              ),
            )}
```

- Under the shaded caption, add a legend line, shown only when both sources are present:

```tsx
      {pts.some((r) => r.source === 'report') && pts.some((r) => r.source === 'provider') ? (
        <Text style={[font('caption1'), s.meta, { marginTop: 4 }]}>Squares were read from a report you added; circles came from your provider.</Text>
      ) : null}
```

- [ ] **Step 2: Panel trends on the report**

In `LabReportScreen`, add a `MiniTrend` component and a **Panel trends** section, replacing the marker comment's first role. Keep the comment line itself for Tasks 4 and 5, as `{/* PART 2 SECTIONS: body systems and cycle follow */}`.

```tsx
const MINI_H = 44;

function MiniTrend({ history }: { history: LabResult[] }) {
  const [width, setWidth] = useState(0);
  const pts = history.filter((h) => h.value != null);
  const lo = Math.min(...pts.map((p) => p.value!));
  const hi = Math.max(...pts.map((p) => p.value!));
  const t0 = Date.parse(pts[0].on);
  const t1 = Date.parse(pts[pts.length - 1].on);
  const x = (on: string) => 4 + (t1 === t0 ? 0.5 : (Date.parse(on) - t0) / (t1 - t0)) * (width - 8);
  const y = (v: number) => 4 + (hi === lo ? 0.5 : 1 - (v - lo) / (hi - lo)) * (MINI_H - 8);
  return (
    <View style={{ height: MINI_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width ? (
        <Svg width={width} height={MINI_H}>
          <Polyline points={pts.map((p) => `${x(p.on)},${y(p.value!)}`).join(' ')} fill="none" stroke={L.meta} strokeWidth={1.5} />
          {pts.map((p) => (
            <Circle key={p.id} cx={x(p.on)} cy={y(p.value!)} r={3} fill={STATUS_COLOR[labStatus(p).key]} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
```

The section, placed before the marker comment:

```tsx
      {trends.length ? (
        <View style={{ marginTop: SPACE.block }}>
          <Eyebrow>Panel trends</Eyebrow>
          {trends.map((panel) => (
            <View key={panel.title} style={s.card}>
              <CardFill />
              <Text style={[font('footnote', 'semibold'), s.ink, { marginTop: 12 }]}>{displayCopy(panel.title)}</Text>
              <View style={s.grid}>
                {panel.items.map(({ result, history }) => (
                  <View key={result.id} style={s.cell}>
                    <Text style={[font('caption2'), s.meta]} numberOfLines={1}>
                      {displayCopy(result.name)}
                    </Text>
                    <MiniTrend history={history} />
                    <Text style={[font('caption2'), s.meta]} numberOfLines={1}>
                      {displayCopy(changeSinceLast(history))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
```

Compute `trends` with `useMemo`, after `panels`:

```tsx
  const trends = useMemo(
    () =>
      panels
        .map((p) => ({
          title: p.title,
          items: p.items
            .map((result) => ({ result, history: labHistory(labs ?? [], result.name).filter((h) => h.value != null) }))
            .filter((t) => t.history.length >= 2),
        }))
        .filter((p) => p.items.length),
    [panels, labs],
  );
```

Add imports: `Svg, { Circle, Polyline } from 'react-native-svg'`; `changeSinceLast`, `labHistory`, `labStatus` from `../lib/labs`; `STATUS_COLOR` from `../ui/labs`.

Add styles:

```ts
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 10 },
  cell: { width: '47%', gap: 2 },
```

- [ ] **Step 3: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass.

```bash
git add src/screens/LabDetailScreen.tsx src/screens/LabReportScreen.tsx
git commit -m "Lab trends: change since last on each test, report and provider results drawn by shape, panel trends on the report"
```

---

### Task 4: Body systems on the report

**Files:**
- Modify: `ciatta-mobile-app/src/screens/LabReportScreen.tsx`

**Interfaces:**
- Consumes: `reportSystems` (Task 1), `SYSTEM_DOTS` (`lib/bodyMap.ts`), `images.body` (`ui/images.ts`), `HUE` (`ui/surface`).

- [ ] **Step 1: The section**

Add a `BodySystems` component to `LabReportScreen.tsx`:

```tsx
const FIGURE_H = 300;
const FIGURE_W = FIGURE_H * (850 / 1850);

// The figure with a dot for each system this report touches, ringed where
// a result is outside its range, and a row per system that opens its
// results. Tests in no system are listed under Whole Body.
function BodySystems({ results }: { results: LabResult[] }) {
  const { systems, whole } = useMemo(() => reportSystems(results), [results]);
  const [open, setOpen] = useState<string | null>(null);
  if (!systems.length && !whole.length) return null;
  const rows = [...systems.map((x) => ({ key: x.system, results: x.results, flagged: x.flagged })), ...(whole.length ? [{ key: WHOLE_BODY, results: whole, flagged: whole.some(isOutside) }] : [])];
  return (
    <View style={{ marginTop: SPACE.block }}>
      <Eyebrow>Body systems</Eyebrow>
      <View style={[s.card, s.bodyCard]}>
        <CardFill />
        <View style={{ width: FIGURE_W, height: FIGURE_H }}>
          <Image source={images.body} style={{ width: FIGURE_W, height: FIGURE_H, opacity: 0.85 }} resizeMode="contain" accessibilityIgnoresInvertColors />
          {systems.map((x) => {
            const dot = SYSTEM_DOTS[x.system];
            if (!dot) return null;
            return (
              <View
                key={x.system}
                style={[
                  s.dot,
                  { left: (dot.x / 100) * FIGURE_W - 7, top: (dot.y / 100) * FIGURE_H - 7, backgroundColor: dot.color },
                  x.flagged && { borderColor: HUE.attention, borderWidth: 3 },
                ]}
              />
            );
          })}
        </View>
        <View style={{ flex: 1 }}>
          {rows.map((row, n) => (
            <View key={row.key}>
              <Pressable
                onPress={() => setOpen((o) => (o === row.key ? null : row.key))}
                accessibilityRole="button"
                accessibilityState={{ expanded: open === row.key }}
                style={({ pressed }) => [s.sysRow, n > 0 && s.divided, pressed && { opacity: 0.6 }]}
              >
                <View style={[s.swatch, { backgroundColor: SYSTEM_DOTS[row.key]?.color ?? L.meta }]} />
                <Text style={[font('subhead'), s.ink, { flex: 1 }]}>{row.key}</Text>
                <Text style={[font('caption1'), row.flagged ? s.flag : s.meta]}>
                  {row.flagged ? `${row.results.filter(isOutside).length} outside` : `${row.results.length}`}
                </Text>
              </Pressable>
              {open === row.key
                ? row.results.map((r) => (
                    <View key={r.id} style={s.sysResult}>
                      <Text style={[font('caption1'), s.ink, { flex: 1 }]} numberOfLines={1}>
                        {displayCopy(r.name)}
                      </Text>
                      <LabStatusTag result={r} small />
                    </View>
                  ))
                : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
```

Render `<BodySystems results={results} />` at the marker comment.

Add imports: `Image` from `react-native`; `reportSystems` from `../lib/labSystems`; `SYSTEM_DOTS`, `WHOLE_BODY` from `../lib/bodyMap`; `isOutside` from `../lib/labs`; `images` from `../ui/images`; `HUE` from `../ui/surface`.

Add styles:

```ts
  bodyCard: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  sysRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  flag: { color: HUE.attention },
  sysResult: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingBottom: 8 },
```

- [ ] **Step 2: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass.

```bash
git add src/screens/LabReportScreen.tsx
git commit -m "Lab report: body systems the report touches, ringed where a result is outside range, each opening its results"
```

---

### Task 5: The cycle overlay

**Files:**
- Modify: `ciatta-mobile-app/src/screens/LabReportScreen.tsx`
- Modify: `ciatta-mobile-app/src/screens/LabDetailScreen.tsx`

**Interfaces:**
- Consumes: `isCycleHormone`, `cycleDayAt`, `cycleLine`, `phaseRanges`, `chosenRange` (Task 1); `useCycleInsights()` from `src/state/cycleStore.tsx` (`windows`, `profile`); `medianLength`, `countedWindows`, `estimatedPhaseLabel` from `cycleModel.ts`.

- [ ] **Step 1: A shared hook for the cycle at a day**

Add to `src/lib/labCycle.ts`:

```ts
export function phaseRangeLine(ranges: PhaseRange[], chosen: PhaseRange | null, likelyLabel: string | null): string {
  if (!ranges.length) return '';
  const list = ranges.map((r) => `${r.phase} ${r.text}`).join(', ');
  return chosen && likelyLabel ? `${likelyLabel}: ${chosen.phase} range ${chosen.text}. All printed: ${list}` : `Printed by phase: ${list}`;
}
```

Add a test to `src/lib/labViews.test.ts` (import `phaseRangeLine`):

```ts
test('the phase range line names the likely one and still shows every printed range', () => {
  const ranges = phaseRanges('Follicular 12.5 to 166 / Luteal 43.8 to 211');
  assert.equal(phaseRangeLine(ranges, ranges[1], 'Likely luteal'), 'Likely luteal: Luteal range 43.8 to 211. All printed: Follicular 12.5 to 166, Luteal 43.8 to 211');
  assert.equal(phaseRangeLine(ranges, null, null), 'Printed by phase: Follicular 12.5 to 166, Luteal 43.8 to 211');
  assert.equal(phaseRangeLine([], null, null), '');
});
```

Run: `npx tsx --test src/lib/labViews.test.ts`. Expected: FAIL (not exported), then implement, then PASS.

- [ ] **Step 2: On the report**

In `LabReportScreen`:
- Read the cycle once:

```tsx
  const { windows, profile } = useCycleInsights();
  const usual = useMemo(() => medianLength(countedWindows(windows, profile)), [windows, profile]);
  const cycle = useMemo(() => (key ? cycleDayAt(key.on, windows, usual) : null), [key, windows, usual]);
```

- In the panel row, under the status line, for hormone tests only:

```tsx
                {isCycleHormone(r.name) ? (
                  <View style={{ gap: 2 }}>
                    <Text style={[font('caption1'), s.meta]}>{displayCopy(cycleLine(cycle))}</Text>
                    {phaseRanges(r.rangeText).length ? (
                      <Text style={[font('caption1'), s.meta]}>
                        {displayCopy(
                          phaseRangeLine(
                            phaseRanges(r.rangeText),
                            chosenRange(phaseRanges(r.rangeText), cycle?.likely ?? null),
                            cycle ? estimatedPhaseLabel(cycle.likely) : null,
                          ),
                        )}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
```

- Imports: `useCycleInsights` from `../state/cycleStore`; `countedWindows`, `estimatedPhaseLabel`, `medianLength` from `../lib/cycleModel`; `chosenRange`, `cycleDayAt`, `cycleLine`, `isCycleHormone`, `phaseRangeLine`, `phaseRanges` from `../lib/labCycle`.

- [ ] **Step 3: On one test's history**

In `LabDetailScreen`, when `isCycleHormone(latest.name)`, add the cycle day to each row of **Every result**, after the source line:

```tsx
              {hormone ? <Text style={[font('caption1'), s.meta]}>{displayCopy(cycleLine(cycleDayAt(r.on, windows, usual)))}</Text> : null}
```

Add the same three hook lines as on the report (`useCycleInsights`, `usual`), plus `const hormone = latest ? isCycleHormone(latest.name) : false;`. Place them before any early return, because hooks must not be called conditionally.

Also add a line under the chart for hormone tests: "Each result was drawn on a different day of your cycle, so a change here may be the cycle and not a trend."

- [ ] **Step 4: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass.

```bash
git add src/lib/labCycle.ts src/lib/labViews.test.ts src/screens/LabReportScreen.tsx src/screens/LabDetailScreen.tsx
git commit -m "Cycle overlay: hormone results show the cycle day at the draw and the likely phase range, or say it is not known"
```

- [ ] **Step 5: Try it**

With the demo person (Look Around First), in a development build or the simulator:
- Add a report (Part 1 Task 6 Step 5). The Report screen opens with the count line and panels.
- Open Records → Labs, then a draw heading. The same screen opens for that draw.
- Check Panel trends appears for tests with two or more results, Body systems lights Circulatory for Ferritin, and a hormone test shows a cycle line.

If no build can be driven in this session, ledger it for the user's phone run.

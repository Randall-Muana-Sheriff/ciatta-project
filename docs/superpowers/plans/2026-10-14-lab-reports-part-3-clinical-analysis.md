# Lab Reports Part 3: Clinical AI Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every report she adds gets a full clinical read from an AI model: urgent findings, summary, findings, patterns, conditions to consider, next tests and questions. Every number and test it names is checked against her record before it is stored or shown, and it is labelled as AI and not a diagnosis.

**Architecture:** A new `lab-analysis` edge function runs as her. It:
1. claims one of the day's 20 analyses
2. gathers facts from her rows
3. calls the model with a strict JSON schema
4. checks the answer with a pure `checkAnalysis`, and retries once with the reasons
5. stores the result through a security definer RPC

The pure parts (`facts.ts`, `check.ts`, `keys.ts`) live in the function's directory and are tested from the app's suite. The app reads the stored analysis, runs it after saving, flags it as out of date with a fingerprint computed the same way on both sides, and shows it on the report screen.

**Tech Stack:** Supabase Edge Functions (Deno), OpenAI chat completions with JSON schema, Postgres + pgTAP, Expo 57 / React Native, expo-print.

**Spec:** `docs/superpowers/specs/2026-10-14-lab-reports-and-clinical-analysis-design.md` (Part 3).

## Spec amendments carried by this plan

- **The cycle at the draw is sent by the app**, which already computes it (`cycleDayAt`, Part 2), rather than rebuilt in the function from her episodes. The function accepts it only as `{ day: integer 1..45, phase: one of the four observational phases or null, usual_length: integer 15..90 or null }` and otherwise treats it as unknown. It is her own data, and it is used only as a fact.
- **Analysis is for reports she added** (a `documents` row). Provider draws have no document to hang it on, so they are shown without an analysis in this plan. `lab_analyses.document_id` is not null.
- **Out of date** is decided by a fingerprint of the report's results and her earlier results for the same tests. It is computed identically by the app (`src/lib/labAnalysis.ts`) and the function (`facts.ts`), and pinned by a parity test.
- **Conditions to consider can be switched off** with the function secret `LAB_ANALYSIS_CONSIDERATIONS=off`, which drops that section before storing (Spec, Risks).
- **Local testing without OpenAI.** With `LAB_ANALYSIS_FAKE_MODEL=1` and only when `SUPABASE_URL` is local (`127.0.0.1`, `localhost` or `kong`), the request header `x-fake-model: good | bad-then-good | always-bad` replaces the model call.

## Global Constraints

- Run app commands from `ciatta-mobile-app/`. `npm test`, `npx tsc --noEmit`, `supabase test db`.
- An edge function imports only files in its own directory.
- UI copy has no em dash, en dash or hyphen. Model text renders through `displayCopy()`.
- Keep Jost and the existing design. Everything sits on Ground (`DetailScreen`).
- Health data is never logged: counts, the model name and rejection reasons only.
- Runs as her: the function's database client carries her JWT. The only definer code is `store_lab_analysis`, which checks the document is hers.
- Label, always visible: "Clinical AI analysis. Not a diagnosis. Discuss it with your clinician."

## Review Focus

1. **A model answer that quotes a value wrong by a digit** (Ferritin 80 for 8). She expects it never to reach her. Pinned in Task 1 (`checkAnalysis` value test).
2. **A model answer that tells her to stop a medication or names a dose.** It is rejected. Pinned in Task 1.
3. **A critical result (HH, LL, AA) with an answer whose urgent list is empty.** It is rejected, and the banner still shows from the lab's flags. Pinned in Task 1 (`checkAnalysis`) and Task 4 (`criticalResults`).
4. **Someone else's report id sent to the function.** Nothing is read or stored. Pinned in Task 3 (the end to end check) and Task 2 (`store_lab_analysis` refuses).
5. **Her results change after the analysis** (an earlier result arrives for the same test). She expects "Your results have changed since this was written". Pinned in Task 4 (`analysisStale`, and the parity of the two fingerprints).

---

### Task 1: The pure parts: facts, checking, keys

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/lab-analysis/keys.ts`
- Create: `ciatta-mobile-app/supabase/functions/lab-analysis/facts.ts`
- Create: `ciatta-mobile-app/supabase/functions/lab-analysis/check.ts`
- Test: `ciatta-mobile-app/src/lib/labAnalysisCheck.test.ts`

**Interfaces:**
- Produces:
  - In `keys.ts`: `testKey(name: string): string`, the same folding and table as `src/lib/labs.ts`. The parity test lives in Task 4.
  - In `facts.ts`:
    - `type FactTest = { name: string; value: number | null; value_text: string | null; unit: string | null; range: string | null; low: number | null; high: number | null; flag: string | null; panel: string | null }`
    - `type Facts = { collected_on: string; lab: string | null; tests: FactTest[]; earlier: { name: string; results: { on: string; value: number | null; value_text: string | null; unit: string | null }[] }[]; cycle: { day: number; phase: string | null; usual_length: number | null } | null; profile: { age_range: string | null; life_stage: string | null; gender: string | null }; conditions: string[]; medications: string[]; supplements: string[]; symptoms: { name: string; count: number }[] }`
    - `readCycle(raw: unknown): Facts['cycle']`
    - `fingerprint(tests: { name: string; value: number | null; value_text: string | null; unit: string | null; on: string }[]): string`
  - In `check.ts`:
    - `type Analysis = { urgent: { test: string; value: string; reason: string; action: 'contact_today' | 'urgent_care' }[]; summary: string; findings: { test: string; value: string; explanation: string; common_causes: string[]; relevance: string | null }[]; patterns: { title: string; tests: string[]; explanation: string }[]; considerations: { condition: string; tests: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[]; next_tests: { test: string; reason: string }[]; questions: string[] }`
    - `readAnalysis(json: unknown): Analysis | null`
    - `checkAnalysis(a: Analysis, facts: Facts): string[]` (empty means it passes)
    - `ANALYSIS_SCHEMA` (strict JSON schema)

- [ ] **Step 1: Write the failing tests**

`src/lib/labAnalysisCheck.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Analysis, checkAnalysis, readAnalysis } from '../../supabase/functions/lab-analysis/check.ts';
import { type Facts, fingerprint, readCycle } from '../../supabase/functions/lab-analysis/facts.ts';

const facts: Facts = {
  collected_on: '2026-06-12',
  lab: 'Quest',
  tests: [
    { name: 'Ferritin', value: 8, value_text: null, unit: 'ng/mL', range: '15 to 150', low: 15, high: 150, flag: 'L', panel: 'Iron' },
    { name: 'Hemoglobin', value: 11.2, value_text: null, unit: 'g/dL', range: '12.0 to 15.5', low: 12, high: 15.5, flag: 'L', panel: 'CBC' },
    { name: 'Glucose', value: 92, value_text: null, unit: 'mg/dL', range: '70 to 99', low: 70, high: 99, flag: null, panel: 'CMP' },
  ],
  earlier: [{ name: 'Ferritin', results: [{ on: '2026-01-10', value: 22, value_text: null, unit: 'ng/mL' }] }],
  cycle: { day: 3, phase: 'During period', usual_length: 29 },
  profile: { age_range: '30 to 39', life_stage: null, gender: 'woman' },
  conditions: ['Endometriosis'],
  medications: ['Levothyroxine'],
  supplements: [],
  symptoms: [{ name: 'Fatigue', count: 6 }],
};

const good = (): Analysis => ({
  urgent: [],
  summary: 'Your ferritin of 8 ng/mL and hemoglobin of 11.2 g/dL are both below the lab range.',
  findings: [
    {
      test: 'Ferritin',
      value: '8 ng/mL',
      explanation: 'Ferritin reflects stored iron. It was 22 in January and is 8 now, below the range of 15 to 150.',
      common_causes: ['Heavy menstrual bleeding', 'Low dietary iron'],
      relevance: 'You logged fatigue 6 times in the month before this test, and heavy periods with endometriosis can lower iron.',
    },
  ],
  patterns: [{ title: 'Low iron stores with low hemoglobin', tests: ['Ferritin', 'Hemoglobin'], explanation: 'Together these fit iron deficiency anemia.' }],
  considerations: [{ condition: 'Iron deficiency anemia', tests: ['Ferritin', 'Hemoglobin'], confidence: 'high', how_confirmed: 'A clinician can confirm with iron studies and a repeat CBC.' }],
  next_tests: [{ test: 'Iron panel with TIBC', reason: 'To confirm low iron and see transferrin saturation.' }],
  questions: ['Could my periods explain my low ferritin?'],
});

test('a faithful analysis passes', () => {
  assert.deepEqual(checkAnalysis(good(), facts), []);
});

test('a test the record does not have is refused', () => {
  const a = good();
  a.findings[0].test = 'Vitamin D';
  assert.match(checkAnalysis(a, facts).join(' '), /Vitamin D/);
});

test('a value quoted wrong is refused', () => {
  const a = good();
  a.findings[0].value = '80 ng/mL';
  assert.ok(checkAnalysis(a, facts).length > 0);
});

test('a number in the text that is in no fact is refused', () => {
  const a = good();
  a.summary = 'Your ferritin has dropped 64 percent.';
  assert.match(checkAnalysis(a, facts).join(' '), /64/);
});

test('numbers inside test names and small counts are allowed', () => {
  const a = good();
  a.next_tests = [{ test: 'Vitamin B12 and free T4', reason: 'Check these 2 together with a 25 hydroxy vitamin D.' }];
  assert.deepEqual(checkAnalysis(a, facts), []);
});

test('a dose is refused, but a lab unit is not a dose', () => {
  const a = good();
  a.questions = ['Should I take 65 mg of iron a day?'];
  assert.match(checkAnalysis(a, facts).join(' '), /dose/i);
  const b = good();
  b.summary = 'Your glucose of 92 mg/dL is in range.';
  assert.deepEqual(checkAnalysis(b, facts), []);
});

test('telling her to start or stop a medication is refused', () => {
  const a = good();
  a.findings[0].relevance = 'You should stop taking Levothyroxine.';
  assert.match(checkAnalysis(a, facts).join(' '), /medication/i);
});

test('a critical result with nothing marked urgent is refused', () => {
  const critical: Facts = { ...facts, tests: [{ ...facts.tests[1], value: 6.1, flag: 'LL' }] };
  const a = good();
  a.summary = 'Your hemoglobin is 6.1 g/dL.';
  a.findings = [];
  a.patterns = [];
  a.considerations = [];
  assert.match(checkAnalysis(a, critical).join(' '), /urgent/i);
});

test('too many items is refused, so it stays readable', () => {
  const a = good();
  a.questions = Array.from({ length: 11 }, () => 'Could my periods explain my low ferritin?');
  assert.match(checkAnalysis(a, facts).join(' '), /questions/);
});

test('what the model returned is read into shape, and anything else is nothing', () => {
  assert.equal(readAnalysis(null), null);
  assert.equal(readAnalysis({ summary: 3 }), null);
  const read = readAnalysis({ ...good(), extra: 'ignored', considerations: [{ condition: 'X', tests: ['Ferritin'], confidence: 'certain', how_confirmed: 'y' }] });
  assert.equal(read?.considerations.length, 0, 'a confidence outside low, moderate or high drops that item');
});

test('the cycle the app sends is accepted only in its exact shape', () => {
  assert.deepEqual(readCycle({ day: 3, phase: 'During period', usual_length: 29 }), { day: 3, phase: 'During period', usual_length: 29 });
  assert.equal(readCycle({ day: 60, phase: null, usual_length: null }), null);
  assert.deepEqual(readCycle({ day: 3, phase: 'Luteal', usual_length: 200 }), { day: 3, phase: null, usual_length: null });
  assert.equal(readCycle('x'), null);
});

test('the fingerprint changes when a result does, and not when only the order does', () => {
  const a = [
    { name: 'Ferritin', value: 8, value_text: null, unit: 'ng/mL', on: '2026-06-12' },
    { name: 'HbA1c', value: 5.6, value_text: null, unit: '%', on: '2026-06-12' },
  ];
  assert.equal(fingerprint(a), fingerprint([...a].reverse()));
  assert.notEqual(fingerprint(a), fingerprint([{ ...a[0], value: 9 }, a[1]]));
  assert.equal(fingerprint([{ ...a[1], name: 'Hemoglobin A1c' }]), fingerprint([a[1]]), 'spellings of one test fingerprint alike');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/labAnalysisCheck.test.ts`
Expected: FAIL, `check.ts` cannot be found.

- [ ] **Step 3: Implement**

`supabase/functions/lab-analysis/keys.ts`: copy `LAB_ALIASES` and `testKey` from `src/lib/labs.ts` exactly, with this header:

```ts
// One name per test, whichever lab wrote it. A copy of testKey in
// src/lib/labs.ts, because a function can only import its own files; a
// parity test in the app's suite keeps the two the same.
```

`supabase/functions/lab-analysis/facts.ts`:

```ts
// The facts an analysis may use, and the fingerprint that says when they
// have changed. Pure; tested from the app's suite.

import { testKey } from './keys.ts';

export type FactTest = {
  name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  range: string | null;
  low: number | null;
  high: number | null;
  flag: string | null;
  panel: string | null;
};

export type Facts = {
  collected_on: string;
  lab: string | null;
  tests: FactTest[];
  earlier: { name: string; results: { on: string; value: number | null; value_text: string | null; unit: string | null }[] }[];
  cycle: { day: number; phase: string | null; usual_length: number | null } | null;
  profile: { age_range: string | null; life_stage: string | null; gender: string | null };
  conditions: string[];
  medications: string[];
  supplements: string[];
  symptoms: { name: string; count: number }[];
};

const PHASES = ['During period', 'Before period', 'After period', 'Between periods'];
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

// The cycle the app computed at the draw, taken only in its exact shape.
export function readCycle(raw: unknown): Facts['cycle'] {
  const c = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  const day = c ? int(c.day, 1, 45) : null;
  if (!c || day == null) return null;
  return {
    day,
    phase: typeof c.phase === 'string' && PHASES.includes(c.phase) ? c.phase : null,
    usual_length: int(c.usual_length, 15, 90),
  };
}

// What the analysis was written from: each result's test, value, unit and
// day, in a stable order. The same in the app (src/lib/labAnalysis.ts).
export function fingerprint(tests: { name: string; value: number | null; value_text: string | null; unit: string | null; on: string }[]): string {
  return tests
    .map((t) => `${testKey(t.name)}|${t.value ?? t.value_text ?? ''}|${(t.unit ?? '').trim().toLowerCase()}|${t.on}`)
    .sort()
    .join('\n');
}
```

`supabase/functions/lab-analysis/check.ts`:

```ts
// Reading what the model returned, and checking it against her record.
//
// Nothing the model says reaches her unchecked. An analysis is refused if
// it names a test she does not have, quotes a value that is not hers,
// carries a number that is in no fact, gives a dose, tells her to start or
// stop a medication, leaves a critical result out of urgent, or runs long.
// Pure; tested from the app's suite.

import type { Facts } from './facts.ts';
import { testKey } from './keys.ts';

export type Analysis = {
  urgent: { test: string; value: string; reason: string; action: 'contact_today' | 'urgent_care' }[];
  summary: string;
  findings: { test: string; value: string; explanation: string; common_causes: string[]; relevance: string | null }[];
  patterns: { title: string; tests: string[]; explanation: string }[];
  considerations: { condition: string; tests: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[];
  next_tests: { test: string; reason: string }[];
  questions: string[];
};

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(s).filter((x): x is string => !!x) : []);
const objs = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[] : []);

export function readAnalysis(json: unknown): Analysis | null {
  const j = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null;
  const summary = j ? s(j.summary) : null;
  if (!j || !summary) return null;
  return {
    summary,
    urgent: objs(j.urgent)
      .map((u) => ({ test: s(u.test), value: s(u.value), reason: s(u.reason), action: u.action }))
      .filter((u): u is Analysis['urgent'][number] => !!u.test && !!u.value && !!u.reason && (u.action === 'contact_today' || u.action === 'urgent_care')),
    findings: objs(j.findings)
      .map((f) => ({ test: s(f.test), value: s(f.value), explanation: s(f.explanation), common_causes: strs(f.common_causes), relevance: s(f.relevance) }))
      .filter((f): f is Analysis['findings'][number] => !!f.test && !!f.value && !!f.explanation),
    patterns: objs(j.patterns)
      .map((p) => ({ title: s(p.title), tests: strs(p.tests), explanation: s(p.explanation) }))
      .filter((p): p is Analysis['patterns'][number] => !!p.title && p.tests.length > 0 && !!p.explanation),
    considerations: objs(j.considerations)
      .map((c) => ({ condition: s(c.condition), tests: strs(c.tests), confidence: c.confidence, how_confirmed: s(c.how_confirmed) }))
      .filter(
        (c): c is Analysis['considerations'][number] =>
          !!c.condition && c.tests.length > 0 && !!c.how_confirmed && (c.confidence === 'low' || c.confidence === 'moderate' || c.confidence === 'high'),
      ),
    next_tests: objs(j.next_tests)
      .map((n) => ({ test: s(n.test), reason: s(n.reason) }))
      .filter((n): n is Analysis['next_tests'][number] => !!n.test && !!n.reason),
    questions: strs(j.questions),
  };
}

const LIMITS = { findings: 12, patterns: 8, considerations: 6, next_tests: 8, questions: 10 } as const;

// A number standing on its own, not part of a name like T4, B12 or A1c.
const NUMBER = /(?<![A-Za-z0-9.])\d+(?:\.\d+)?(?![A-Za-z0-9])/g;
const DOSE = /(?<![A-Za-z0-9.])\d+(?:\.\d+)?\s?(?:mg|mcg|µg|iu|units?|g)\b(?!\s*\/)/i;
const CHANGE_MED = /\b(?:start|stop|begin|discontinue|increase|decrease|reduce|raise|double|halve)\s+(?:taking\s+|using\s+|your\s+|the\s+|a\s+)*(?:\w+\s+){0,2}(?:medication|medicine|dose|dosage|prescription|pills?|tablets?)\b/i;

const numbersIn = (text: string) => [...text.matchAll(NUMBER)].map((m) => Number(m[0]));

export function checkAnalysis(a: Analysis, facts: Facts): string[] {
  const problems: string[] = [];
  const known = new Map<string, number[]>();
  const add = (name: string, v: number | null) => {
    const k = testKey(name);
    known.set(k, [...(known.get(k) ?? []), ...(v != null ? [v] : [])]);
  };
  for (const t of facts.tests) add(t.name, t.value);
  for (const e of facts.earlier) for (const r of e.results) add(e.name, r.value);

  // Every number the text may carry: values, ranges, dates, the cycle.
  const allowed = new Set<number>();
  for (const t of facts.tests) {
    for (const n of [t.value, t.low, t.high]) if (n != null) allowed.add(n);
    for (const n of numbersIn(t.range ?? '')) allowed.add(n);
  }
  for (const e of facts.earlier) for (const r of e.results) if (r.value != null) allowed.add(r.value);
  for (const d of [facts.collected_on, ...facts.earlier.flatMap((e) => e.results.map((r) => r.on))]) {
    for (const part of d.split('-').map(Number)) allowed.add(part);
  }
  if (facts.cycle) {
    allowed.add(facts.cycle.day);
    if (facts.cycle.usual_length != null) allowed.add(facts.cycle.usual_length);
  }
  for (const sym of facts.symptoms) allowed.add(sym.count);
  for (let i = 1; i <= 12; i++) allowed.add(i);

  const testNamed = (name: string, where: string) => {
    if (!known.has(testKey(name))) problems.push(`${where} names ${name}, which is not in her record`);
  };
  const valueQuoted = (name: string, value: string, where: string) => {
    const quoted = numbersIn(value)[0];
    const hers = known.get(testKey(name)) ?? [];
    if (quoted == null || !hers.includes(quoted)) problems.push(`${where} quotes ${value} for ${name}, which is not her value`);
  };

  for (const u of a.urgent) {
    testNamed(u.test, 'urgent');
    valueQuoted(u.test, u.value, 'urgent');
  }
  for (const f of a.findings) {
    testNamed(f.test, 'a finding');
    valueQuoted(f.test, f.value, 'a finding');
  }
  for (const p of a.patterns) for (const t of p.tests) testNamed(t, 'a pattern');
  for (const c of a.considerations) for (const t of c.tests) testNamed(t, 'a consideration');

  const texts = [
    a.summary,
    ...a.urgent.map((u) => u.reason),
    ...a.findings.flatMap((f) => [f.explanation, ...f.common_causes, f.relevance ?? '']),
    ...a.patterns.flatMap((p) => [p.title, p.explanation]),
    ...a.considerations.flatMap((c) => [c.condition, c.how_confirmed]),
    ...a.next_tests.flatMap((n) => [n.test, n.reason]),
    ...a.questions,
  ];
  for (const text of texts) {
    for (const n of numbersIn(text)) if (!allowed.has(n)) problems.push(`the number ${n} is in no fact`);
    if (DOSE.test(text)) problems.push('it gives a dose');
    if (CHANGE_MED.test(text)) problems.push('it tells her to change a medication');
    for (const med of [...facts.medications, ...facts.supplements]) {
      const m = new RegExp(`\\b(?:start|stop|discontinue|increase|decrease|reduce|raise)\\b[^.]{0,30}\\b${med.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (m.test(text)) problems.push('it tells her to change a medication');
    }
  }

  if (facts.tests.some((t) => t.flag === 'HH' || t.flag === 'LL' || t.flag === 'AA') && !a.urgent.length) {
    problems.push('a critical result is not marked urgent');
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if ((a[key as keyof typeof LIMITS] as unknown[]).length > max) problems.push(`more than ${max} ${key}`);
  }
  return [...new Set(problems)];
}

const NULLABLE = (type: string) => ({ type: [type, 'null'] });
const STR = { type: 'string' };
const STRS = { type: 'array', items: STR };

export const ANALYSIS_SCHEMA = {
  name: 'lab_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['urgent', 'summary', 'findings', 'patterns', 'considerations', 'next_tests', 'questions'],
    properties: {
      urgent: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['test', 'value', 'reason', 'action'],
          properties: { test: STR, value: STR, reason: STR, action: { type: 'string', enum: ['contact_today', 'urgent_care'] } },
        },
      },
      summary: STR,
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['test', 'value', 'explanation', 'common_causes', 'relevance'],
          properties: { test: STR, value: STR, explanation: STR, common_causes: STRS, relevance: NULLABLE('string') },
        },
      },
      patterns: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'tests', 'explanation'],
          properties: { title: STR, tests: STRS, explanation: STR },
        },
      },
      considerations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['condition', 'tests', 'confidence', 'how_confirmed'],
          properties: { condition: STR, tests: STRS, confidence: { type: 'string', enum: ['low', 'moderate', 'high'] }, how_confirmed: STR },
        },
      },
      next_tests: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['test', 'reason'], properties: { test: STR, reason: STR } },
      },
      questions: STRS,
    },
  },
};
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/labAnalysisCheck.test.ts`
Expected: PASS. If a rule's test fails because of the regex, fix the rule rather than the test, and check its sibling tests still pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lab-analysis/keys.ts supabase/functions/lab-analysis/facts.ts supabase/functions/lab-analysis/check.ts src/lib/labAnalysisCheck.test.ts
git commit -m "Lab analysis rules: the facts it may use, a fingerprint of them, and a check that refuses wrong values, stray numbers, doses, medication changes and a missed critical result"
```

---

### Task 2: Storage, the daily limit, and the store RPC

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261019110000_lab_analyses.sql`
- Test: `ciatta-mobile-app/supabase/tests/lab_analyses.test.sql`
- Modify: `ciatta-mobile-app/supabase/tests/grants.test.sql`

**Interfaces:**
- Produces:
  - Table `lab_analyses (id, user_id, document_id not null references documents on delete cascade, model text, facts_hash text, analysis jsonb, created_at)`, with RLS select own and no client writes
  - `claim_lab_analysis() returns boolean` (20 a day)
  - `store_lab_analysis(p_document uuid, p_model text, p_facts_hash text, p_analysis jsonb) returns uuid` (definer; refuses a document that is not hers)

- [ ] **Step 1: Write the failing SQL test**

`supabase/tests/lab_analyses.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.local'),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.local');
insert into public.documents (id, user_id, storage_path, doc_type) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a7/lab-reports/x.pdf', 'lab_report');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
select throws_ok($$ select public.store_lab_analysis('40000000-0000-0000-0000-000000000001', 'gpt-4o', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'an analysis cannot be stored against someone else''s report');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select lives_ok($$ select public.store_lab_analysis('40000000-0000-0000-0000-000000000001', 'gpt-4o', 'h', '{"summary":"x"}'::jsonb) $$,
  'she can store one against her own report');
select is((select count(*)::int from public.lab_analyses), 1, 'and she can read it');
select throws_ok($$ insert into public.lab_analyses (user_id, document_id, model, facts_hash, analysis)
  values ('00000000-0000-0000-0000-0000000000a7', '40000000-0000-0000-0000-000000000001', 'm', 'h', '{}') $$,
  '42501', null, 'the app cannot write an analysis directly');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
select is((select count(*)::int from public.lab_analyses), 0, 'someone else reads none of it');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select is((select bool_and(public.claim_lab_analysis()) from generate_series(1, 20)), true, 'twenty analyses a day');
select is(public.claim_lab_analysis(), false, 'and not a twenty first');

reset role;
delete from public.documents where id = '40000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.lab_analyses), 0, 'removing the report removes its analysis');

select * from finish();
rollback;
```

Run: `supabase test db`
Expected: FAIL, `store_lab_analysis` does not exist.

- [ ] **Step 2: Write the migration**

`supabase/migrations/20261019110000_lab_analyses.sql`:

```sql
-- The clinical AI analysis of a report she added. Written only by the
-- lab-analysis function, after it has checked every value against her
-- record, through store_lab_analysis below. She can read her own; nothing
-- the app sends can write one.

create table public.lab_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  model text not null,
  facts_hash text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);
create index lab_analyses_document on public.lab_analyses (document_id, created_at desc);
alter table public.lab_analyses enable row level security;
create policy lab_analyses_own on public.lab_analyses for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.lab_analyses from anon, authenticated;
grant select on public.lab_analyses to authenticated;
grant all on public.lab_analyses to service_role;

-- At most 20 analyses per person per day, counted before the model is
-- called, as with lab scans.
create table public.lab_analysis_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.lab_analysis_uses enable row level security;
revoke all on public.lab_analysis_uses from anon, authenticated;
grant all on public.lab_analysis_uses to service_role;

create function public.claim_lab_analysis() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  used integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.lab_analysis_uses (user_id, day, count) values (me, current_date, 1)
  on conflict (user_id, day) do update set count = public.lab_analysis_uses.count + 1
  returning count into used;
  return used <= 20;
end $$;
revoke execute on function public.claim_lab_analysis() from public, anon;
grant execute on function public.claim_lab_analysis() to authenticated;

-- Definer because authenticated has no insert on lab_analyses, and must
-- not: an analysis the app could write would be model text nobody checked.
-- The function calls this as her, so auth.uid() is her, and the report
-- must be hers.
create function public.store_lab_analysis(p_document uuid, p_model text, p_facts_hash text, p_analysis jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  id uuid;
begin
  if me is null or not exists (select 1 from public.documents where id = p_document and user_id = me) then
    raise exception 'not her report' using errcode = '42501';
  end if;
  insert into public.lab_analyses (user_id, document_id, model, facts_hash, analysis)
  values (me, p_document, p_model, p_facts_hash, p_analysis)
  returning lab_analyses.id into id;
  return id;
end $$;
revoke execute on function public.store_lab_analysis(uuid, text, text, jsonb) from public, anon;
grant execute on function public.store_lab_analysis(uuid, text, text, jsonb) to authenticated;
```

Add `claim_lab_analysis` and `store_lab_analysis` to the expected list and comment in `supabase/tests/grants.test.sql`.

Apply it: `supabase migration up`

- [ ] **Step 3: Run the SQL tests**

Run: `supabase test db`
Expected: `Result: PASS`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261019110000_lab_analyses.sql supabase/tests/lab_analyses.test.sql supabase/tests/grants.test.sql
git commit -m "Lab analyses stored only through a checked function, readable only by her, twenty a day, removed with their report"
```

---

### Task 3: The `lab-analysis` function

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/lab-analysis/index.ts`
- Create: `ciatta-mobile-app/supabase/functions/lab-analysis/fake.ts`
- Create: `ciatta-mobile-app/scripts/lab-analysis-e2e.mts`
- Create: `ciatta-mobile-app/scripts/lab-analysis-e2e.env`
- Modify: `ciatta-mobile-app/package.json` (script `e2e:lab-analysis`)

**Interfaces:**
- Consumes: Task 1 (`readAnalysis`, `checkAnalysis`, `ANALYSIS_SCHEMA`, `Facts`, `readCycle`, `fingerprint`), Task 2 (`claim_lab_analysis`, `store_lab_analysis`).
- Produces:
  - `POST /functions/v1/lab-analysis` with body `{ documentId: string, cycle?: { day, phase, usual_length } }`
  - 200 `{ analysis, model, created_at, facts_hash }`
  - 404 `{ error }` when the report is not hers
  - 422 `{ error: 'The analysis could not be checked, so it is not shown. Your results above are unaffected.' }`
  - 429 at the limit, 503 with no key

- [ ] **Step 1: Write the fake model and the end to end check first**

`supabase/functions/lab-analysis/fake.ts`:

```ts
// A stand in for the model, for local tests only (see index.ts for when it
// is allowed). good: a faithful analysis built from the facts. bad: one
// that quotes a value wrong and gives a dose, which the check must refuse.

import type { Analysis } from './check.ts';
import type { Facts } from './facts.ts';

export function fakeAnalysis(facts: Facts, kind: 'good' | 'bad'): Analysis {
  const first = facts.tests.find((t) => t.value != null) ?? facts.tests[0];
  const critical = facts.tests.filter((t) => t.flag === 'HH' || t.flag === 'LL' || t.flag === 'AA');
  const value = (t: typeof first) => `${t.value ?? t.value_text}${t.unit ? ` ${t.unit}` : ''}`;
  if (kind === 'bad') {
    return {
      urgent: [],
      summary: `Your ${first.name} is ${(first.value ?? 0) * 10}. Take 65 mg of iron daily.`,
      findings: [{ test: first.name, value: `${(first.value ?? 0) * 10}`, explanation: 'x', common_causes: [], relevance: null }],
      patterns: [],
      considerations: [],
      next_tests: [],
      questions: [],
    };
  }
  return {
    urgent: critical.map((t) => ({ test: t.name, value: value(t), reason: 'The lab flagged this as critical.', action: 'contact_today' as const })),
    summary: `This report has ${facts.tests.length} results.`,
    findings: facts.tests.filter((t) => t.flag).map((t) => ({ test: t.name, value: value(t), explanation: `${t.name} was flagged by the lab.`, common_causes: [], relevance: null })),
    patterns: [],
    considerations: [],
    next_tests: [],
    questions: ['What do these results mean for me?'],
  };
}
```

`scripts/lab-analysis-e2e.env`:

```
OPENAI_API_KEY=not-used-in-fake-mode
LAB_ANALYSIS_FAKE_MODEL=1
```

`scripts/lab-analysis-e2e.mts`:

```ts
// The lab-analysis function end to end on this machine, with the model
// replaced by a fake (no OpenAI call).
//
// Needs `supabase start`, and in another terminal:
//   supabase functions serve lab-analysis --env-file scripts/lab-analysis-e2e.env
// Run: npm run e2e:lab-analysis

import { execSync } from 'node:child_process';

const local = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const API: string = local.API_URL;
const ANON: string = local.ANON_KEY;
const SERVICE: string = local.SERVICE_ROLE_KEY;
const PASSWORD = 'lab-analysis-e2e-1';
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function user(tag: string) {
  const email = `lab-analysis-e2e-${tag}-${Date.now()}@example.com`;
  const made = await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }) }).then((r) => r.json());
  const session = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).then((r) => r.json());
  return { id: made.id as string, jwt: session.access_token as string };
}

const asHer = (jwt: string) => ({ apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' });

async function analyse(jwt: string, documentId: string, fake: string) {
  const res = await fetch(`${API}/functions/v1/lab-analysis`, {
    method: 'POST',
    headers: { ...asHer(jwt), 'x-fake-model': fake },
    body: JSON.stringify({ documentId, cycle: { day: 3, phase: 'During period', usual_length: 29 } }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function stored(jwt: string): Promise<number> {
  const rows = await fetch(`${API}/rest/v1/lab_analyses?select=id`, { headers: asHer(jwt) }).then((r) => r.json());
  return Array.isArray(rows) ? rows.length : -1;
}

async function main() {
  const her = await user('her');
  const other = await user('other');
  try {
    const doc = await fetch(`${API}/rest/v1/rpc/save_lab_report`, {
      method: 'POST',
      headers: asHer(her.jwt),
      body: JSON.stringify({
        p_title: 'Quest',
        p_collected_on: '2026-06-12',
        p_storage_path: `${her.id}/lab-reports/e2e.pdf`,
        p_metadata: { lab: 'Quest' },
        p_tests: [
          { name: 'Ferritin', panel: 'Iron', value: 8, value_text: null, unit: 'ng/mL', low: 15, high: 150, range: '15 to 150', flag: 'L' },
          { name: 'Hemoglobin', panel: 'CBC', value: 6.1, value_text: null, unit: 'g/dL', low: 12, high: 15.5, range: '12.0 to 15.5', flag: 'LL' },
        ],
      }),
    }).then((r) => r.json());
    check('a report to analyse was saved', typeof doc === 'string', JSON.stringify(doc));

    const good = await analyse(her.jwt, doc, 'good');
    check('a faithful analysis is stored and returned', good.status === 200 && good.body?.analysis?.urgent?.length === 1, `${good.status}`);
    check('it carries the model and a fingerprint', !!good.body?.model && typeof good.body?.facts_hash === 'string');
    check('she can read it back', (await stored(her.jwt)) === 1);

    const retried = await analyse(her.jwt, doc, 'bad-then-good');
    check('a refused answer is retried once and the second is stored', retried.status === 200 && (await stored(her.jwt)) === 2, `${retried.status}`);

    const refused = await analyse(her.jwt, doc, 'always-bad');
    check('an answer that never passes is not stored, and says so', refused.status === 422 && (await stored(her.jwt)) === 2 && /could not be checked/.test(refused.body?.error ?? ''), `${refused.status}`);

    const theirs = await analyse(other.jwt, doc, 'good');
    check('someone else cannot analyse her report', theirs.status === 404 && (await stored(other.jwt)) === 0, `${theirs.status}`);
  } finally {
    for (const u of [her, other]) await fetch(`${API}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: admin });
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add to `package.json` scripts: `"e2e:lab-analysis": "tsx scripts/lab-analysis-e2e.mts"`.

- [ ] **Step 2: Run it to see it fail**

Run `supabase functions serve lab-analysis --env-file scripts/lab-analysis-e2e.env` in the background, then `npm run e2e:lab-analysis`.
Expected: the first check passes and the analysis checks fail, because there is no function yet (the serve has nothing to serve, or returns 404).

- [ ] **Step 3: Write the function**

`supabase/functions/lab-analysis/index.ts`:

```ts
// A clinical AI analysis of one lab report she added.
//
// Runs as her: the database client carries her JWT, so every read is hers
// under RLS. The facts are gathered here from her rows (the cycle is the
// one exception, sent by the app in an exact shape). The model is given
// only those facts and a strict schema. Its answer is checked against
// them (check.ts) and retried once with the reasons. If it still fails,
// nothing is stored and she is told plainly.
//
// It never prescribes, doses, or tells her to start or stop a medication;
// the check refuses an answer that does.
//
// Logging: counts, the model name and rejection reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { ANALYSIS_SCHEMA, type Analysis, checkAnalysis, readAnalysis } from './check.ts';
import { fakeAnalysis } from './fake.ts';
import { type Facts, type FactTest, fingerprint, readCycle } from './facts.ts';
import { testKey } from './keys.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o';
const CONSIDERATIONS_OFF = Deno.env.get('LAB_ANALYSIS_CONSIDERATIONS') === 'off';
// The fake model only ever runs against a local stack.
const FAKE_ALLOWED = Deno.env.get('LAB_ANALYSIS_FAKE_MODEL') === '1' && /^https?:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url);

const NOT_CHECKED = 'The analysis could not be checked, so it is not shown. Your results above are unaffected.';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const INSTRUCTIONS = [
  'You are a clinical laboratory consultant writing for the patient whose results these are. Write plainly, warmly and precisely.',
  'Use only the facts given. Quote every value exactly as given, with its unit. Do not compute percentages, ratios or differences that are not in the facts.',
  'urgent: results that need prompt attention, first among them any result flagged HH, LL or AA, with action contact_today or urgent_care. Empty when nothing is urgent.',
  'summary: two or three sentences on what this report shows.',
  'findings: each result outside its range, explained: what the test measures, what a result like this commonly relates to, and relevance to her cycle, conditions, medications or symptoms when the facts support it.',
  'patterns: results that make sense together, naming the tests.',
  'considerations: conditions worth discussing with her clinician, each with the tests behind it, a confidence of low, moderate or high, and how a clinician would confirm or rule it out. Say what would confirm a condition; never declare that she has it.',
  'next_tests: tests a clinician might consider, each with a reason. questions: questions she could ask her clinician.',
  'Never give a dose, and never tell her to start, stop, increase or decrease any medication or supplement. Ranges are the lab\'s own; do not substitute other ranges.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);
  const uid = who.user.id;

  let body: { documentId?: unknown; cycle?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  if (!documentId) return json({ error: 'Bad request' }, 400);

  // Hers, or nothing: RLS returns no row for someone else's report.
  const { data: doc } = await db.from('documents').select('id, occurred_at, title, metadata').eq('id', documentId).eq('doc_type', 'lab_report').maybeSingle();
  if (!doc) return json({ error: 'That report was not found.' }, 404);

  const fake = FAKE_ALLOWED ? req.headers.get('x-fake-model') : null;
  if (!fake && !openAiKey) {
    console.log('lab-analysis: no OPENAI_API_KEY configured');
    return json({ error: 'Lab analysis is not set up yet' }, 503);
  }

  const { data: allowed, error: claimError } = await db.rpc('claim_lab_analysis');
  if (claimError) return json({ error: 'Could not check today\'s analyses' }, 500);
  if (allowed !== true) return json({ error: 'That is the most analyses for today. Try again tomorrow.' }, 429);

  const facts = await gatherFacts(db, uid, doc, readCycle(body.cycle));
  if (!facts.tests.length) return json({ error: 'This report has no results to analyse.' }, 422);
  const hash = fingerprint([
    ...facts.tests.map((t) => ({ name: t.name, value: t.value, value_text: t.value_text, unit: t.unit, on: facts.collected_on })),
    ...facts.earlier.flatMap((e) => e.results.map((r) => ({ name: e.name, ...r }))),
  ]);

  let attempt = 0;
  let reasons: string[] = [];
  let analysis: Analysis | null = null;
  while (attempt < 2 && !analysis) {
    attempt++;
    const raw = fake ? fakeFor(fake, attempt, facts) : await callModel(facts, reasons);
    const read = readAnalysis(raw);
    if (!read) {
      reasons = ['the answer was not in the required shape'];
      continue;
    }
    if (CONSIDERATIONS_OFF) read.considerations = [];
    const problems = checkAnalysis(read, facts);
    if (problems.length) {
      reasons = problems;
      console.log(`lab-analysis: attempt ${attempt} refused (${problems.length} problems)`);
      continue;
    }
    analysis = read;
  }
  if (!analysis) return json({ error: NOT_CHECKED }, 422);

  const model = fake ? `fake:${fake}` : MODEL;
  const { error: storeError } = await db.rpc('store_lab_analysis', { p_document: documentId, p_model: model, p_facts_hash: hash, p_analysis: analysis });
  if (storeError) return json({ error: 'The analysis could not be saved.' }, 500);
  console.log(`lab-analysis: stored, ${facts.tests.length} tests, attempt ${attempt}`);
  return json({ analysis, model, created_at: new Date().toISOString(), facts_hash: hash });
});

function fakeFor(kind: string, attempt: number, facts: Facts): Analysis {
  if (kind === 'always-bad' || (kind === 'bad-then-good' && attempt === 1)) return fakeAnalysis(facts, 'bad');
  return fakeAnalysis(facts, 'good');
}

async function callModel(facts: Facts, reasons: string[]): Promise<unknown> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: ANALYSIS_SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          { role: 'user', content: `Facts:\n${JSON.stringify(facts)}` },
          ...(reasons.length ? [{ role: 'user', content: `Your previous answer was refused because: ${reasons.join('; ')}. Answer again following every rule.` }] : []),
        ],
      }),
    });
    if (!res.ok) {
      console.log(`lab-analysis: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? JSON.parse(text) : null;
  } catch (e) {
    console.log(`lab-analysis: model failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function gatherFacts(db: any, uid: string, doc: any, cycle: Facts['cycle']): Promise<Facts> {
  const on = String(doc.occurred_at).slice(0, 10);
  const { data: rows } = await db
    .from('results')
    .select('test_name, value, value_text, unit, reference_text, reference_low, reference_high, flag, panel')
    .eq('document_id', doc.id);
  const tests: FactTest[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    name: String(r.test_name),
    value: r.value == null ? null : Number(r.value),
    value_text: (r.value_text as string | null) ?? null,
    unit: (r.unit as string | null) ?? null,
    range: (r.reference_text as string | null) ?? null,
    low: r.reference_low == null ? null : Number(r.reference_low),
    high: r.reference_high == null ? null : Number(r.reference_high),
    flag: (r.flag as string | null) ?? null,
    panel: (r.panel as string | null) ?? null,
  }));

  // Her earlier results for the same tests: up to five each, before this draw.
  const keys = new Set(tests.map((t) => testKey(t.name)));
  const { data: before } = await db
    .from('results')
    .select('test_name, value, value_text, unit, occurred_at')
    .lt('occurred_at', `${on}T00:00:00Z`)
    .order('occurred_at', { ascending: false })
    .limit(1000);
  const earlierBy = new Map<string, { name: string; results: Facts['earlier'][number]['results'] }>();
  for (const r of (before ?? []) as Record<string, unknown>[]) {
    const k = testKey(String(r.test_name));
    if (!keys.has(k)) continue;
    const entry = earlierBy.get(k) ?? { name: String(r.test_name), results: [] };
    if (entry.results.length < 5) {
      entry.results.push({ on: String(r.occurred_at).slice(0, 10), value: r.value == null ? null : Number(r.value), value_text: (r.value_text as string | null) ?? null, unit: (r.unit as string | null) ?? null });
    }
    earlierBy.set(k, entry);
  }

  const [{ data: profile }, { data: conditions }, { data: clinical }, { data: meds }, { data: supps }, { data: episodes }] = await Promise.all([
    db.from('profiles').select('onboarding, body').eq('id', uid).maybeSingle(),
    db.from('conditions').select('name, status').neq('status', 'resolved'),
    db.from('clinical_records').select('name').eq('kind', 'condition').limit(100),
    db.from('medications').select('name').is('stopped_on', null),
    db.from('supplements').select('name').is('stopped_on', null),
    db
      .from('episodes')
      .select('symptoms, kinds')
      .gte('occurred_on', new Date(Date.parse(on) - 30 * 86_400_000).toISOString().slice(0, 10))
      .lte('occurred_on', on),
  ]);

  const counts = new Map<string, number>();
  for (const e of (episodes ?? []) as { symptoms: string[]; kinds: string[] }[]) {
    for (const name of [...(e.symptoms ?? []), ...(e.kinds ?? []).filter((k) => k !== 'Period')]) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const names = (rs: { name: string }[] | null) => [...new Set((rs ?? []).map((r) => r.name).filter(Boolean))];

  return {
    collected_on: on,
    lab: (doc.metadata?.lab as string | null) ?? doc.title ?? null,
    tests,
    earlier: [...earlierBy.values()],
    cycle,
    profile: {
      age_range: (profile?.onboarding?.ageRange as string | null) ?? null,
      life_stage: (profile?.onboarding?.lifeStage as string | null) ?? null,
      gender: (profile?.body?.gender as string | null) ?? null,
    },
    conditions: names([...(conditions ?? []), ...(clinical ?? [])]),
    medications: names(meds),
    supplements: names(supps),
    symptoms: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
  };
}
```

- [ ] **Step 4: Run the end to end check**

Restart the serve if it did not pick the new function up. Run: `npm run e2e:lab-analysis`
Expected: `all passed`.
Also run `deno check --node-modules-dir=none supabase/functions/lab-analysis/index.ts`. Expected: `Check` with no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lab-analysis scripts/lab-analysis-e2e.mts scripts/lab-analysis-e2e.env package.json
git commit -m "lab-analysis function: facts from her record, a strict schema, every value checked and one retry, stored only when it passes; a local end to end check with a fake model"
```

---

### Task 4: The analysis on the report screen

**Files:**
- Create: `ciatta-mobile-app/src/lib/labAnalysis.ts`
- Test: `ciatta-mobile-app/src/lib/labAnalysis.test.ts`
- Modify: `ciatta-mobile-app/src/data/repo.ts`
- Modify: `ciatta-mobile-app/src/screens/LabReportScreen.tsx`

**Interfaces:**
- Consumes: Task 3's endpoint; `testKey`, `labHistory` (`labs.ts`); `cycleDayAt` (Part 2).
- Produces, in `labAnalysis.ts`:
  - `type StoredAnalysis = { analysis: Analysis; model: string; createdAt: string; factsHash: string }`, with `Analysis` re-declared in the app (same shape as Task 1)
  - `readStoredAnalysis(row: unknown): StoredAnalysis | null`
  - `reportFingerprint(report: LabResult[], all: LabResult[]): string`
  - `analysisStale(stored: StoredAnalysis, report: LabResult[], all: LabResult[]): boolean`
  - `criticalResults(results: LabResult[]): LabResult[]`
  - `ACTION_WORDS: Record<'contact_today' | 'urgent_care', string>`
  - `analysisHtml(title: string, on: string, stored: StoredAnalysis): string`
- Produces, on the repo:
  - `loadLabAnalysis(documentId: string): Promise<StoredAnalysis | null>`
  - `analyzeLabReport(documentId: string, cycle: { day: number; phase: string | null; usual_length: number | null } | null): Promise<StoredAnalysis>` (throws with the function's sentence)

- [ ] **Step 1: Write the failing tests**

`src/lib/labAnalysis.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprint } from '../../supabase/functions/lab-analysis/facts.ts';
import { testKey as serverKey } from '../../supabase/functions/lab-analysis/keys.ts';
import { analysisHtml, analysisStale, criticalResults, readStoredAnalysis, reportFingerprint } from './labAnalysis';
import { type LabResult, testKey } from './labs';

const r = (over: Partial<LabResult>): LabResult => ({
  id: Math.random().toString(16).slice(2),
  name: 'Ferritin',
  value: 8,
  valueText: null,
  unit: 'ng/mL',
  low: 15,
  high: 150,
  rangeText: '15 to 150',
  flag: 'L',
  status: 'final',
  source: 'report',
  lab: 'Quest',
  on: '2026-06-12',
  documentId: 'doc1',
  panel: null,
  ...over,
});

const analysis = {
  urgent: [],
  summary: 'Your ferritin of 8 ng/mL is low.',
  findings: [],
  patterns: [],
  considerations: [],
  next_tests: [],
  questions: [],
};

test('the app and the function fold test names the same way', () => {
  for (const n of ['Hemoglobin A1c', 'HbA1c', 'Vitamin D, 25 Hydroxy', 'TSH', 'Free T4', 'Something New']) assert.equal(testKey(n), serverKey(n), n);
});

test('the app fingerprints a report exactly as the function does', () => {
  const report = [r({}), r({ name: 'Hemoglobin', value: 11.2, unit: 'g/dL' })];
  const earlier = r({ on: '2026-01-10', value: 22, documentId: 'doc0' });
  const server = fingerprint([
    ...report.map((x) => ({ name: x.name, value: x.value, value_text: x.valueText, unit: x.unit, on: x.on })),
    { name: earlier.name, value: earlier.value, value_text: earlier.valueText, unit: earlier.unit, on: earlier.on },
  ]);
  assert.equal(reportFingerprint(report, [...report, earlier]), server);
});

test('a stored analysis is out of date once an earlier result for the same test arrives', () => {
  const report = [r({})];
  const stored = { analysis, model: 'gpt-4o', createdAt: '2026-06-13T00:00:00Z', factsHash: reportFingerprint(report, report) };
  assert.equal(analysisStale(stored, report, report), false);
  assert.equal(analysisStale(stored, report, [...report, r({ on: '2026-02-01', value: 30, documentId: 'doc0' })]), true);
});

test('critical results come from the lab flags alone', () => {
  assert.deepEqual(criticalResults([r({ flag: 'LL', name: 'Hemoglobin' }), r({ flag: 'L' }), r({ flag: 'AA', name: 'Culture' })]).map((x) => x.name), ['Hemoglobin', 'Culture']);
});

test('a stored row is read only in shape', () => {
  assert.equal(readStoredAnalysis(null), null);
  assert.equal(readStoredAnalysis({ analysis: { summary: '' }, model: 'm', created_at: 'x', facts_hash: 'h' }), null);
  assert.equal(readStoredAnalysis({ analysis, model: 'gpt-4o', created_at: '2026-06-13T00:00:00Z', facts_hash: 'h' })?.model, 'gpt-4o');
});

test('the printed analysis carries the label and no dash or hyphen of its own', () => {
  const html = analysisHtml('Quest', '2026-06-12', { analysis, model: 'gpt-4o', createdAt: '2026-06-13T00:00:00Z', factsHash: 'h' });
  assert.match(html, /Not a diagnosis/);
  assert.ok(!/[—–]/.test(html));
});
```

Run: `npx tsx --test src/lib/labAnalysis.test.ts`
Expected: FAIL, `./labAnalysis` cannot be found.

- [ ] **Step 2: Implement `src/lib/labAnalysis.ts`**

```ts
// The clinical AI analysis as the app reads, dates and prints it. The
// analysis itself is written and checked by the lab-analysis function;
// this only reads what was stored, says whether it is out of date, and
// finds the critical results from the lab's own flags.

import { type LabResult, labDay, labHistory, testKey } from './labs';

export type Analysis = {
  urgent: { test: string; value: string; reason: string; action: 'contact_today' | 'urgent_care' }[];
  summary: string;
  findings: { test: string; value: string; explanation: string; common_causes: string[]; relevance: string | null }[];
  patterns: { title: string; tests: string[]; explanation: string }[];
  considerations: { condition: string; tests: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[];
  next_tests: { test: string; reason: string }[];
  questions: string[];
};

export type StoredAnalysis = { analysis: Analysis; model: string; createdAt: string; factsHash: string };

export const ANALYSIS_LABEL = 'Clinical AI analysis. Not a diagnosis. Discuss it with your clinician.';

export const ACTION_WORDS: Record<'contact_today' | 'urgent_care', string> = {
  contact_today: 'Contact your clinician today',
  urgent_care: 'Seek urgent care',
};

const arr = (v: unknown) => (Array.isArray(v) ? v : []);

export function readStoredAnalysis(row: unknown): StoredAnalysis | null {
  const r = (row && typeof row === 'object' ? row : null) as Record<string, unknown> | null;
  const a = (r?.analysis && typeof r.analysis === 'object' ? r.analysis : null) as Record<string, unknown> | null;
  if (!r || !a || typeof a.summary !== 'string' || !a.summary.trim() || typeof r.model !== 'string') return null;
  return {
    analysis: {
      summary: a.summary,
      urgent: arr(a.urgent) as Analysis['urgent'],
      findings: arr(a.findings) as Analysis['findings'],
      patterns: arr(a.patterns) as Analysis['patterns'],
      considerations: arr(a.considerations) as Analysis['considerations'],
      next_tests: arr(a.next_tests) as Analysis['next_tests'],
      questions: arr(a.questions).filter((q): q is string => typeof q === 'string'),
    },
    model: r.model,
    createdAt: String(r.created_at ?? ''),
    factsHash: String(r.facts_hash ?? ''),
  };
}

// The same fingerprint the function stores (lab-analysis/facts.ts): the
// report's results, and up to five earlier results for each of its tests.
export function reportFingerprint(report: LabResult[], all: LabResult[]): string {
  const on = report[0]?.on ?? '';
  const earlier: LabResult[] = [];
  const seen = new Set<string>();
  for (const t of report) {
    const k = testKey(t.name);
    if (seen.has(k)) continue;
    seen.add(k);
    earlier.push(...labHistory(all, t.name).filter((h) => h.on < on).reverse().slice(0, 5));
  }
  return [...report, ...earlier]
    .map((t) => `${testKey(t.name)}|${t.value ?? t.valueText ?? ''}|${(t.unit ?? '').trim().toLowerCase()}|${t.on}`)
    .sort()
    .join('\n');
}

export const analysisStale = (stored: StoredAnalysis, report: LabResult[], all: LabResult[]) => stored.factsHash !== reportFingerprint(report, all);

export const criticalResults = (results: LabResult[]) => results.filter((r) => r.flag === 'HH' || r.flag === 'LL' || r.flag === 'AA');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function analysisHtml(title: string, on: string, stored: StoredAnalysis): string {
  const a = stored.analysis;
  const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const section = (heading: string, body: string) => (body ? `<h2>${heading}</h2>${body}` : '');
  return `<html><body style="font-family: -apple-system, Helvetica; padding: 24px; color: #161616">
<h1>${esc(title)}, ${esc(labDay(on))}</h1>
<p><strong>${ANALYSIS_LABEL}</strong></p>
<p>Written by ${esc(stored.model)} on ${esc(labDay(stored.createdAt.slice(0, 10)))} from the results on this report.</p>
${section('Urgent', list(a.urgent.map((u) => `${u.test} ${u.value}: ${u.reason} ${ACTION_WORDS[u.action]}.`)))}
${section('Summary', `<p>${esc(a.summary)}</p>`)}
${section('Findings', list(a.findings.map((f) => `${f.test} ${f.value}: ${f.explanation}${f.relevance ? ` ${f.relevance}` : ''}`)))}
${section('Patterns', list(a.patterns.map((p) => `${p.title}: ${p.explanation}`)))}
${section('Conditions to consider', list(a.considerations.map((c) => `${c.condition} (${c.confidence} confidence): ${c.how_confirmed}`)))}
${section('Suggested next tests', list(a.next_tests.map((n) => `${n.test}: ${n.reason}`)))}
${section('Questions for your clinician', list(a.questions))}
</body></html>`;
}
```

Run: `npx tsx --test src/lib/labAnalysis.test.ts`
Expected: PASS.

- [ ] **Step 3: The repo**

Add to the repo interface:

```ts
  // The latest stored clinical AI analysis of a report, or null.
  loadLabAnalysis(documentId: string): Promise<StoredAnalysis | null>;
  // Asks for a new one. Throws with the function's own sentence when it
  // could not be written or checked.
  analyzeLabReport(documentId: string, cycle: { day: number; phase: string | null; usual_length: number | null } | null): Promise<StoredAnalysis>;
```

Import `readStoredAnalysis`, `type StoredAnalysis` from `../lib/labAnalysis`.

Demo repo (a fixed, faithful example, so the screen can be tried without a key):

```ts
    loadLabAnalysis: async (documentId) => demoAnalyses.get(documentId) ?? null,
    analyzeLabReport: async (documentId) => {
      const rows = labs.filter((l) => l.documentId === documentId);
      const flagged = rows.filter((l) => l.flag);
      const stored: StoredAnalysis = {
        analysis: {
          urgent: [],
          summary: `This example report has ${rows.length} results, ${flagged.length} flagged by the lab.`,
          findings: flagged.map((l) => ({
            test: l.name,
            value: `${l.value ?? l.valueText}${l.unit ? ` ${l.unit}` : ''}`,
            explanation: `${l.name} was flagged by the lab. In the real app a clinical AI analysis explains it here.`,
            common_causes: [],
            relevance: null,
          })),
          patterns: [],
          considerations: [],
          next_tests: [],
          questions: ['What do these results mean for me?'],
        },
        model: 'example',
        createdAt: new Date().toISOString(),
        factsHash: '',
      };
      demoAnalyses.set(documentId, stored);
      return stored;
    },
```

Declare `const demoAnalyses = new Map<string, StoredAnalysis>();` beside `demoReports`.

Real repo:

```ts
    async loadLabAnalysis(documentId) {
      const rows = must(
        await db.from('lab_analyses').select('analysis, model, created_at, facts_hash').eq('document_id', documentId).order('created_at', { ascending: false }).limit(1),
      ) as unknown[] | null;
      return readStoredAnalysis(rows?.[0] ?? null);
    },
    async analyzeLabReport(documentId, cycle) {
      const { data, error } = await db.functions.invoke('lab-analysis', { body: { documentId, cycle } });
      if (error) {
        let sentence = 'The analysis could not be written just now.';
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (typeof body?.error === 'string') sentence = body.error;
        } catch {
          // Not JSON. The plain sentence stands.
        }
        throw new Error(sentence);
      }
      const stored = readStoredAnalysis(data);
      if (!stored) throw new Error('The analysis could not be written just now.');
      return stored;
    },
```

- [ ] **Step 4: The screen**

In `LabReportScreen`:

- State and loading:

```tsx
  const [stored, setStored] = useState<StoredAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);

  const analyse = useCallback(async () => {
    if (!key?.documentId || analysing) return;
    setAnalysing(true);
    setAnalysisNote(null);
    try {
      setStored(
        await repo.analyzeLabReport(key.documentId, cycle ? { day: cycle.day, phase: cycle.phase, usual_length: usual } : null),
      );
    } catch (e) {
      setAnalysisNote(e instanceof Error ? e.message : 'The analysis could not be written just now.');
    } finally {
      setAnalysing(false);
    }
  }, [key, analysing, repo, cycle, usual]);

  // Read the stored analysis; write one the first time a report is opened.
  useEffect(() => {
    if (!key?.documentId || !labs) return;
    let ignore = false;
    repo
      .loadLabAnalysis(key.documentId)
      .then((s) => {
        if (ignore) return;
        if (s) setStored(s);
        else void analyse();
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
    // analyse is stable enough for a once per report read; listing it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, labs, repo]);

  const critical = useMemo(() => criticalResults(results), [results]);
  const stale = stored && labs ? analysisStale(stored, results, labs) : false;
```

  Place these after the `cycle` / `usual` hooks from Part 2 Task 5, and before the early return.

- **Urgent banner**, directly under the count line, from the lab's flags and the analysis together:

```tsx
      {critical.length || stored?.analysis.urgent.length ? (
        <View style={[s.card, s.urgent]}>
          <CardFill />
          <Text style={[font('headline'), s.urgentHead]}>Needs prompt attention</Text>
          {(stored?.analysis.urgent.length
            ? stored.analysis.urgent.map((u) => `${u.test} ${u.value}. ${u.reason} ${ACTION_WORDS[u.action]}.`)
            : critical.map((r) => `${r.name} ${r.value ?? r.valueText}${r.unit ? ` ${r.unit}` : ''} was flagged as critical by the lab. Contact your clinician today.`)
          ).map((line) => (
            <Text key={line} style={[font('subhead'), s.ink, { marginTop: 4 }]}>
              {displayCopy(line)}
            </Text>
          ))}
        </View>
      ) : null}
```

- **Findings under each test** in its panel card, after the cycle lines:

```tsx
                {stored?.analysis.findings
                  .filter((f) => testKey(f.test) === testKey(r.name))
                  .map((f) => (
                    <Text key={f.test} style={[font('caption1'), s.finding]}>
                      {displayCopy(f.explanation)}
                    </Text>
                  ))}
```

- **The analysis section**, after `<BodySystems />` and before Remove:

```tsx
      {key.documentId ? (
        <View style={{ marginTop: SPACE.block }}>
          <Eyebrow>Clinical AI analysis</Eyebrow>
          <Text style={[font('footnote', 'semibold'), s.label]}>{ANALYSIS_LABEL}</Text>
          {analysing ? <Text style={[font('subhead'), s.meta, { marginTop: 8 }]}>Analysing your report.</Text> : null}
          {analysisNote ? <Text style={[font('subhead'), s.meta, { marginTop: 8 }]}>{displayCopy(analysisNote)}</Text> : null}
          {stored ? (
            <>
              <Text style={[font('caption1'), s.meta, { marginTop: 4 }]}>
                {displayCopy(`Written by ${stored.model} on ${labDay(stored.createdAt.slice(0, 10))} from the results above.`)}
              </Text>
              {stale ? <Text style={[font('subhead'), s.flagText, { marginTop: 8 }]}>Your results have changed since this was written.</Text> : null}
              <View style={s.card}>
                <CardFill />
                <Text style={[font('body'), s.ink, { paddingVertical: 12 }]}>{displayCopy(stored.analysis.summary)}</Text>
              </View>
              <AnalysisList title="Findings" items={stored.analysis.findings.map((f) => ({ head: `${f.test}, ${f.value}`, body: [f.explanation, f.common_causes.length ? `Common causes: ${f.common_causes.join(', ')}.` : '', f.relevance ?? ''].filter(Boolean).join(' ') }))} />
              <AnalysisList title="Patterns" items={stored.analysis.patterns.map((p) => ({ head: p.title, body: `${p.explanation} (${p.tests.join(', ')})` }))} />
              <AnalysisList
                title="Conditions to consider"
                items={stored.analysis.considerations.map((c) => ({ head: c.condition, chip: `${c.confidence} confidence`, body: `How it is confirmed: ${c.how_confirmed} Based on ${c.tests.join(', ')}.` }))}
              />
              <AnalysisList title="Suggested next tests" items={stored.analysis.next_tests.map((n) => ({ head: n.test, body: n.reason }))} />
              <AnalysisList title="Questions for your clinician" items={stored.analysis.questions.map((q) => ({ head: q, body: '' }))} />
              <View style={{ marginTop: SPACE.near, gap: 12 }}>
                <SecondaryButton label="Share or Print" onPress={() => void share()} />
                {stale ? <SecondaryButton label="Analyze Again" onPress={() => void analyse()} /> : null}
              </View>
            </>
          ) : !analysing ? (
            <View style={{ marginTop: SPACE.near }}>
              <SecondaryButton label="Analyze This Report" onPress={() => void analyse()} />
            </View>
          ) : null}
        </View>
      ) : null}
```

- The list component and the share action:

```tsx
function AnalysisList({ title, items }: { title: string; items: { head: string; body: string; chip?: string }[] }) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: SPACE.near }}>
      <Text style={[font('footnote', 'semibold'), { color: G.body }]}>{title}</Text>
      <View style={s.card}>
        <CardFill />
        {items.map((item, n) => (
          <View key={`${item.head}${n}`} style={[s.row, n > 0 && s.divided]}>
            <View style={s.top}>
              <Text style={[font('subhead', 'semibold'), s.ink, { flex: 1 }]}>{displayCopy(item.head)}</Text>
              {item.chip ? <Text style={[font('caption2', 'semibold'), s.chip]}>{displayCopy(item.chip)}</Text> : null}
            </View>
            {item.body ? <Text style={[font('subhead'), s.ink]}>{displayCopy(item.body)}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}
```

```tsx
  const share = useCallback(async () => {
    if (!stored || !key) return;
    const { uri } = await Print.printToFileAsync({ html: analysisHtml(key.lab ?? 'Lab report', key.on, stored) });
    await Share.share({ url: uri, title: 'Lab report analysis' });
  }, [stored, key]);
```

- Imports:
  - `* as Print from 'expo-print'`
  - `Share` from `react-native`
  - from `../lib/labAnalysis`: `ACTION_WORDS`, `ANALYSIS_LABEL`, `analysisHtml`, `analysisStale`, `criticalResults`, `type StoredAnalysis`
  - `testKey` added to the `../lib/labs` import
- Styles:

```ts
  urgent: { borderWidth: 1, borderColor: HUE.escalation, paddingVertical: 12, marginTop: SPACE.near },
  urgentHead: { color: HUE.escalation },
  finding: { color: L.body, lineHeight: 18 },
  label: { color: G.ink, marginTop: 4 },
  flagText: { color: HUE.attention },
  chip: { color: L.meta, borderWidth: 1, borderColor: L.rule, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
```

- [ ] **Step 5: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass.

```bash
git add src/lib/labAnalysis.ts src/lib/labAnalysis.test.ts src/data/repo.ts src/screens/LabReportScreen.tsx
git commit -m "Clinical AI analysis on the report: urgent first, summary, findings under each test, patterns, conditions to consider, next tests and questions; labelled, dated, out of date when results change, shareable"
```

- [ ] **Step 6: Try it**

In the demo (Look Around First): add a report, and the Report screen shows the example analysis with its label. On the real backend, after Task 7's deploy steps from the provider plan and with `OPENAI_API_KEY` set, the user runs it on their own PDFs.

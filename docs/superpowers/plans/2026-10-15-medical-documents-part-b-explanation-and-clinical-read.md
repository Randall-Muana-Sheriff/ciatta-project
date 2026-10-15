# Medical Documents Part B: Explanation and Clinical Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every non lab document she adds gets a checked AI analysis on its screen. It gives urgent items first, a summary, terms explained in plain language, findings, patterns across her record, conditions to consider, next steps and questions, and it is labelled as not a diagnosis.

**Architecture:**
- **The function:** `document-analysis` mirrors `lab-analysis`:
  - runs as her
  - claims one of the day's analyses (shared with labs)
  - gathers facts: the document's extraction plus her record
  - calls the model with a strict schema
  - checks the answer with a pure `checkDocumentAnalysis`, retrying once
  - stores the result with the service role in `document_analyses`
- **The rules:** pure helpers live in the function's directory and `_shared/textChecks.ts`, and are tested from the app's suite.
- **The screen:** `DocumentScreen` shows the analysis at its Part A marker.

**Tech Stack:** Supabase Edge Functions (Deno), OpenAI JSON schema, Postgres + pgTAP, Expo 57 / React Native, expo-print.

**Spec:** `docs/superpowers/specs/2026-10-15-medical-documents-design.md` (Part B).

## Spec amendments carried by this plan

- **Out of date means the document changed.** The fingerprint is a stable hash of the document's extraction. Her record changes all the time, and an analysis that was always "out of date" would say nothing. The analysis is dated and names the record it read, so she can ask for a new one at any time ("Analyze Again" is always shown).
- **Text checks are shared.** The number, dose and medication change patterns move to `_shared/textChecks.ts` for this function. `lab-analysis` keeps its own copy for now, so its working checks are untouched.
- **The cycle is sent by the app**, as for labs, in the same exact shape. It is read from `lab-analysis/facts.ts`'s `readCycle`, copied here.

## Global Constraints

- Run from `ciatta-mobile-app/`: `npm test`, `npx tsc --noEmit`, `supabase test db`.
- No em dash, en dash or hyphen in UI copy, and `displayCopy()` on all model text.
- Jost, Ground.
- Health data is never logged.
- Runs as her. Only the final store uses the service role.
- Label, always shown: "Clinical AI analysis. Not a diagnosis. Discuss it with your clinician."

## Review Focus

1. **A dose in the analysis that the document never printed.** It is refused. Pinned in Task 1.
2. **"Stop ibuprofen" written as advice, not as the document's instruction.** It is refused. The same instruction, credited to the document and present in it, passes. Pinned in Task 1.
3. **A term the document never used, explained.** It is refused. Pinned in Task 1.
4. **An imaging impression that says "urgent", with an analysis whose urgent list is empty.** It is refused, and the banner still shows the document's own words. Pinned in Task 1 and Task 4 (`documentUrgentLines`).
5. **Someone else's document id.** Nothing is read or stored. Pinned in Task 3 (end to end) and Task 2 (only the service role stores).

---

### Task 1: The pure rules

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/_shared/textChecks.ts`
- Create: `ciatta-mobile-app/supabase/functions/document-analysis/facts.ts`
- Create: `ciatta-mobile-app/supabase/functions/document-analysis/check.ts`
- Test: `ciatta-mobile-app/src/lib/documentAnalysisCheck.test.ts`

**Interfaces:**
- Produces:
  - In `_shared/textChecks.ts`: `fold`, `numbersIn(text)`, `doseMatches(text): string[]`, `changesMedication(text, meds: string[]): boolean`, `URGENT_WORDS: RegExp`, `escape`
  - In `document-analysis/facts.ts`:
    - `type DocFacts = { document: { type: string; date: string | null; title: string | null; clinician: string | null; facility: string | null; extraction: Record<string, unknown> }; record: { conditions: string[]; medications: string[]; supplements: string[]; procedures: { name: string; on: string | null }[]; labs: { name: string; value: number | null; value_text: string | null; unit: string | null; range: string | null; flag: string | null; on: string }[]; cycle: { day: number; phase: string | null; usual_length: number | null } | null; symptoms: { name: string; count: number }[]; profile: { age_range: string | null; life_stage: string | null; gender: string | null } } }`
    - `documentText(extraction): string` (every string value, joined)
    - `documentMeds(extraction): string[]`
    - `extractionFingerprint(extraction): string` (stable JSON)
    - `readCycle(raw)`
  - In `document-analysis/check.ts`:
    - `type DocAnalysis = { urgent: { item: string; reason: string; action: 'contact_today' | 'urgent_care' }[]; summary: string; terms: { term: string; meaning: string }[]; findings: { item: string; explanation: string; relevance: string | null }[]; patterns: { title: string; items: string[]; explanation: string }[]; considerations: { condition: string; items: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[]; next_steps: { step: string; reason: string }[]; questions: string[] }`
    - `readDocAnalysis(json): DocAnalysis | null`
    - `checkDocumentAnalysis(a, facts): string[]`
    - `DOC_ANALYSIS_SCHEMA`

- [ ] **Step 1: Write the failing tests**

`src/lib/documentAnalysisCheck.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkDocumentAnalysis, type DocAnalysis, readDocAnalysis } from '../../supabase/functions/document-analysis/check.ts';
import { type DocFacts, documentMeds, documentText, extractionFingerprint, readCycle } from '../../supabase/functions/document-analysis/facts.ts';

const extraction = {
  doc_type: 'visit',
  date: '2026-09-02',
  clinician: 'Dr Rivera',
  visit: {
    reason: 'Pelvic pain',
    diagnoses: [{ name: 'Endometriosis', status: 'new' }],
    medications_started: [{ name: 'Ferrous sulfate', strength: '325 mg', dose: null, frequency: 'once daily', route: 'oral', prescriber: null, date: null }],
    medications_stopped: [{ name: 'Ibuprofen', strength: null, dose: null, frequency: null, route: null, prescriber: null, date: null }],
    medications_changed: [],
    procedures: [{ name: 'Transvaginal ultrasound', date: '2026-09-02' }],
    follow_ups: [{ specialty: 'Gynecology', clinician: null, reason: 'Discuss laparoscopy', when: 'in 4 weeks' }],
    instructions: ['Stop ibuprofen and use acetaminophen for pain.', 'Hypoechoic lesion noted on ultrasound.'],
    allergies: [],
  },
};

const facts: DocFacts = {
  document: { type: 'visit', date: '2026-09-02', title: 'After Visit Summary', clinician: 'Dr Rivera', facility: 'Mercy', extraction },
  record: {
    conditions: ['Iron deficiency anemia'],
    medications: ['Ibuprofen'],
    supplements: [],
    procedures: [],
    labs: [{ name: 'Ferritin', value: 8, value_text: null, unit: 'ng/mL', range: '15 to 150', flag: 'L', on: '2026-08-20' }],
    cycle: { day: 3, phase: 'During period', usual_length: 29 },
    symptoms: [{ name: 'Fatigue', count: 6 }],
    profile: { age_range: '30 to 39', life_stage: null, gender: 'woman' },
  },
};

const good = (): DocAnalysis => ({
  urgent: [],
  summary: 'This visit summary records a new diagnosis of endometriosis, starts ferrous sulfate 325 mg once daily, and refers you to gynecology in 4 weeks.',
  terms: [{ term: 'Hypoechoic', meaning: 'An area that looks darker on ultrasound because it reflects less sound.' }],
  findings: [{ item: 'Endometriosis', explanation: 'Endometriosis was diagnosed at this visit.', relevance: 'Your ferritin of 8 ng/mL was low in August, which heavy periods can cause.' }],
  patterns: [{ title: 'Pain and low iron', items: ['Endometriosis', 'Ferritin'], explanation: 'Heavy bleeding from endometriosis can lower iron stores.' }],
  considerations: [{ condition: 'Iron deficiency anemia', items: ['Ferritin'], confidence: 'moderate', how_confirmed: 'A complete blood count and iron panel.' }],
  next_steps: [{ step: 'Keep the gynecology follow up', reason: 'To discuss laparoscopy, as the summary says.' }],
  questions: ['Should I recheck my iron after starting ferrous sulfate?'],
});

test('a faithful analysis passes', () => {
  assert.deepEqual(checkDocumentAnalysis(good(), facts), []);
});

test('a term the document never used is refused', () => {
  const a = good();
  a.terms = [{ term: 'Adenomyosis', meaning: 'x' }];
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /Adenomyosis/);
});

test('an item that is in neither the document nor her record is refused', () => {
  const a = good();
  a.findings[0].item = 'Thyroid nodule';
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /Thyroid nodule/);
});

test('a dose the document never printed is refused, and one it printed passes', () => {
  const a = good();
  a.questions = ['Should I take 650 mg of ferrous sulfate?'];
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /dose/i);
  assert.deepEqual(checkDocumentAnalysis(good(), facts), [], 'the summary quotes 325 mg as printed');
});

test('a medication change as advice is refused; the document’s own instruction, credited to it, passes', () => {
  const a = good();
  a.next_steps = [{ step: 'Stop taking ibuprofen', reason: 'It may worsen bleeding.' }];
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /medication/i);
  const b = good();
  b.next_steps = [{ step: 'Your visit summary says to stop ibuprofen and use acetaminophen for pain', reason: 'That is your clinician’s instruction.' }];
  assert.deepEqual(checkDocumentAnalysis(b, facts), []);
});

test('a number in no fact is refused', () => {
  const a = good();
  a.summary = 'Your risk is 40 percent higher.';
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /40/);
});

test('urgent words in the document require something marked urgent', () => {
  const urgent: DocFacts = { ...facts, document: { ...facts.document, type: 'imaging', extraction: { doc_type: 'imaging', report: { study: 'CT', body_site: 'Abdomen', findings: 'Free fluid.', impression: 'Urgent surgical consultation recommended.', named_conditions: [] } } } };
  const a: DocAnalysis = { ...good(), terms: [], findings: [], patterns: [], considerations: [], next_steps: [], questions: [], summary: 'The CT shows free fluid.' };
  assert.match(checkDocumentAnalysis(a, urgent).join(' '), /urgent/i);
});

test('too many items is refused', () => {
  const a = good();
  a.questions = Array.from({ length: 11 }, () => 'Should I recheck my iron after starting ferrous sulfate?');
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /questions/);
});

test('what the model returned is read into shape', () => {
  assert.equal(readDocAnalysis(null), null);
  assert.equal(readDocAnalysis({ ...good(), considerations: [{ condition: 'X', items: ['Ferritin'], confidence: 'sure', how_confirmed: 'y' }] })?.considerations.length, 0);
});

test('the document text, its medications, and a stable fingerprint', () => {
  assert.match(documentText(extraction), /hypoechoic lesion/i);
  assert.deepEqual(documentMeds(extraction).sort(), ['Ferrous sulfate', 'Ibuprofen']);
  const reordered = { visit: extraction.visit, clinician: 'Dr Rivera', date: '2026-09-02', doc_type: 'visit' };
  assert.equal(extractionFingerprint(extraction), extractionFingerprint(reordered));
  assert.notEqual(extractionFingerprint(extraction), extractionFingerprint({ ...extraction, date: '2026-09-03' }));
  assert.deepEqual(readCycle({ day: 3, phase: 'During period', usual_length: 29 }), { day: 3, phase: 'During period', usual_length: 29 });
});
```

Run: `npx tsx --test src/lib/documentAnalysisCheck.test.ts`
Expected: FAIL, the modules cannot be found.

- [ ] **Step 2: Implement**

`supabase/functions/_shared/textChecks.ts`:

```ts
// Reading numbers, doses and medication changes out of text, for checking
// what a model wrote. Pure; tested from the app's suite.

export const fold = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
export const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A number standing on its own, not part of a name like T4, B12 or A1c.
const NUMBER = /(?<![A-Za-z0-9.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![A-Za-z0-9])|(?<![A-Za-z0-9.,])\d+(?:\.\d+)?(?![A-Za-z0-9])/g;
const NAMED_NUMBER = /(?<![A-Za-z0-9.])\d+(?:,\s*\d+)?\s*(?:hydroxy|dihydroxy|oh)\b/gi;
const glued = (text: string) => text.replace(/(?<![A-Za-z])(\d+(?:\.\d+)?)(?=[a-zA-Zµ%])/g, '$1 ');
const prepared = (text: string) => glued(text.replace(NAMED_NUMBER, ' '));
export const numbersIn = (text: string) => [...prepared(text).matchAll(NUMBER)].map((m) => Number(m[0].replace(/,/g, '')));

const DOSE_UNIT = '(?:mg|mcg|µg|iu|units?|g|grams?|milligrams?|micrograms?|international units|tablets?|capsules?|pills?|drops?)';
const DOSE = new RegExp(`(?<![A-Za-z0-9.])\\d+(?:\\.\\d+)?\\s?${DOSE_UNIT}\\b(?!\\s*\\/\\s*(?:dl|l|ml|ul|µl|mmol|kg|m2)\\b)`, 'gi');
// Every dose written in a text, spaced the same way, for comparing.
export const doseMatches = (text: string) => [...glued(text).matchAll(DOSE)].map((m) => fold(m[0].replace(/(\d)\s*([a-zµ])/i, '$1 $2')));

const VERBS = '(?:start|stop|begin|discontinue|increase|decrease|reduce|raise|double|halve|switch|pause|hold|taper|quit|resume|add|cut back on|come off)';
const OBJECTS = '(?:medications?|medicines?|doses?|dosage|prescriptions?|pills?|tablets?|capsules?|supplements?|drugs?)';
const CHANGE_MED = new RegExp(`\\b${VERBS}\\s+(?:taking\\s+|using\\s+|your\\s+|the\\s+|an?\\s+|to\\s+)*(?:\\w+\\s+){0,2}${OBJECTS}\\b`, 'i');
const PASSIVE_MED = new RegExp(`\\b${OBJECTS}\\b[^.]{0,30}\\b(?:should|must|could|can|needs? to)\\s+be\\s+(?:stopped|started|increased|decreased|reduced|discontinued|paused|switched|held|tapered|changed|adjusted)\\b`, 'i');

// Whether a text tells her to start, stop or change a medication, in
// general words or by naming one of the given medications.
export function changesMedication(text: string, meds: string[]): boolean {
  if (CHANGE_MED.test(text) || PASSIVE_MED.test(text)) return true;
  return meds.filter(Boolean).some((med) => {
    const m = escape(med);
    return (
      new RegExp(`\\b${VERBS}\\b[^.]{0,30}\\b${m}\\b`, 'i').test(text) ||
      new RegExp(`\\b${m}\\b[^.]{0,30}\\b(?:should|must|could|can|needs? to)\\s+be\\s+\\w+ed\\b`, 'i').test(text)
    );
  });
}

export const URGENT_WORDS = /\b(urgent|urgently|critical|emergency|call 911|immediately|stat|seek (?:immediate|emergency) care)\b/i;
```

`supabase/functions/document-analysis/facts.ts`:

```ts
// The facts a document analysis may use, and the fingerprint that says
// when the document has changed. Pure; tested from the app's suite.

export type DocFacts = {
  document: { type: string; date: string | null; title: string | null; clinician: string | null; facility: string | null; extraction: Record<string, unknown> };
  record: {
    conditions: string[];
    medications: string[];
    supplements: string[];
    procedures: { name: string; on: string | null }[];
    labs: { name: string; value: number | null; value_text: string | null; unit: string | null; range: string | null; flag: string | null; on: string }[];
    cycle: { day: number; phase: string | null; usual_length: number | null } | null;
    symptoms: { name: string; count: number }[];
    profile: { age_range: string | null; life_stage: string | null; gender: string | null };
  };
};

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => strings(x, out));
  return out;
}

// Everything the document says, as one text.
export const documentText = (extraction: Record<string, unknown>) => strings(extraction).join(' \n ');

// Every medication the document names, in any list.
export function documentMeds(extraction: Record<string, unknown>): string[] {
  const names = new Set<string>();
  const visit = (extraction.visit ?? {}) as Record<string, unknown>;
  const rx = (extraction.prescription ?? {}) as Record<string, unknown>;
  for (const list of [visit.medications_started, visit.medications_stopped, visit.medications_changed, rx.medications]) {
    for (const m of Array.isArray(list) ? list : []) if (typeof m?.name === 'string' && m.name.trim()) names.add(m.name.trim());
  }
  return [...names];
}

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}

// The same in the app (src/lib/documentAnalysis.ts).
export const extractionFingerprint = (extraction: unknown) => JSON.stringify(stable(extraction));

const PHASES = ['During period', 'Before period', 'After period', 'Between periods'];
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
export function readCycle(raw: unknown): DocFacts['record']['cycle'] {
  const c = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  const day = c ? int(c.day, 1, 45) : null;
  if (!c || day == null) return null;
  return { day, phase: typeof c.phase === 'string' && PHASES.includes(c.phase) ? c.phase : null, usual_length: int(c.usual_length, 15, 90) };
}
```

`supabase/functions/document-analysis/check.ts`:

```ts
// Reading what the model wrote about a document, and checking it against
// the document and her record. Refused when it explains a term the
// document never used, names something in neither, carries a number in no
// fact, gives a dose the document did not print, gives medication advice
// that is not the document's own credited instruction, misses the
// document's own urgent words, or runs long. Pure; tested from the app.

import { changesMedication, doseMatches, fold, numbersIn, URGENT_WORDS } from '../_shared/textChecks.ts';
import { type DocFacts, documentMeds, documentText } from './facts.ts';

export type DocAnalysis = {
  urgent: { item: string; reason: string; action: 'contact_today' | 'urgent_care' }[];
  summary: string;
  terms: { term: string; meaning: string }[];
  findings: { item: string; explanation: string; relevance: string | null }[];
  patterns: { title: string; items: string[]; explanation: string }[];
  considerations: { condition: string; items: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[];
  next_steps: { step: string; reason: string }[];
  questions: string[];
};

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(s).filter((x): x is string => !!x) : []);
const objs = (v: unknown) => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []);

export function readDocAnalysis(json: unknown): DocAnalysis | null {
  const j = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null;
  const summary = j ? s(j.summary) : null;
  if (!j || !summary) return null;
  return {
    summary,
    urgent: objs(j.urgent)
      .map((u) => ({ item: s(u.item), reason: s(u.reason), action: u.action }))
      .filter((u): u is DocAnalysis['urgent'][number] => !!u.item && !!u.reason && (u.action === 'contact_today' || u.action === 'urgent_care')),
    terms: objs(j.terms)
      .map((t) => ({ term: s(t.term), meaning: s(t.meaning) }))
      .filter((t): t is DocAnalysis['terms'][number] => !!t.term && !!t.meaning),
    findings: objs(j.findings)
      .map((f) => ({ item: s(f.item), explanation: s(f.explanation), relevance: s(f.relevance) }))
      .filter((f): f is DocAnalysis['findings'][number] => !!f.item && !!f.explanation),
    patterns: objs(j.patterns)
      .map((p) => ({ title: s(p.title), items: strs(p.items), explanation: s(p.explanation) }))
      .filter((p): p is DocAnalysis['patterns'][number] => !!p.title && p.items.length > 0 && !!p.explanation),
    considerations: objs(j.considerations)
      .map((c) => ({ condition: s(c.condition), items: strs(c.items), confidence: c.confidence, how_confirmed: s(c.how_confirmed) }))
      .filter(
        (c): c is DocAnalysis['considerations'][number] =>
          !!c.condition && c.items.length > 0 && !!c.how_confirmed && (c.confidence === 'low' || c.confidence === 'moderate' || c.confidence === 'high'),
      ),
    next_steps: objs(j.next_steps)
      .map((n) => ({ step: s(n.step), reason: s(n.reason) }))
      .filter((n): n is DocAnalysis['next_steps'][number] => !!n.step && !!n.reason),
    questions: strs(j.questions),
  };
}

const LIMITS = { terms: 12, findings: 12, patterns: 8, considerations: 6, next_steps: 8, questions: 10 } as const;
// A sentence that credits an instruction to the document or its clinician.
const CREDITED = /\b(your|the)\s+(visit summary|discharge (?:papers|summary|instructions)|summary|document|note|notes|report|prescription|clinician|doctor|care team)\b[^.]{0,40}\b(say|says|said|state|states|instruct|instructs|instructed|list|lists|tell|tells|told|recommend|recommends|recommended)\b|\baccording to (your|the)\b/i;

export function checkDocumentAnalysis(a: DocAnalysis, facts: DocFacts): string[] {
  const problems: string[] = [];
  const docText = documentText(facts.document.extraction);
  const docFold = fold(docText);
  const docMeds = documentMeds(facts.document.extraction);
  const r = facts.record;
  const recordNames = [...r.conditions, ...r.medications, ...r.supplements, ...r.procedures.map((p) => p.name), ...r.labs.map((l) => l.name)].map(fold);

  const known = (item: string) => {
    const f = fold(item);
    return docFold.includes(f) || recordNames.some((n) => n === f || n.includes(f) || f.includes(n));
  };

  const allowed = new Set<number>(numbersIn(docText));
  for (const l of r.labs) {
    for (const n of [l.value]) if (n != null) allowed.add(n);
    for (const n of numbersIn(l.range ?? '')) allowed.add(n);
    for (const part of l.on.split('-').map(Number)) allowed.add(part);
  }
  for (const d of [facts.document.date, ...r.procedures.map((p) => p.on)]) for (const part of (d ?? '').split('-').filter(Boolean).map(Number)) allowed.add(part);
  if (r.cycle) {
    allowed.add(r.cycle.day);
    if (r.cycle.usual_length != null) allowed.add(r.cycle.usual_length);
  }
  for (const n of numbersIn(r.profile.age_range ?? '')) allowed.add(n);
  for (const sym of r.symptoms) allowed.add(sym.count);
  for (let i = 1; i <= 12; i++) allowed.add(i);

  for (const t of a.terms) if (!docFold.includes(fold(t.term))) problems.push(`the term ${t.term} is not in the document`);
  for (const u of a.urgent) if (!known(u.item)) problems.push(`urgent names ${u.item}, which is in neither the document nor her record`);
  for (const f of a.findings) if (!known(f.item)) problems.push(`a finding names ${f.item}, which is in neither the document nor her record`);
  for (const p of a.patterns) for (const i of p.items) if (!known(i)) problems.push(`a pattern names ${i}, which is in neither the document nor her record`);
  for (const c of a.considerations) for (const i of c.items) if (!known(i)) problems.push(`a consideration names ${i}, which is in neither the document nor her record`);

  const printedDoses = new Set(doseMatches(docText));
  const allMeds = [...docMeds, ...r.medications, ...r.supplements];
  const texts = [
    a.summary,
    ...a.urgent.flatMap((u) => [u.item, u.reason]),
    ...a.terms.flatMap((t) => [t.term, t.meaning]),
    ...a.findings.flatMap((f) => [f.item, f.explanation, f.relevance ?? '']),
    ...a.patterns.flatMap((p) => [p.title, p.explanation]),
    ...a.considerations.flatMap((c) => [c.condition, c.how_confirmed]),
    ...a.next_steps.flatMap((n) => [n.step, n.reason]),
    ...a.questions,
  ];
  for (const text of texts) {
    for (const n of numbersIn(text)) if (!allowed.has(n)) problems.push(`the number ${n} is in no fact`);
    for (const dose of doseMatches(text)) if (!printedDoses.has(dose)) problems.push(`it gives a dose (${dose}) the document did not print`);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      if (!changesMedication(sentence, allMeds)) continue;
      const credited = CREDITED.test(sentence);
      const fromDocument = docMeds.some((m) => fold(sentence).includes(fold(m))) || fold(sentence).split(' ').length > 3 && docFold.includes(fold(sentence).replace(/^.*?\b(say|says|said|states?|instructs?|tells?|lists?|recommends?)\s+(to\s+)?/, '').replace(/[.!?]$/, '').slice(0, 30));
      if (!credited || !fromDocument) problems.push('it tells her to change a medication that the document does not instruct');
    }
  }

  const urgentInDocument = URGENT_WORDS.test(docText);
  if (urgentInDocument && !a.urgent.length) problems.push('the document uses urgent words and nothing is marked urgent');

  for (const [key, max] of Object.entries(LIMITS)) {
    if ((a[key as keyof typeof LIMITS] as unknown[]).length > max) problems.push(`more than ${max} ${key}`);
  }
  return [...new Set(problems)];
}

const STR = { type: 'string' };
const STRS = { type: 'array', items: STR };
const OBJ = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

export const DOC_ANALYSIS_SCHEMA = {
  name: 'document_analysis',
  strict: true,
  schema: OBJ({
    urgent: { type: 'array', items: OBJ({ item: STR, reason: STR, action: { type: 'string', enum: ['contact_today', 'urgent_care'] } }) },
    summary: STR,
    terms: { type: 'array', items: OBJ({ term: STR, meaning: STR }) },
    findings: { type: 'array', items: OBJ({ item: STR, explanation: STR, relevance: { type: ['string', 'null'] } }) },
    patterns: { type: 'array', items: OBJ({ title: STR, items: STRS, explanation: STR }) },
    considerations: { type: 'array', items: OBJ({ condition: STR, items: STRS, confidence: { type: 'string', enum: ['low', 'moderate', 'high'] }, how_confirmed: STR }) },
    next_steps: { type: 'array', items: OBJ({ step: STR, reason: STR }) },
    questions: STRS,
  }),
};
```

Run: `npx tsx --test src/lib/documentAnalysisCheck.test.ts`
Expected: PASS. If one rule's test fails because of a pattern, fix the rule, not the test. Keep the `fromDocument` test simple: credit plus a document medication named in the sentence is enough. Ledger any simplification.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/textChecks.ts supabase/functions/document-analysis/facts.ts supabase/functions/document-analysis/check.ts src/lib/documentAnalysisCheck.test.ts
git commit -m "Document analysis rules: terms and items must be in the document or her record, numbers in a fact, doses only as printed, medication changes only as the document's credited instruction, urgent words honoured"
```

---

### Task 2: Storage

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261020120000_document_analyses.sql`
- Test: `ciatta-mobile-app/supabase/tests/document_analyses.test.sql`
- Modify: `ciatta-mobile-app/src/lib/dataExport.ts` and `dataExport.test.ts` (export `document_analyses`)

**Interfaces:**
- Produces:
  - table `document_analyses (id, user_id, document_id not null references documents on delete cascade, model, facts_hash, analysis jsonb, created_at)`: select own; no client writes
  - `store_document_analysis(p_user uuid, p_document uuid, p_model text, p_facts_hash text, p_analysis jsonb) returns uuid`, executable by `service_role` only

- [ ] **Step 1: Write the failing SQL test**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.local'),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.local');
insert into public.documents (id, user_id, storage_path, doc_type) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a8/documents/x.pdf', 'visit');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';
select throws_ok($$ select public.store_document_analysis('00000000-0000-0000-0000-0000000000a8', '60000000-0000-0000-0000-000000000001', 'm', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'she cannot store an analysis herself');

reset role;
set local role service_role;
select throws_ok($$ select public.store_document_analysis('00000000-0000-0000-0000-0000000000b8', '60000000-0000-0000-0000-000000000001', 'm', 'h', '{"summary":"x"}'::jsonb) $$,
  '42501', null, 'not against someone else''s document');
select lives_ok($$ select public.store_document_analysis('00000000-0000-0000-0000-0000000000a8', '60000000-0000-0000-0000-000000000001', 'm', 'h', '{"summary":"x"}'::jsonb) $$,
  'the function stores it against her document');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';
select is((select count(*)::int from public.document_analyses), 1, 'she can read it');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}';
select is((select count(*)::int from public.document_analyses), 0, 'someone else cannot');

reset role;
delete from public.documents where id = '60000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.document_analyses), 0, 'removing the document removes its analysis');

select * from finish();
rollback;
```

Save it as `supabase/tests/document_analyses.test.sql`. Run `supabase test db`.
Expected: FAIL, the function does not exist.

- [ ] **Step 2: Write the migration**

```sql
-- The analysis of a document she added: written only by the
-- document-analysis function with the server's key after its check, read
-- only by her, removed with its document.

create table public.document_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  model text not null,
  facts_hash text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);
create index document_analyses_document on public.document_analyses (document_id, created_at desc);
alter table public.document_analyses enable row level security;
create policy document_analyses_own on public.document_analyses for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.document_analyses from anon, authenticated;
grant select on public.document_analyses to authenticated;
grant all on public.document_analyses to service_role;

create function public.store_document_analysis(p_user uuid, p_document uuid, p_model text, p_facts_hash text, p_analysis jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if p_user is null or not exists (select 1 from public.documents where id = p_document and user_id = p_user) then
    raise exception 'not her document' using errcode = '42501';
  end if;
  insert into public.document_analyses (user_id, document_id, model, facts_hash, analysis)
  values (p_user, p_document, p_model, p_facts_hash, p_analysis)
  returning document_analyses.id into new_id;
  return new_id;
end $$;
revoke execute on function public.store_document_analysis(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.store_document_analysis(uuid, uuid, text, text, jsonb) to service_role;
```

Save it as `supabase/migrations/20261020120000_document_analyses.sql` and apply it (`supabase migration up`).

In `src/lib/dataExport.ts`, add `'document_analyses'` to `EXPORT_TABLES` after `'lab_analyses'`, and a description `document_analyses: 'The clinical AI analyses of documents you added, each with the model and the day it was written.'`. There's no test change: `dataExport.test` only lists skipped tables.

- [ ] **Step 3: Run the SQL tests and the suite**

Run: `supabase test db && npm test`
Expected: `Result: PASS`, all pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261020120000_document_analyses.sql supabase/tests/document_analyses.test.sql src/lib/dataExport.ts
git commit -m "Document analyses stored only by the function with the server's key, read only by her, removed with their document, in her data download"
```

---

### Task 3: The `document-analysis` function

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/document-analysis/index.ts`
- Create: `ciatta-mobile-app/supabase/functions/document-analysis/fake.ts`
- Create: `ciatta-mobile-app/scripts/document-analysis-e2e.mts`; npm script `e2e:document-analysis`
- Modify: `ciatta-mobile-app/scripts/lab-analysis-e2e.env` (add `DOCUMENT_ANALYSIS_FAKE_MODEL=1`)

**Interfaces:**
- Consumes: Tasks 1 and 2, `claim_lab_analysis`, `save_document` (Part A, used by the e2e to make a document).
- Produces:
  - `POST /functions/v1/document-analysis` with `{ documentId, cycle? }`
  - 200 `{ analysis, model, created_at, facts_hash }`
  - 404 when the document is not hers
  - 422 when the analysis could not be checked

- [ ] **Step 1: The fake and the e2e first**

`fake.ts`:

```ts
// A stand in for the model, for local tests only. good: built from the
// document's own words. bad: a dose and advice the document never gave.

import type { DocAnalysis } from './check.ts';
import type { DocFacts } from './facts.ts';

export function fakeDocAnalysis(facts: DocFacts, kind: 'good' | 'bad'): DocAnalysis {
  if (kind === 'bad') {
    return { urgent: [], summary: 'Take 900 mg daily and stop all your medications.', terms: [], findings: [], patterns: [], considerations: [], next_steps: [], questions: [] };
  }
  const v = (facts.document.extraction.visit ?? {}) as { diagnoses?: { name: string }[] };
  const first = v.diagnoses?.[0]?.name;
  return {
    urgent: [],
    summary: 'This document was read and filed into your record.',
    terms: [],
    findings: first ? [{ item: first, explanation: `${first} is named in this document.`, relevance: null }] : [],
    patterns: [],
    considerations: [],
    next_steps: [],
    questions: ['What does this document mean for me?'],
  };
}
```

`scripts/document-analysis-e2e.mts`: model it on `scripts/lab-analysis-e2e.mts`.
1. Make two users.
2. As the first user, call `rpc/save_document` with a `visit` extraction whose `metadata.extraction` has `visit.diagnoses: [{name: 'Endometriosis', status: 'new'}]` and `p_filings: {}`.
3. Call `document-analysis` with `x-fake-model` set to `good`, `bad-then-good` and `always-bad`.

Expected: 200 and stored, then 200 and stored after the retry, then 422 with nothing new stored.

4. Call it as the other user. Expected: 404.
5. Call `rpc/store_document_analysis` directly as the user. Expected: refused, not ok.

Print PASS or FAIL for each, and delete the users at the end. Add the line `DOCUMENT_ANALYSIS_FAKE_MODEL=1` to `scripts/lab-analysis-e2e.env`.

Serve the functions and run it.
Expected: the analysis checks FAIL, because there's no function yet.

- [ ] **Step 2: Write the function**

`index.ts`:

```ts
// A clinical AI analysis of one medical document she added: an
// explanation of its terms and findings, and a full clinical read across
// her record.
//
// Runs as her: every read is hers under RLS. The facts are the document's
// own extraction plus her record. The model's answer is checked against
// them (check.ts) and retried once; only an answer that passes is stored,
// with the server's key, for the person the verified token names.
//
// Logging: counts, the model name and rejection reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { checkDocumentAnalysis, DOC_ANALYSIS_SCHEMA, type DocAnalysis, readDocAnalysis } from './check.ts';
import { fakeDocAnalysis } from './fake.ts';
import { type DocFacts, extractionFingerprint, readCycle } from './facts.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o';
const CONSIDERATIONS_OFF = Deno.env.get('LAB_ANALYSIS_CONSIDERATIONS') === 'off';
const FAKE_ALLOWED = Deno.env.get('DOCUMENT_ANALYSIS_FAKE_MODEL') === '1' && /^https?:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url);
const NOT_CHECKED = 'The analysis could not be checked, so it is not shown. The document above is unaffected.';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const INSTRUCTIONS = [
  'You are a clinician explaining a medical document to the patient it belongs to. Write plainly, warmly and precisely.',
  'Use only the facts given: the document and her record. Quote values and doses exactly as written. Do not compute percentages or differences.',
  'urgent: anything the document says needs prompt attention, with action contact_today or urgent_care; empty when nothing is urgent.',
  'summary: two or three sentences on what the document says.',
  'terms: medical words the document itself uses, each explained in plain language.',
  'findings: what the document found or decided, each explained, with relevance to her record when the facts support it.',
  'patterns: how this document connects with her record (labs, conditions, medications, symptoms, cycle), naming the items.',
  'considerations: conditions worth discussing with her clinician, with the items behind each, a confidence of low, moderate or high, and how a clinician would confirm it. Never declare she has a condition the document does not name.',
  'next_steps: practical next steps, such as follow ups the document lists. questions: questions she could ask her clinician.',
  'Never suggest a dose, and never tell her to start, stop or change a medication yourself. You may repeat the document’s own medication instructions only by saying the document says so, for example: "Your visit summary says to stop ibuprofen."',
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

  const { data: doc } = await db.from('documents').select('id, doc_type, title, occurred_at, metadata').eq('id', documentId).neq('doc_type', 'lab_report').maybeSingle();
  if (!doc) return json({ error: 'That document was not found.' }, 404);

  const fake = FAKE_ALLOWED ? req.headers.get('x-fake-model') : null;
  if (!fake && !openAiKey) return json({ error: 'Document analysis is not set up yet' }, 503);

  const { data: allowed, error: claimError } = await db.rpc('claim_lab_analysis');
  if (claimError) return json({ error: 'Could not check today\'s analyses' }, 500);
  if (allowed !== true) return json({ error: 'That is the most analyses for today. Try again tomorrow.' }, 429);

  const extraction = (doc.metadata?.extraction ?? {}) as Record<string, unknown>;
  const facts = await gatherFacts(db, uid, doc, extraction, readCycle(body.cycle));
  const hash = extractionFingerprint(extraction);

  let attempt = 0;
  let reasons: string[] = [];
  let analysis: DocAnalysis | null = null;
  while (attempt < 2 && !analysis) {
    attempt++;
    const raw = fake ? fakeDocAnalysis(facts, fake === 'always-bad' || (fake === 'bad-then-good' && attempt === 1) ? 'bad' : 'good') : await callModel(facts, reasons);
    const read = readDocAnalysis(raw);
    if (!read) {
      reasons = ['the answer was not in the required shape'];
      continue;
    }
    if (CONSIDERATIONS_OFF) read.considerations = [];
    const problems = checkDocumentAnalysis(read, facts);
    if (problems.length) {
      reasons = problems;
      console.log(`document-analysis: attempt ${attempt} refused (${problems.length} problems)`);
      continue;
    }
    analysis = read;
  }
  if (!analysis) return json({ error: NOT_CHECKED }, 422);

  const model = fake ? `fake:${fake}` : MODEL;
  const admin = createClient(url, serviceKey);
  const { error: storeError } = await admin.rpc('store_document_analysis', { p_user: uid, p_document: documentId, p_model: model, p_facts_hash: hash, p_analysis: analysis });
  if (storeError) return json({ error: 'The analysis could not be saved.' }, 500);
  console.log(`document-analysis: stored, ${doc.doc_type}, attempt ${attempt}`);
  return json({ analysis, model, created_at: new Date().toISOString(), facts_hash: hash });
});

async function callModel(facts: DocFacts, reasons: string[]): Promise<unknown> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: DOC_ANALYSIS_SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          { role: 'user', content: `Facts:\n${JSON.stringify(facts)}` },
          ...(reasons.length ? [{ role: 'user', content: `Your previous answer was refused because: ${reasons.join('; ')}. Answer again following every rule.` }] : []),
        ],
      }),
    });
    if (!res.ok) {
      console.log(`document-analysis: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? JSON.parse(text) : null;
  } catch (e) {
    console.log(`document-analysis: model failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function gatherFacts(db: any, uid: string, doc: any, extraction: Record<string, unknown>, cycle: DocFacts['record']['cycle']): Promise<DocFacts> {
  const on = String(doc.occurred_at).slice(0, 10);
  const yearAgo = new Date(Date.parse(on) - 365 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: profile }, { data: conditions }, { data: meds }, { data: supps }, { data: procs }, { data: labs }, { data: episodes }] = await Promise.all([
    db.from('profiles').select('onboarding, body').eq('id', uid).maybeSingle(),
    db.from('conditions').select('name, status, kind').neq('status', 'resolved'),
    db.from('medications').select('name').is('stopped_on', null),
    db.from('supplements').select('name').is('stopped_on', null),
    db.from('procedures').select('name, performed_on').order('performed_on', { ascending: false }).limit(50),
    db.from('results').select('test_name, value, value_text, unit, reference_text, flag, occurred_at').gte('occurred_at', `${yearAgo}T00:00:00Z`).order('occurred_at', { ascending: false }).limit(500),
    db.from('episodes').select('symptoms, kinds').gte('occurred_on', new Date(Date.parse(on) - 15 * 86_400_000).toISOString().slice(0, 10)).lte('occurred_on', new Date(Date.parse(on) + 15 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const latest = new Map<string, DocFacts['record']['labs'][number]>();
  for (const l of (labs ?? []) as Record<string, unknown>[]) {
    const k = String(l.test_name).toLowerCase();
    if (latest.has(k)) continue;
    latest.set(k, { name: String(l.test_name), value: l.value == null ? null : Number(l.value), value_text: (l.value_text as string | null) ?? null, unit: (l.unit as string | null) ?? null, range: (l.reference_text as string | null) ?? null, flag: (l.flag as string | null) ?? null, on: String(l.occurred_at).slice(0, 10) });
  }
  const counts = new Map<string, number>();
  for (const e of (episodes ?? []) as { symptoms: string[]; kinds: string[] }[]) {
    for (const n of [...(e.symptoms ?? []), ...(e.kinds ?? []).filter((k) => k !== 'Period')]) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const names = (rs: { name: string }[] | null) => [...new Set((rs ?? []).map((r) => r.name).filter(Boolean))];
  return {
    document: { type: String(doc.doc_type), date: on, title: doc.title ?? null, clinician: (doc.metadata?.clinician as string | null) ?? null, facility: (doc.metadata?.facility as string | null) ?? null, extraction },
    record: {
      conditions: names(conditions),
      medications: names(meds),
      supplements: names(supps),
      procedures: ((procs ?? []) as { name: string; performed_on: string | null }[]).map((p) => ({ name: p.name, on: p.performed_on })),
      labs: [...latest.values()].slice(0, 80),
      cycle,
      symptoms: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
      profile: {
        age_range: (profile?.onboarding?.ageRange as string | null) ?? null,
        life_stage: (profile?.onboarding?.lifeStage as string | null) ?? null,
        gender: (profile?.body?.gender as string | null) ?? null,
      },
    },
  };
}
```

- [ ] **Step 3: Run the checks**

Run `npm run e2e:document-analysis`. Expected: `all passed`.
Run `deno check --node-modules-dir=none supabase/functions/document-analysis/index.ts`. Expected: `Check`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/document-analysis scripts/document-analysis-e2e.mts scripts/lab-analysis-e2e.env package.json
git commit -m "document-analysis function: facts from the document and her record, a strict schema, every term, item, number, dose and instruction checked, one retry, stored only by the function"
```

---

### Task 4: The analysis on the document screen

**Files:**
- Create: `ciatta-mobile-app/src/lib/documentAnalysis.ts`
- Test: `ciatta-mobile-app/src/lib/documentAnalysis.test.ts`
- Modify: `ciatta-mobile-app/src/data/repo.ts`
- Modify: `ciatta-mobile-app/src/screens/DocumentScreen.tsx`

**Interfaces:**
- Produces:
  - In `documentAnalysis.ts`:
    - `type StoredDocAnalysis = { analysis: DocAnalysis; model: string; createdAt: string; factsHash: string }`, with the `DocAnalysis` type re-declared (the same shape)
    - `readStoredDocAnalysis(row)`
    - `extractionFingerprint(extraction)`, identical to the function's, with a parity test
    - `documentUrgentLines(extraction, analysis): string[]`
    - `docAnalysisHtml(title, on, stored): string`
  - On the repo:
    - `loadDocumentAnalysis(documentId): Promise<StoredDocAnalysis | null>`
    - `analyzeDocument(documentId, cycle): Promise<StoredDocAnalysis>`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractionFingerprint as serverFingerprint } from '../../supabase/functions/document-analysis/facts.ts';
import { docAnalysisHtml, documentUrgentLines, extractionFingerprint, readStoredDocAnalysis } from './documentAnalysis';

const analysis = { urgent: [], summary: 'A summary.', terms: [{ term: 'Impression', meaning: 'The conclusion.' }], findings: [], patterns: [], considerations: [], next_steps: [], questions: [] };

test('the app fingerprints a document exactly as the function does', () => {
  const x = { doc_type: 'imaging', report: { impression: 'Benign.', findings: 'A cyst.' }, date: '2026-09-02' };
  assert.equal(extractionFingerprint(x), serverFingerprint(x));
  assert.equal(extractionFingerprint({ date: '2026-09-02', report: { findings: 'A cyst.', impression: 'Benign.' }, doc_type: 'imaging' }), serverFingerprint(x));
});

test('the urgent banner shows the document’s own urgent words, and the analysis’s urgent items', () => {
  const x = { report: { impression: 'Urgent surgical consultation recommended. No other findings.' } };
  const lines = documentUrgentLines(x, { ...analysis, urgent: [{ item: 'Free fluid', reason: 'May need surgery.', action: 'urgent_care' }] });
  assert.match(lines[0], /The document says: Urgent surgical consultation recommended\./);
  assert.match(lines[1], /Free fluid\. May need surgery\. Seek urgent care\./);
  assert.deepEqual(documentUrgentLines({ report: { impression: 'Benign cyst.' } }, null), []);
});

test('a stored row is read only in shape', () => {
  assert.equal(readStoredDocAnalysis(null), null);
  assert.equal(readStoredDocAnalysis({ analysis, model: 'gpt-4o', created_at: '2026-10-15T00:00:00Z', facts_hash: 'h' })?.analysis.terms.length, 1);
});

test('the printed analysis carries the label', () => {
  assert.match(docAnalysisHtml('Ultrasound', '2026-09-02', { analysis, model: 'gpt-4o', createdAt: '2026-10-15T00:00:00Z', factsHash: 'h' }), /Not a diagnosis/);
});
```

Save as `src/lib/documentAnalysis.test.ts` and run it.
Expected: FAIL, the module cannot be found.

- [ ] **Step 2: Implement `documentAnalysis.ts`**

```ts
// The document analysis as the app reads, dates and prints it, and the
// urgent banner, which shows the document's own urgent words whatever the
// analysis says.

import { labDay } from './labs';

export type DocAnalysis = {
  urgent: { item: string; reason: string; action: 'contact_today' | 'urgent_care' }[];
  summary: string;
  terms: { term: string; meaning: string }[];
  findings: { item: string; explanation: string; relevance: string | null }[];
  patterns: { title: string; items: string[]; explanation: string }[];
  considerations: { condition: string; items: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[];
  next_steps: { step: string; reason: string }[];
  questions: string[];
};

export type StoredDocAnalysis = { analysis: DocAnalysis; model: string; createdAt: string; factsHash: string };

const ACTION: Record<'contact_today' | 'urgent_care', string> = { contact_today: 'Contact your clinician today', urgent_care: 'Seek urgent care' };
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

export function readStoredDocAnalysis(row: unknown): StoredDocAnalysis | null {
  const r = (row && typeof row === 'object' ? row : null) as Record<string, unknown> | null;
  const a = (r?.analysis && typeof r.analysis === 'object' ? r.analysis : null) as Record<string, unknown> | null;
  if (!r || !a || typeof a.summary !== 'string' || !a.summary.trim() || typeof r.model !== 'string') return null;
  return {
    analysis: {
      summary: a.summary,
      urgent: arr(a.urgent) as DocAnalysis['urgent'],
      terms: arr(a.terms) as DocAnalysis['terms'],
      findings: arr(a.findings) as DocAnalysis['findings'],
      patterns: arr(a.patterns) as DocAnalysis['patterns'],
      considerations: arr(a.considerations) as DocAnalysis['considerations'],
      next_steps: arr(a.next_steps) as DocAnalysis['next_steps'],
      questions: arr(a.questions).filter((q): q is string => typeof q === 'string'),
    },
    model: r.model,
    createdAt: String(r.created_at ?? ''),
    factsHash: String(r.facts_hash ?? ''),
  };
}

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}
export const extractionFingerprint = (extraction: unknown) => JSON.stringify(stable(extraction));

const URGENT = /\b(urgent|urgently|critical|emergency|call 911|immediately|stat|seek (?:immediate|emergency) care)\b/i;
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => strings(x, out));
  return out;
}

export function documentUrgentLines(extraction: unknown, analysis: DocAnalysis | null): string[] {
  const lines = strings(extraction)
    .flatMap((t) => t.split(/(?<=[.!?])\s+/))
    .filter((sentence) => URGENT.test(sentence))
    .map((sentence) => `The document says: ${sentence.trim()}`);
  for (const u of analysis?.urgent ?? []) lines.push(`${u.item}. ${u.reason} ${ACTION[u.action]}.`);
  return [...new Set(lines)];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function docAnalysisHtml(title: string, on: string, stored: StoredDocAnalysis): string {
  const a = stored.analysis;
  const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const section = (h: string, body: string) => (body ? `<h2>${h}</h2>${body}` : '');
  return `<html><body style="font-family: -apple-system, Helvetica; padding: 24px; color: #161616">
<h1>${esc(title)}, ${esc(labDay(on))}</h1>
<p><strong>Clinical AI analysis. Not a diagnosis. Discuss it with your clinician.</strong></p>
<p>Written by ${esc(stored.model)} on ${esc(labDay(stored.createdAt.slice(0, 10)))}.</p>
${section('Urgent', list(a.urgent.map((u) => `${u.item}: ${u.reason} ${ACTION[u.action]}.`)))}
${section('Summary', `<p>${esc(a.summary)}</p>`)}
${section('Terms explained', list(a.terms.map((t) => `${t.term}: ${t.meaning}`)))}
${section('Findings', list(a.findings.map((f) => `${f.item}: ${f.explanation}${f.relevance ? ` ${f.relevance}` : ''}`)))}
${section('Patterns', list(a.patterns.map((p) => `${p.title}: ${p.explanation}`)))}
${section('Conditions to consider', list(a.considerations.map((c) => `${c.condition} (${c.confidence} confidence): ${c.how_confirmed}`)))}
${section('Next steps', list(a.next_steps.map((n) => `${n.step}: ${n.reason}`)))}
${section('Questions for your clinician', list(a.questions))}
</body></html>`;
}
```

Run the test. Expected: PASS.

- [ ] **Step 3: The repo**

Interface:

```ts
  loadDocumentAnalysis(documentId: string): Promise<StoredDocAnalysis | null>;
  analyzeDocument(documentId: string, cycle: { day: number; phase: string | null; usual_length: number | null } | null): Promise<StoredDocAnalysis>;
```

**Demo:** declare `const demoDocAnalyses = new Map<string, StoredDocAnalysis>();`, then:

```ts
    loadDocumentAnalysis: async (id) => demoDocAnalyses.get(id) ?? null,
    analyzeDocument: async (id) => {
      const d = demoDocuments.find((x) => x.id === id);
      const stored: StoredDocAnalysis = {
        analysis: {
          urgent: [],
          summary: `This example ${d ? DOC_TYPE_LABEL[d.docType].toLowerCase() : 'document'} was read and filed. In the real app a clinical AI analysis explains it here.`,
          terms: [],
          findings: [],
          patterns: [],
          considerations: [],
          next_steps: [],
          questions: ['What does this document mean for me?'],
        },
        model: 'example',
        createdAt: new Date().toISOString(),
        factsHash: d ? extractionFingerprint(toSnake(d.extraction)) : '',
      };
      demoDocAnalyses.set(id, stored);
      return stored;
    },
```

**Real:**

```ts
    async loadDocumentAnalysis(documentId) {
      const rows = must(
        await db.from('document_analyses').select('analysis, model, created_at, facts_hash').eq('document_id', documentId).order('created_at', { ascending: false }).limit(1),
      ) as unknown[] | null;
      return readStoredDocAnalysis(rows?.[0] ?? null);
    },
    async analyzeDocument(documentId, cycle) {
      const { data, error } = await db.functions.invoke('document-analysis', { body: { documentId, cycle } });
      if (error) {
        let sentence = 'The analysis could not be written just now.';
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (typeof body?.error === 'string') sentence = body.error;
        } catch {
          // Not JSON; the plain sentence stands.
        }
        throw new Error(sentence);
      }
      const stored = readStoredDocAnalysis(data);
      if (!stored) throw new Error('The analysis could not be written just now.');
      return stored;
    },
```

Imports: `docAnalysisHtml` is not needed here. Import `readStoredDocAnalysis`, `extractionFingerprint`, `type StoredDocAnalysis` from `../lib/documentAnalysis`, and `DOC_TYPE_LABEL` from `../lib/documents`.

- [ ] **Step 4: The screen**

In `DocumentScreen`, add state, the auto analysis on first open, and the section at `{/* PART B ANALYSIS */}`.
- Put the hooks before the early return.
- The cycle comes from `useCycleInsights()` and `cycleDayAt(doc.on, …)`, as on the lab report screen.
- The stale test is `stored.factsHash !== extractionFingerprint(toSnake(doc.extraction))`.

The pieces:
- the urgent banner: `documentUrgentLines(toSnake(doc.extraction), stored?.analysis ?? null)`
- the label
- written by and on
- the stale line ("This document has changed since this was written."), when stale
- the summary card
- the lists Terms explained, Findings, Patterns, Conditions to consider (with a confidence chip), Next steps, Questions, using the same `AnalysisList` pattern as `LabReportScreen`, copied into this file
- Share or Print (`Print.printToFileAsync({ html: docAnalysisHtml(...) })` then `Share.share`)
- **Analyze Again**, always shown

Use the lab report screen's exact styles for the urgent card, label, chip and lists, so the two read the same.

- [ ] **Step 5: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass.

```bash
git add src/lib/documentAnalysis.ts src/lib/documentAnalysis.test.ts src/data/repo.ts src/screens/DocumentScreen.tsx
git commit -m "Document analysis on the document screen: the document's own urgent words first, summary, terms explained, findings, patterns, conditions to consider, next steps and questions; labelled, dated, shareable"
```

---

### Task 5: The Privacy Policy says documents

**Files:**
- Modify: `ciatta-landing/src/legal/privacy.ts`, `ciatta-landing/src/legal/config.ts`

- [ ] **Step 1: Change the wording**

In `privacy.ts`:
- Change "Lab reports you add: the results read from them, and the original file, so you can check any result against it." to: "Documents you add, such as lab reports, visit summaries, imaging and pathology reports, prescriptions, referral letters and insurance cards: what was read from them and filed into your record with your check, and the original file, so you can check anything against it."
- In the app providers table, change the OpenAI row to: "Reads lab reports, medical documents and meal photos you add, and writes the clinical AI analyses of lab reports and documents."
- Change "You can remove a lab report you added, with its results, its original file and its analysis." to: "You can remove a lab report or document you added, with what was filed from it, its original file and its analysis."

Keep `updated` in `config.ts` as the deploy date.

- [ ] **Step 2: Build and commit**

Run: `cd ../ciatta-landing && npx tsc --noEmit && npx vite build`
Expected: built.

```bash
git add ciatta-landing/src/legal/privacy.ts ciatta-landing/src/legal/config.ts
git commit -m "Privacy Policy: documents you add, read and filed with your check, and analysed"
```

Deploying the site is an outward step; ask the user first.

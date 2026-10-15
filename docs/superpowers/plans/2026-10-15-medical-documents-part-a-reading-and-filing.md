# Medical Documents Part A: Reading and Filing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** She scans or uploads any medical document. Ciatta works out what it is and copies out what it says. She checks it. Each item is filed into Conditions, Medications, Procedures, Referrals or Health Plans, the original is kept, and the document opens on its own screen.

**Architecture:**
- **Reading:** a new `document-scan` edge function reads documents with one strict schema that carries a `doc_type` and one section per type. It shares the PDF chunking with `lab-scan` through `supabase/functions/_shared/`.
- **Checking in the app:** pure helpers in `src/lib/documents.ts` read the model's answer, match items to what she already has, and build the save payload.
- **Saving:** a security invoker RPC, `save_document`, writes the document and every filed row together. Each filed row carries `provenance = 'DOCUMENT'` and a `document_id` that cascades on removal.
- **Labs:** a lab report found this way is handed to the existing Add a Lab Report flow.

**Tech Stack:** Expo 57 / React Native, Supabase Postgres + Storage + Edge Functions (Deno, `npm:pdf-lib@1.17.1`), node:test via `tsx --test`, pgTAP, Deno test.

**Spec:** `docs/superpowers/specs/2026-10-15-medical-documents-design.md` (Part A).

## Spec amendments carried by this plan

- **Add a Lab Report keeps its own capture code.** The new screen has its own capture hook (`src/ui/useCapture.ts`). Moving Add a Lab Report onto the hook is left for later, so the working lab flow is not disturbed.
- **Allergies get a new `condition_kind` value** in a migration of their own. Postgres cannot use a new enum value in the transaction that adds it.
- **The Health Details lists stay in step.** When `profiles.onboarding.details` already holds a conditions or medications list (what Health Details shows once she has edited it), `save_document` appends the new names to it, so a filed item is visible there too.
- **Filed rows only.** Filing links back to the document through `document_id`. Rows that were already present are linked in `documents.metadata.linked` and never changed, except a medication the document stops, which gets `stopped_on`. Removing the document does not undo that.

## Global Constraints

- Run app commands from `ciatta-mobile-app/`: `npm test`, `npx tsc --noEmit`, `supabase test db`.
- UI copy has no em dash, en dash or hyphen. Model text renders through `displayCopy()`.
- Jost and the existing design, on Ground (`DetailScreen`).
- Health data is never logged.
- Functions run as her (JWT) under RLS.
- Nothing is filed without her check. Nothing is inferred.

## Review Focus

1. **A visit summary listing a medication she already has.** She expects it shown as "Already in your Medications" and not added twice. Pinned in Task 2 (`reviewItems` tests).
2. **A discharge paper that stops a medication she takes.** She expects that medication marked stopped on the document's date, not a second copy. Pinned in Task 2 and Task 4 (SQL test).
3. **One invalid item** (an empty name after her edit). She expects the whole document saved or nothing. Pinned in Task 4 (SQL atomicity test).
4. **Removing a document.** She expects what it filed to go, and what she already had to stay. Pinned in Task 4.
5. **The model calls it the wrong type.** She can change the type and the file is read again as that type. Pinned in Task 6 (screen) and Task 3 (the function honours an `as` hint, in the e2e test).

---

### Task 1: Shared chunking for both readers

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/_shared/chunks.ts` (moved from `lab-scan/scan.ts`)
- Create: `ciatta-mobile-app/supabase/functions/_shared/pdf.ts` (moved from `lab-scan/pdf.ts`)
- Move: `lab-scan/pdf.test.ts` to `_shared/pdf.test.ts`
- Modify: `ciatta-mobile-app/supabase/functions/lab-scan/index.ts`
- Modify: `ciatta-mobile-app/src/lib/labScanChunks.test.ts`
- Delete: `lab-scan/scan.ts`, `lab-scan/pdf.ts`

**Interfaces:**
- Produces: `chunkRanges`, `CHUNK_PAGES`, `ChunkRead`, `mergeChunks` from `_shared/chunks.ts`; `pageCount`, `splitPdf` from `_shared/pdf.ts`. These are unchanged signatures, now importable by any function as `../_shared/...`.

- [ ] **Step 1: Point the tests at the new place first**

In `src/lib/labScanChunks.test.ts`, change the import path to `'../../supabase/functions/_shared/chunks.ts'`.
Run: `npx tsx --test src/lib/labScanChunks.test.ts`
Expected: FAIL, the module cannot be found.

- [ ] **Step 2: Move the files**

```bash
mkdir -p supabase/functions/_shared
git mv supabase/functions/lab-scan/scan.ts supabase/functions/_shared/chunks.ts
git mv supabase/functions/lab-scan/pdf.ts supabase/functions/_shared/pdf.ts
git mv supabase/functions/lab-scan/pdf.test.ts supabase/functions/_shared/pdf.test.ts
```

In `lab-scan/index.ts`, change the two imports to `'../_shared/pdf.ts'` and `'../_shared/chunks.ts'`. Change the first comment line of `_shared/chunks.ts` to: `// Reading a long document in pieces, and putting the pieces back together. Shared by lab-scan and document-scan.`

- [ ] **Step 3: Run everything that touches them**

Run: `npx tsx --test src/lib/labScanChunks.test.ts && deno test --node-modules-dir=none supabase/functions/_shared/pdf.test.ts && deno check --node-modules-dir=none supabase/functions/lab-scan/index.ts`
Expected: PASS, `ok | 1 passed`, and `Check` with no errors.

- [ ] **Step 4: Prove the hosted bundler accepts `_shared`**

Run `supabase functions serve lab-scan` locally and POST it an unsigned request: `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:54321/functions/v1/lab-scan -d '{}'`.
Expected: `401`. The function boots with the shared imports.

- [ ] **Step 5: Commit**

```bash
git add -A supabase/functions/_shared supabase/functions/lab-scan src/lib/labScanChunks.test.ts
git commit -m "PDF chunking and splitting move to supabase/functions/_shared, for lab-scan and document-scan to share"
```

---

### Task 2: The rules for reading, matching and saving a document

**Files:**
- Create: `ciatta-mobile-app/src/lib/documents.ts`
- Test: `ciatta-mobile-app/src/lib/documents.test.ts`

**Interfaces:**
- Produces:
  - `type DocType = 'lab_report' | 'visit' | 'imaging' | 'pathology' | 'prescription' | 'referral' | 'insurance' | 'other'`
  - `DOC_TYPE_LABEL: Record<DocType, string>`
  - `type DocMed = { name: string; strength: string | null; dose: string | null; frequency: string | null; route: string | null; prescriber: string | null; date: string | null }`
  - `type DocumentScan` (camelCase of the function's response; see the code below)
  - `readDocumentScan(json: unknown): DocumentScan`
  - `foldName(s: string): string`
  - `type Existing = { conditions: { id: string; name: string }[]; medications: { id: string; name: string; stoppedOn: string | null }[] }`
  - `type Target = 'conditions' | 'allergies' | 'medications' | 'stop_medications' | 'procedures' | 'referrals' | 'insurance'`
  - `type ReviewItem = { key: string; target: Target; title: string; detail: string | null; keep: boolean; existingId: string | null; value: Record<string, string | null> }`
  - `TARGET_HEADING: Record<Target, string>`
  - `reviewItems(scan: DocumentScan, existing: Existing): ReviewItem[]`
  - `type DocumentFilings = { conditions: { name: string; status: 'active' | 'unknown' }[]; allergies: { name: string; reaction: string | null }[]; medications: { name: string; dose: string | null; started_on: string | null; stopped_on: string | null; route: string | null; prescriber: string | null }[]; stop_medications: { id: string }[]; procedures: { name: string; performed_on: string | null }[]; referrals: { specialty: string; clinician: string | null; reason: string | null; referred_by: string | null; referred_on: string | null }[]; linked: { table: string; id: string }[] }`
  - `buildFilings(items: ReviewItem[], docDate: string | null): DocumentFilings`
  - `insuranceFrom(items: ReviewItem[]): { provider: string; plan: string | null; member_id: string | null } | null`

- [ ] **Step 1: Write the failing tests**

`src/lib/documents.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildFilings, foldName, insuranceFrom, readDocumentScan, reviewItems, TARGET_HEADING } from './documents';

const med = (name: string, extra: Record<string, unknown> = {}) => ({ name, strength: null, dose: null, frequency: null, route: null, prescriber: null, date: null, ...extra });

const visitJson = {
  not_medical: false,
  doc_type: 'visit',
  title: 'After Visit Summary',
  date: '2026-09-02',
  clinician: 'Dr A Rivera',
  facility: 'Mercy Clinic',
  multiple_dates: false,
  unreadable_pages: [],
  visit: {
    reason: 'Pelvic pain',
    diagnoses: [{ name: 'Endometriosis', status: 'new' }, { name: 'Iron deficiency anemia', status: 'existing' }, { name: '', status: 'new' }],
    medications_started: [med('Ferrous sulfate', { strength: '325 mg', frequency: 'once daily' })],
    medications_stopped: [med('Ibuprofen')],
    medications_changed: [],
    procedures: [{ name: 'Pelvic ultrasound', date: '2026-09-02' }],
    follow_ups: [{ specialty: 'Gynecology', clinician: 'Dr Chen', reason: 'Discuss laparoscopy', when: 'in 4 weeks' }],
    instructions: ['Stop ibuprofen and use acetaminophen for pain.'],
    allergies: [{ substance: 'Penicillin', reaction: 'Hives' }],
  },
  report: null,
  prescription: null,
  referral: null,
  insurance: null,
  other: null,
};

test('a visit summary is read into shape, and empty items are dropped', () => {
  const s = readDocumentScan(visitJson);
  assert.equal(s.docType, 'visit');
  assert.equal(s.date, '2026-09-02');
  assert.equal(s.clinician, 'Dr A Rivera');
  assert.deepEqual(s.visit?.diagnoses.map((d) => d.name), ['Endometriosis', 'Iron deficiency anemia']);
  assert.equal(s.visit?.medicationsStarted[0].strength, '325 mg');
  assert.equal(s.visit?.allergies[0].substance, 'Penicillin');
});

test('an unknown type is read as other, and nonsense is not medical', () => {
  assert.equal(readDocumentScan({ ...visitJson, doc_type: 'poem' }).docType, 'other');
  const n = readDocumentScan('x');
  assert.equal(n.notMedical, true);
  assert.equal(n.docType, 'other');
});

test('names fold so the same thing written two ways matches', () => {
  assert.equal(foldName('  Ferrous  Sulfate '), foldName('ferrous sulfate'));
  assert.notEqual(foldName('Ferrous sulfate'), foldName('Ferrous gluconate'));
});

test('review items say where each thing will go, and mark what she already has', () => {
  const items = reviewItems(readDocumentScan(visitJson), {
    conditions: [{ id: 'c1', name: 'iron deficiency anemia' }],
    medications: [{ id: 'm1', name: 'Ibuprofen', stoppedOn: null }],
  });
  const by = (t: string) => items.filter((i) => i.target === t);
  assert.deepEqual(by('conditions').map((i) => [i.title, i.existingId]), [['Endometriosis', null], ['Iron deficiency anemia', 'c1']]);
  assert.deepEqual(by('allergies').map((i) => i.title), ['Penicillin']);
  assert.deepEqual(by('medications').map((i) => i.title), ['Ferrous sulfate']);
  assert.deepEqual(by('stop_medications').map((i) => [i.title, i.existingId]), [['Ibuprofen', 'm1']]);
  assert.deepEqual(by('procedures').map((i) => i.title), ['Pelvic ultrasound']);
  assert.deepEqual(by('referrals').map((i) => i.title), ['Gynecology']);
  assert.ok(items.every((i) => i.keep));
  assert.equal(TARGET_HEADING.stop_medications, 'Marks as stopped in Medications');
});

test('the filings add what is new, link what she has, and stop what the document stopped', () => {
  const items = reviewItems(readDocumentScan(visitJson), {
    conditions: [{ id: 'c1', name: 'Iron deficiency anemia' }],
    medications: [{ id: 'm1', name: 'Ibuprofen', stoppedOn: null }],
  });
  const f = buildFilings(items, '2026-09-02');
  assert.deepEqual(f.conditions, [{ name: 'Endometriosis', status: 'active' }]);
  assert.deepEqual(f.linked, [{ table: 'conditions', id: 'c1' }, { table: 'medications', id: 'm1' }]);
  assert.deepEqual(f.stop_medications, [{ id: 'm1' }]);
  assert.equal(f.medications[0].name, 'Ferrous sulfate');
  assert.equal(f.medications[0].dose, '325 mg, once daily');
  assert.equal(f.medications[0].started_on, '2026-09-02');
  assert.deepEqual(f.procedures, [{ name: 'Pelvic ultrasound', performed_on: '2026-09-02' }]);
  assert.deepEqual(f.referrals[0], { specialty: 'Gynecology', clinician: 'Dr Chen', reason: 'Discuss laparoscopy', referred_by: 'Dr A Rivera', referred_on: '2026-09-02' });
  assert.deepEqual(f.allergies, [{ name: 'Penicillin', reaction: 'Hives' }]);
});

test('a medication the document stops that she does not have is added already stopped', () => {
  const items = reviewItems(readDocumentScan(visitJson), { conditions: [], medications: [] });
  const f = buildFilings(items, '2026-09-02');
  assert.deepEqual(f.stop_medications, []);
  const ibu = f.medications.find((m) => m.name === 'Ibuprofen')!;
  assert.equal(ibu.stopped_on, '2026-09-02');
});

test('items she switched off are not filed', () => {
  const items = reviewItems(readDocumentScan(visitJson), { conditions: [], medications: [] }).map((i) => (i.target === 'procedures' ? { ...i, keep: false } : i));
  assert.deepEqual(buildFilings(items, '2026-09-02').procedures, []);
});

test('a prescription files its medications, and an insurance card becomes a plan', () => {
  const rx = readDocumentScan({ ...visitJson, doc_type: 'prescription', visit: null, prescription: { medications: [med('Levothyroxine', { strength: '50 mcg', frequency: 'daily', prescriber: 'Dr Kim', date: '2026-08-01' })] } });
  const f = buildFilings(reviewItems(rx, { conditions: [], medications: [] }), rx.date);
  assert.equal(f.medications[0].started_on, '2026-08-01', 'the prescription date wins over the document date');
  assert.equal(f.medications[0].prescriber, 'Dr Kim');
  const card = readDocumentScan({ ...visitJson, doc_type: 'insurance', visit: null, insurance: { provider: 'Aetna', plan: 'Choice POS II', member_id: 'W123456789' } });
  assert.deepEqual(insuranceFrom(reviewItems(card, { conditions: [], medications: [] })), { provider: 'Aetna', plan: 'Choice POS II', member_id: 'W123456789' });
});

test('imaging and pathology offer the conditions they name, and file nothing else', () => {
  const img = readDocumentScan({
    ...visitJson,
    doc_type: 'imaging',
    visit: null,
    report: { study: 'Pelvic ultrasound', body_site: 'Pelvis', findings: 'A 3 cm cyst on the left ovary.', impression: 'Likely endometrioma.', named_conditions: ['Endometrioma'] },
  });
  assert.equal(img.report?.impression, 'Likely endometrioma.');
  const items = reviewItems(img, { conditions: [], medications: [] });
  assert.deepEqual(items.map((i) => [i.target, i.title]), [['conditions', 'Endometrioma']]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/documents.test.ts`
Expected: FAIL, `./documents` cannot be found.

- [ ] **Step 3: Implement `src/lib/documents.ts`**

```ts
// Any medical document, as the app reads, checks and files it.
//
// The document-scan function copies out what a document says. These rules
// check that answer, show each item where it will be filed, match items to
// what she already has, and build what save_document writes. Pure, so every
// rule is tested. Nothing is filed without her check, and nothing is
// inferred: an item is here only because the document says it.

export type DocType = 'lab_report' | 'visit' | 'imaging' | 'pathology' | 'prescription' | 'referral' | 'insurance' | 'other';
const DOC_TYPES: DocType[] = ['lab_report', 'visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'other'];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  lab_report: 'Lab report',
  visit: 'Visit summary',
  imaging: 'Imaging report',
  pathology: 'Pathology report',
  prescription: 'Prescription or medication list',
  referral: 'Referral',
  insurance: 'Insurance card',
  other: 'Other document',
};

export type DocMed = { name: string; strength: string | null; dose: string | null; frequency: string | null; route: string | null; prescriber: string | null; date: string | null };

export type DocumentScan = {
  notMedical: boolean;
  docType: DocType;
  title: string | null;
  date: string | null;
  clinician: string | null;
  facility: string | null;
  multipleDates: boolean;
  unreadablePages: number[];
  visit: {
    reason: string | null;
    diagnoses: { name: string; status: 'new' | 'existing' | 'unclear' }[];
    medicationsStarted: DocMed[];
    medicationsStopped: DocMed[];
    medicationsChanged: DocMed[];
    procedures: { name: string; date: string | null }[];
    followUps: { specialty: string; clinician: string | null; reason: string | null; when: string | null }[];
    instructions: string[];
    allergies: { substance: string; reaction: string | null }[];
  } | null;
  report: { study: string | null; bodySite: string | null; findings: string | null; impression: string | null; namedConditions: string[] } | null;
  prescription: { medications: DocMed[] } | null;
  referral: { specialty: string | null; clinician: string | null; reason: string | null; referredBy: string | null } | null;
  insurance: { provider: string | null; plan: string | null; memberId: string | null } | null;
  other: { description: string | null } | null;
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const day = (v: unknown) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map(str).filter((x): x is string => !!x);

function readMed(v: unknown): DocMed | null {
  const m = obj(v);
  const name = m ? str(m.name) : null;
  if (!m || !name) return null;
  return { name, strength: str(m.strength), dose: str(m.dose), frequency: str(m.frequency), route: str(m.route), prescriber: str(m.prescriber), date: day(m.date) };
}
const meds = (v: unknown) => arr(v).map(readMed).filter((x): x is DocMed => !!x);

export function readDocumentScan(json: unknown): DocumentScan {
  const j = obj(json) ?? {};
  const t = str(j.doc_type) as DocType | null;
  const docType: DocType = t && DOC_TYPES.includes(t) ? t : 'other';
  const v = obj(j.visit);
  const r = obj(j.report);
  const p = obj(j.prescription);
  const ref = obj(j.referral);
  const ins = obj(j.insurance);
  const o = obj(j.other);
  const pages = arr(j.unreadable_pages).filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1);
  return {
    notMedical: j.not_medical === true || !obj(json),
    docType,
    title: str(j.title),
    date: day(j.date),
    clinician: str(j.clinician),
    facility: str(j.facility),
    multipleDates: j.multiple_dates === true,
    unreadablePages: [...new Set(pages)].sort((a, b) => a - b),
    visit: v
      ? {
          reason: str(v.reason),
          diagnoses: arr(v.diagnoses)
            .map((d) => obj(d))
            .filter((d): d is Record<string, unknown> => !!d && !!str(d.name))
            .map((d) => ({ name: str(d.name)!, status: d.status === 'new' || d.status === 'existing' ? d.status : 'unclear' })),
          medicationsStarted: meds(v.medications_started),
          medicationsStopped: meds(v.medications_stopped),
          medicationsChanged: meds(v.medications_changed),
          procedures: arr(v.procedures)
            .map((x) => obj(x))
            .filter((x): x is Record<string, unknown> => !!x && !!str(x.name))
            .map((x) => ({ name: str(x.name)!, date: day(x.date) })),
          followUps: arr(v.follow_ups)
            .map((x) => obj(x))
            .filter((x): x is Record<string, unknown> => !!x && !!str(x.specialty))
            .map((x) => ({ specialty: str(x.specialty)!, clinician: str(x.clinician), reason: str(x.reason), when: str(x.when) })),
          instructions: strs(v.instructions),
          allergies: arr(v.allergies)
            .map((x) => obj(x))
            .filter((x): x is Record<string, unknown> => !!x && !!str(x.substance))
            .map((x) => ({ substance: str(x.substance)!, reaction: str(x.reaction) })),
        }
      : null,
    report: r ? { study: str(r.study), bodySite: str(r.body_site), findings: str(r.findings), impression: str(r.impression), namedConditions: strs(r.named_conditions) } : null,
    prescription: p ? { medications: meds(p.medications) } : null,
    referral: ref ? { specialty: str(ref.specialty), clinician: str(ref.clinician), reason: str(ref.reason), referredBy: str(ref.referred_by) } : null,
    insurance: ins ? { provider: str(ins.provider), plan: str(ins.plan), memberId: str(ins.member_id) } : null,
    other: o ? { description: str(o.description) } : null,
  };
}

export const foldName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export type Existing = {
  conditions: { id: string; name: string }[];
  medications: { id: string; name: string; stoppedOn: string | null }[];
};

export type Target = 'conditions' | 'allergies' | 'medications' | 'stop_medications' | 'procedures' | 'referrals' | 'insurance';

export const TARGET_HEADING: Record<Target, string> = {
  conditions: 'Adds to Conditions',
  allergies: 'Adds to Allergies',
  medications: 'Adds to Medications',
  stop_medications: 'Marks as stopped in Medications',
  procedures: 'Adds to Procedures',
  referrals: 'Adds to Referrals',
  insurance: 'Updates Health Plans',
};

export type ReviewItem = {
  key: string;
  target: Target;
  title: string;
  detail: string | null;
  keep: boolean;
  existingId: string | null;
  value: Record<string, string | null>;
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;

export function reviewItems(scan: DocumentScan, existing: Existing): ReviewItem[] {
  const items: ReviewItem[] = [];
  let n = 0;
  const push = (target: Target, title: string, detail: string | null, value: Record<string, string | null>, existingId: string | null = null) =>
    items.push({ key: `i${n++}`, target, title, detail, keep: true, existingId, value });
  const condition = (name: string) => existing.conditions.find((c) => foldName(c.name) === foldName(name))?.id ?? null;
  const medication = (name: string) => existing.medications.find((m) => foldName(m.name) === foldName(name) && !m.stoppedOn)?.id ?? null;
  const addMed = (m: DocMed) =>
    push('medications', m.name, join(m.strength, m.dose, m.frequency, m.route), { ...m, name: m.name }, medication(m.name));

  const v = scan.visit;
  if (v) {
    for (const d of v.diagnoses) push('conditions', d.name, d.status === 'new' ? 'New diagnosis' : null, { name: d.name, status: d.status }, condition(d.name));
    for (const a of v.allergies) push('allergies', a.substance, a.reaction, { name: a.substance, reaction: a.reaction });
    for (const m of [...v.medicationsStarted, ...v.medicationsChanged]) addMed(m);
    for (const m of v.medicationsStopped) push('stop_medications', m.name, join(m.strength, m.dose), { ...m, name: m.name }, medication(m.name));
    for (const p of v.procedures) push('procedures', p.name, p.date, { name: p.name, date: p.date });
    for (const f of v.followUps) push('referrals', f.specialty, join(f.clinician, f.reason, f.when), { specialty: f.specialty, clinician: f.clinician, reason: f.reason, when: f.when });
  }
  if (scan.report) for (const c of scan.report.namedConditions) push('conditions', c, 'Named in the report', { name: c, status: 'unclear' }, condition(c));
  if (scan.prescription) for (const m of scan.prescription.medications) addMed(m);
  if (scan.referral?.specialty) {
    const r = scan.referral;
    push('referrals', r.specialty!, join(r.clinician, r.reason), { specialty: r.specialty, clinician: r.clinician, reason: r.reason, referredBy: r.referredBy });
  }
  if (scan.insurance?.provider) {
    const i = scan.insurance;
    push('insurance', i.provider!, join(i.plan, i.memberId ? `Member ${i.memberId}` : null), { provider: i.provider, plan: i.plan, memberId: i.memberId });
  }
  return items;
}

export type DocumentFilings = {
  conditions: { name: string; status: 'active' | 'unknown' }[];
  allergies: { name: string; reaction: string | null }[];
  medications: { name: string; dose: string | null; started_on: string | null; stopped_on: string | null; route: string | null; prescriber: string | null }[];
  stop_medications: { id: string }[];
  procedures: { name: string; performed_on: string | null }[];
  referrals: { specialty: string; clinician: string | null; reason: string | null; referred_by: string | null; referred_on: string | null }[];
  linked: { table: string; id: string }[];
};

// What save_document writes. New items are added; items she already has
// are linked; a medication the document stops is stopped if she has it,
// or added already stopped if she does not.
export function buildFilings(items: ReviewItem[], docDate: string | null): DocumentFilings {
  const f: DocumentFilings = { conditions: [], allergies: [], medications: [], stop_medications: [], procedures: [], referrals: [], linked: [] };
  for (const i of items.filter((x) => x.keep && x.title.trim())) {
    const v = i.value;
    const name = (v.name ?? i.title).trim();
    switch (i.target) {
      case 'conditions':
        if (i.existingId) f.linked.push({ table: 'conditions', id: i.existingId });
        else f.conditions.push({ name, status: v.status === 'new' ? 'active' : 'unknown' });
        break;
      case 'allergies':
        f.allergies.push({ name, reaction: v.reaction ?? null });
        break;
      case 'medications':
        if (i.existingId) f.linked.push({ table: 'medications', id: i.existingId });
        else f.medications.push({ name, dose: join(v.strength, v.dose, v.frequency), started_on: v.date ?? docDate, stopped_on: null, route: v.route ?? null, prescriber: v.prescriber ?? null });
        break;
      case 'stop_medications':
        if (i.existingId) {
          f.stop_medications.push({ id: i.existingId });
          f.linked.push({ table: 'medications', id: i.existingId });
        } else {
          f.medications.push({ name, dose: join(v.strength, v.dose), started_on: null, stopped_on: docDate, route: v.route ?? null, prescriber: v.prescriber ?? null });
        }
        break;
      case 'procedures':
        f.procedures.push({ name, performed_on: v.date ?? docDate });
        break;
      case 'referrals':
        f.referrals.push({ specialty: (v.specialty ?? i.title).trim(), clinician: v.clinician ?? null, reason: v.reason ?? null, referred_by: v.referredBy ?? null, referred_on: docDate });
        break;
    }
  }
  return f;
}

export function insuranceFrom(items: ReviewItem[]): { provider: string; plan: string | null; member_id: string | null } | null {
  const i = items.find((x) => x.target === 'insurance' && x.keep);
  if (!i || !i.value.provider) return null;
  return { provider: i.value.provider, plan: i.value.plan ?? null, member_id: i.value.memberId ?? null };
}
```

The test `the filings add what is new…` expects `referred_by: 'Dr A Rivera'`, which is the visit's clinician. So in `reviewItems`, give follow up items `referredBy: scan.clinician`: add `referredBy: scan.clinician` to the follow up `push` value.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/documents.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`. Expected: silent.

```bash
git add src/lib/documents.ts src/lib/documents.test.ts
git commit -m "Document rules: read any medical document, show where each item will be filed, match what she already has, and build the filings"
```

---

### Task 3: The `document-scan` function

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/document-scan/index.ts`
- Create: `ciatta-mobile-app/supabase/functions/document-scan/merge.ts`
- Create: `ciatta-mobile-app/supabase/functions/document-scan/fake.ts`
- Test: `ciatta-mobile-app/src/lib/documentScanMerge.test.ts`
- Create: `ciatta-mobile-app/scripts/document-scan-e2e.mts`; add the npm script `e2e:document-scan`
- Modify: `ciatta-mobile-app/scripts/lab-analysis-e2e.env` (add `DOCUMENT_SCAN_FAKE_MODEL=1`)

**Interfaces:**
- Consumes: `_shared/chunks.ts` (`chunkRanges`), `_shared/pdf.ts`, `claim_lab_scan`.
- Produces:
  - `POST /functions/v1/document-scan` with `{ file, kind: 'image' | 'pdf', as?: DocType }`. It returns the snake_case document shape `readDocumentScan` reads, plus `pages`.
  - `mergeDocumentChunks(reads: ChunkRead[], pages: number): Record<string, unknown>`

- [ ] **Step 1: Write the failing merge tests**

`src/lib/documentScanMerge.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeDocumentChunks } from '../../supabase/functions/document-scan/merge.ts';

const visit = (extra: Record<string, unknown>) => ({
  not_medical: false,
  doc_type: 'visit',
  title: null,
  date: null,
  clinician: null,
  facility: null,
  multiple_dates: false,
  unreadable_pages: [],
  visit: { reason: null, diagnoses: [], medications_started: [], medications_stopped: [], medications_changed: [], procedures: [], follow_ups: [], instructions: [], allergies: [] },
  report: null,
  prescription: null,
  referral: null,
  insurance: null,
  other: null,
  ...extra,
});

test('a long visit summary merges its pieces: first details found, every list in page order', () => {
  const merged = mergeDocumentChunks(
    [
      { first: 9, last: 10, parsed: visit({ date: '2026-09-03', visit: { ...visit({}).visit, diagnoses: [{ name: 'B', status: 'new' }], instructions: ['two'] } }) },
      { first: 1, last: 8, parsed: visit({ date: '2026-09-02', clinician: 'Dr Rivera', visit: { ...visit({}).visit, diagnoses: [{ name: 'A', status: 'new' }], instructions: ['one'] } }) },
    ],
    10,
  ) as any;
  assert.equal(merged.date, '2026-09-02');
  assert.equal(merged.clinician, 'Dr Rivera');
  assert.deepEqual(merged.visit.diagnoses.map((d: any) => d.name), ['A', 'B']);
  assert.deepEqual(merged.visit.instructions, ['one', 'two']);
  assert.equal(merged.multiple_dates, true, 'two pieces gave two dates');
  assert.equal(merged.pages, 10);
});

test('the type is the one most pieces agree on, and a failed piece marks its pages', () => {
  const merged = mergeDocumentChunks(
    [
      { first: 1, last: 8, parsed: visit({}) },
      { first: 9, last: 16, parsed: visit({ doc_type: 'lab_report' }) },
      { first: 17, last: 24, parsed: visit({}) },
      { first: 25, last: 26, parsed: null },
    ],
    26,
  ) as any;
  assert.equal(merged.doc_type, 'visit');
  assert.deepEqual(merged.unreadable_pages, [25, 26]);
});

test('it is not medical only when no piece found anything medical', () => {
  assert.equal((mergeDocumentChunks([{ first: 1, last: 1, parsed: visit({ not_medical: true, doc_type: 'other' }) }], 1) as any).not_medical, true);
});
```

Run: `npx tsx --test src/lib/documentScanMerge.test.ts`
Expected: FAIL, the module cannot be found.

- [ ] **Step 2: Implement `merge.ts`**

```ts
// Putting a long document's pieces back together. Pure, tested from the
// app's suite. Details come from the first piece that has them, every list
// is joined in page order, and the type is the one most pieces agree on.

import type { ChunkRead } from '../_shared/chunks.ts';

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const SECTIONS = ['visit', 'report', 'prescription', 'referral', 'insurance', 'other'] as const;

function mergeSection(parts: (Record<string, unknown> | null)[]): Record<string, unknown> | null {
  const present = parts.filter((p): p is Record<string, unknown> => !!p);
  if (!present.length) return null;
  const out: Record<string, unknown> = {};
  for (const key of new Set(present.flatMap((p) => Object.keys(p)))) {
    const values = present.map((p) => p[key]);
    out[key] = values.some(Array.isArray) ? values.flatMap((v) => (Array.isArray(v) ? v : [])) : (values.find((v) => text(v) != null) ?? null);
  }
  return out;
}

export function mergeDocumentChunks(reads: ChunkRead[], pages: number): Record<string, unknown> {
  const ordered = [...reads].sort((a, b) => a.first - b.first);
  const ok = ordered.filter((r) => r.parsed) as { first: number; last: number; parsed: Record<string, unknown> }[];
  const unreadable = new Set<number>();
  for (const r of ordered) {
    if (!r.parsed) {
      for (let p = r.first; p <= r.last; p++) unreadable.add(p);
      continue;
    }
    for (const p of Array.isArray(r.parsed.unreadable_pages) ? r.parsed.unreadable_pages : []) {
      if (typeof p === 'number' && Number.isInteger(p) && p >= 1 && r.first + p - 1 <= r.last) unreadable.add(r.first + p - 1);
    }
  }
  const votes = new Map<string, number>();
  for (const r of ok) {
    const t = text(r.parsed.doc_type);
    if (t && r.parsed.not_medical !== true) votes.set(t, (votes.get(t) ?? 0) + 1);
  }
  const docType = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
  const pick = (key: string) => ok.map((r) => text(r.parsed[key])).find((v) => v != null) ?? null;
  const dates = new Set(ok.map((r) => text(r.parsed.date)).filter(Boolean));
  const out: Record<string, unknown> = {
    not_medical: ok.length > 0 && ok.every((r) => r.parsed.not_medical === true),
    doc_type: docType,
    title: pick('title'),
    date: pick('date'),
    clinician: pick('clinician'),
    facility: pick('facility'),
    multiple_dates: dates.size > 1 || ok.some((r) => r.parsed.multiple_dates === true),
    unreadable_pages: [...unreadable].sort((a, b) => a - b),
    pages,
  };
  for (const s of SECTIONS) out[s] = mergeSection(ok.map((r) => obj(r.parsed[s])));
  return out;
}
```

Run: `npx tsx --test src/lib/documentScanMerge.test.ts`
Expected: PASS.

- [ ] **Step 3: The fake model and the end to end check, before the function**

`supabase/functions/document-scan/fake.ts`:

```ts
// A stand in for the model, for local tests only. It answers by the type
// asked for, or as a visit summary.

export function fakeDocument(as: string | null): Record<string, unknown> {
  const base = {
    not_medical: false,
    doc_type: as ?? 'visit',
    title: 'Test document',
    date: '2026-09-02',
    clinician: 'Dr Test',
    facility: 'Test Clinic',
    multiple_dates: false,
    unreadable_pages: [],
    visit: null,
    report: null,
    prescription: null,
    referral: null,
    insurance: null,
    other: null,
  };
  if ((as ?? 'visit') === 'visit') {
    return {
      ...base,
      visit: {
        reason: 'Follow up',
        diagnoses: [{ name: 'Iron deficiency anemia', status: 'new' }],
        medications_started: [{ name: 'Ferrous sulfate', strength: '325 mg', dose: null, frequency: 'once daily', route: 'oral', prescriber: null, date: null }],
        medications_stopped: [],
        medications_changed: [],
        procedures: [],
        follow_ups: [],
        instructions: ['Take with food.'],
        allergies: [],
      },
    };
  }
  if (as === 'insurance') return { ...base, insurance: { provider: 'Aetna', plan: 'Choice POS II', member_id: 'W123' } };
  return { ...base, other: { description: 'A test document' } };
}
```

`scripts/document-scan-e2e.mts`:

```ts
// document-scan end to end on this machine, with the model replaced by a
// fake. Needs `supabase start` and, in another terminal:
//   supabase functions serve --env-file scripts/lab-analysis-e2e.env
// Run: npm run e2e:document-scan

import { execSync } from 'node:child_process';

const local = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const API: string = local.API_URL;
const ANON: string = local.ANON_KEY;
const SERVICE: string = local.SERVICE_ROLE_KEY;
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function main() {
  const email = `document-scan-e2e-${Date.now()}@example.com`;
  const made = await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: 'document-scan-1', email_confirm: true }) }).then((r) => r.json());
  const session = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'document-scan-1' }),
  }).then((r) => r.json());
  const call = async (body: unknown, fake = '1') => {
    const res = await fetch(`${API}/functions/v1/document-scan`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'x-fake-model': fake },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const visit = await call({ file: 'aGVsbG8=', kind: 'image' });
    check('a document is read and comes back typed', visit.status === 200 && visit.body?.doc_type === 'visit' && visit.body?.visit?.diagnoses?.length === 1, `${visit.status}`);
    const asked = await call({ file: 'aGVsbG8=', kind: 'image', as: 'insurance' });
    check('read again as the type she chose', asked.status === 200 && asked.body?.doc_type === 'insurance' && asked.body?.insurance?.provider === 'Aetna');
    const bad = await call({ file: '', kind: 'image' });
    check('an empty file is refused', bad.status === 400);
    const unsigned = await fetch(`${API}/functions/v1/document-scan`, { method: 'POST', body: '{}' });
    check('an unsigned call is refused', unsigned.status === 401);
  } finally {
    await fetch(`${API}/auth/v1/admin/users/${made.id}`, { method: 'DELETE', headers: admin });
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add `"e2e:document-scan": "tsx scripts/document-scan-e2e.mts"` to `package.json`, and the line `DOCUMENT_SCAN_FAKE_MODEL=1` to `scripts/lab-analysis-e2e.env`.

Serve the functions locally (`supabase functions serve --env-file scripts/lab-analysis-e2e.env`) and run `npm run e2e:document-scan`.
Expected: the typed checks FAIL (404, no function yet). The unsigned check may pass.

- [ ] **Step 4: Write the function**

`supabase/functions/document-scan/index.ts`:

```ts
// Reads any medical document: a photo, a scan, or a PDF of any length.
//
// Called by the app with her access token. The file is sent to OpenAI's
// model to be read and is not stored or logged here. The model works out
// what kind of document it is and copies out what it says, filling only the
// section for that type. It is told to copy, never interpret. She checks
// every item on her phone before anything is filed (src/lib/documents.ts).
//
// Long PDFs are read eight pages at a time (../_shared), each piece counted
// against the day's limit shared with lab reports.
//
// Logging: counts and failure reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { chunkRanges, type ChunkRead } from '../_shared/chunks.ts';
import { pageCount, splitPdf } from '../_shared/pdf.ts';
import { fakeDocument } from './fake.ts';
import { mergeDocumentChunks } from './merge.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_DOCUMENT_MODEL') ?? Deno.env.get('OPENAI_LAB_MODEL') ?? 'gpt-4o';
const FAKE_ALLOWED = Deno.env.get('DOCUMENT_SCAN_FAKE_MODEL') === '1' && /^https?:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url);
const MAX_BASE64 = 12_000_000;
const TYPES = ['lab_report', 'visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'other'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const S = (type: string) => ({ type: [type, 'null'] });
const STR = { type: 'string' };
const STRS = { type: 'array', items: STR };
const OBJ = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const NOBJ = (properties: Record<string, unknown>) => ({ anyOf: [OBJ(properties), { type: 'null' }] });
const MED = OBJ({ name: STR, strength: S('string'), dose: S('string'), frequency: S('string'), route: S('string'), prescriber: S('string'), date: S('string') });

const SCHEMA = {
  name: 'medical_document',
  strict: true,
  schema: OBJ({
    not_medical: { type: 'boolean' },
    doc_type: { type: 'string', enum: TYPES },
    title: S('string'),
    date: S('string'),
    clinician: S('string'),
    facility: S('string'),
    multiple_dates: { type: 'boolean' },
    unreadable_pages: { type: 'array', items: { type: 'integer' } },
    visit: NOBJ({
      reason: S('string'),
      diagnoses: { type: 'array', items: OBJ({ name: STR, status: { type: 'string', enum: ['new', 'existing', 'unclear'] } }) },
      medications_started: { type: 'array', items: MED },
      medications_stopped: { type: 'array', items: MED },
      medications_changed: { type: 'array', items: MED },
      procedures: { type: 'array', items: OBJ({ name: STR, date: S('string') }) },
      follow_ups: { type: 'array', items: OBJ({ specialty: STR, clinician: S('string'), reason: S('string'), when: S('string') }) },
      instructions: STRS,
      allergies: { type: 'array', items: OBJ({ substance: STR, reaction: S('string') }) },
    }),
    report: NOBJ({ study: S('string'), body_site: S('string'), findings: S('string'), impression: S('string'), named_conditions: STRS }),
    prescription: NOBJ({ medications: { type: 'array', items: MED } }),
    referral: NOBJ({ specialty: S('string'), clinician: S('string'), reason: S('string'), referred_by: S('string') }),
    insurance: NOBJ({ provider: S('string'), plan: S('string'), member_id: S('string') }),
    other: NOBJ({ description: S('string') }),
  }),
};

const INSTRUCTIONS = [
  'You read a medical document and copy what it says exactly. You do not interpret, diagnose, summarise beyond what is asked, or add anything the document does not say.',
  'doc_type: lab_report for laboratory results; visit for an after visit summary, clinic note, consultation note or discharge papers; imaging for radiology reports (ultrasound, X ray, CT, MRI, mammogram); pathology for biopsy, cytology or pathology reports; prescription for a prescription, pharmacy label or printout, or medication list; referral for a referral letter; insurance for an insurance card; other for any other medical document. not_medical is true when it is not a medical document.',
  'Fill only the section for that type and set every other section to null. For lab_report fill no section; the app reads it separately.',
  'title as printed, or null. date is the date of service, visit, study, prescription or card as YYYY-MM-DD, or null. clinician and facility as printed, or null.',
  'visit: reason for the visit as written; diagnoses as named, with status new when the document says it is new or was diagnosed at this visit, existing when it says it is known or ongoing, otherwise unclear; medications started, stopped or changed exactly as written, with strength, dose, frequency and route as printed; procedures done, with dates; follow ups or referrals, with when as written; instructions copied sentence by sentence as written; allergies with reactions as written.',
  'imaging and pathology: study (the modality or specimen), body_site, findings and impression copied in full as printed; named_conditions only for conditions the report itself names.',
  'prescription: each medication with strength, dose, frequency, route, prescriber and date as printed.',
  'referral: specialty, clinician referred to, reason and who referred, as printed. insurance: provider (the insurer), plan name and member id as printed. other: a one line description of what the document is.',
  'multiple_dates is true when the document covers more than one date of service. unreadable_pages lists pages, counted from 1, you could not read.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);

  let body: { file?: unknown; kind?: unknown; as?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const { file, kind } = body;
  const as = typeof body.as === 'string' && TYPES.includes(body.as) ? body.as : null;
  if (typeof file !== 'string' || !file.length || (kind !== 'image' && kind !== 'pdf')) return json({ error: 'Bad request' }, 400);
  if (file.length > MAX_BASE64) return json({ error: 'That file is too large. Try a shorter document, or split it.' }, 413);

  const fake = FAKE_ALLOWED ? req.headers.get('x-fake-model') : null;
  if (!fake && !openAiKey) {
    console.log('document-scan: no OPENAI_API_KEY configured');
    return json({ error: 'Reading documents is not set up yet' }, 503);
  }

  let pages = 1;
  let parts: { first: number; last: number; part: unknown }[];
  if (kind === 'pdf' && !fake) {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(file), (c) => c.charCodeAt(0));
      pages = await pageCount(bytes);
    } catch {
      return json({ error: 'That PDF could not be opened' }, 400);
    }
    const ranges = chunkRanges(pages);
    const pieces = ranges.length === 1 ? [file] : await splitPdf(bytes, ranges);
    parts = ranges.map((r, i) => ({ ...r, part: { type: 'file', file: { filename: `document-${r.first}.pdf`, file_data: `data:application/pdf;base64,${pieces[i]}` } } }));
  } else {
    parts = [{ first: 1, last: 1, part: { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${file}`, detail: 'high' } } }];
  }

  for (let i = 0; i < parts.length; i++) {
    const { data: allowed, error: claimError } = await db.rpc('claim_lab_scan');
    if (claimError) return json({ error: 'Could not check today\'s reads' }, 500);
    if (allowed !== true) {
      return json({ error: parts.length > 1 ? `This document needs ${parts.length} of today's reads and there are not enough left. Try again tomorrow.` : 'That is the most documents for today. Try again tomorrow.' }, 429);
    }
  }

  const reads: ChunkRead[] = await Promise.all(
    parts.map(async ({ first, last, part }) => ({ first, last, parsed: fake ? fakeDocument(as) : await readPart(part, as) })),
  );
  if (reads.every((r) => r.parsed == null)) return json({ error: 'Could not read the document' }, 502);
  const merged = mergeDocumentChunks(reads, pages);
  if (as) merged.doc_type = as;
  console.log(`document-scan: ${kind}, ${pages} pages, ${parts.length} pieces, ${merged.doc_type}`);
  return json(merged);
});

async function readPart(part: unknown, as: string | null): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS + (as ? ` She says this document is of type ${as}; read it as that type.` : '') },
          { role: 'user', content: [part] },
        ],
      }),
    });
    if (!res.ok) {
      console.log(`document-scan: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? JSON.parse(text) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.log(`document-scan: piece failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}
```

- [ ] **Step 5: Run the checks**

Run: `npm run e2e:document-scan` with the functions served.
Expected: `all passed`.
Run: `deno check --node-modules-dir=none supabase/functions/document-scan/index.ts`
Expected: `Check`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/document-scan src/lib/documentScanMerge.test.ts scripts/document-scan-e2e.mts scripts/lab-analysis-e2e.env package.json
git commit -m "document-scan: reads any medical document, sorted by type, every page of a long PDF, read again as the type she chooses; a local end to end check with a fake model"
```

---

### Task 4: Saving and removing a document

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261020100000_allergy_kind.sql`
- Create: `ciatta-mobile-app/supabase/migrations/20261020110000_documents_filing.sql`
- Test: `ciatta-mobile-app/supabase/tests/documents_filing.test.sql`
- Modify: `ciatta-mobile-app/supabase/tests/grants.test.sql`

**Interfaces:**
- Produces:
  - `condition_kind` gains `allergy`
  - `document_id uuid references documents on delete cascade` on `conditions`, `medications`, `procedures`, `referrals`
  - `save_document(p_doc_type text, p_title text, p_occurred_on date, p_storage_path text, p_metadata jsonb, p_filings jsonb, p_insurance jsonb) returns uuid`, where `p_filings` is `DocumentFilings` (Task 2)
  - `remove_document(p_document uuid) returns text` (the storage path, or null)

- [ ] **Step 1: Write the failing SQL test**

`supabase/tests/documents_filing.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d4', 'd4@test.local'),
  ('00000000-0000-0000-0000-0000000000e4', 'e4@test.local');
insert into public.medications (id, user_id, name, provenance) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d4', 'Ibuprofen', 'REPORTED');
insert into public.conditions (id, user_id, name, kind, provenance) values
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d4', 'Iron deficiency anemia', 'condition', 'REPORTED');
update public.profiles set onboarding = jsonb_build_object('details', jsonb_build_object('conditions', jsonb_build_array('Iron deficiency anemia'), 'medications', jsonb_build_array('Ibuprofen')))
  where id = '00000000-0000-0000-0000-0000000000d4';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
create temp table saved (id uuid) on commit drop;
grant all on saved to authenticated;

select lives_ok($$
  insert into saved select public.save_document('visit', 'After Visit Summary', '2026-09-02',
    '00000000-0000-0000-0000-0000000000d4/documents/v1.pdf', '{"checksum":"v1"}'::jsonb,
    '{"conditions":[{"name":"Endometriosis","status":"active"}],
      "allergies":[{"name":"Penicillin","reaction":"Hives"}],
      "medications":[{"name":"Ferrous sulfate","dose":"325 mg, once daily","started_on":"2026-09-02","stopped_on":null,"route":"oral","prescriber":null}],
      "stop_medications":[{"id":"50000000-0000-0000-0000-000000000001"}],
      "procedures":[{"name":"Pelvic ultrasound","performed_on":"2026-09-02"}],
      "referrals":[{"specialty":"Gynecology","clinician":"Dr Chen","reason":"Laparoscopy","referred_by":"Dr Rivera","referred_on":"2026-09-02"}],
      "linked":[{"table":"conditions","id":"50000000-0000-0000-0000-000000000002"},{"table":"medications","id":"50000000-0000-0000-0000-000000000001"}]}'::jsonb,
    '{"provider":"Aetna","plan":"Choice POS II","member_id":"W123"}'::jsonb)
$$, 'she can save a visit summary and file what it says');

select is((select status from public.conditions where name = 'Endometriosis'), 'active', 'a new diagnosis is filed as active');
select is((select kind::text from public.conditions where name = 'Penicillin'), 'allergy', 'an allergy is filed as an allergy');
select is((select stopped_on from public.medications where id = '50000000-0000-0000-0000-000000000001'), '2026-09-02'::date, 'the medication the document stopped is marked stopped');
select is((select provenance::text from public.medications where name = 'Ferrous sulfate'), 'DOCUMENT', 'filed rows say they came from a document');
select is((select count(*)::int from public.procedures where name = 'Pelvic ultrasound'), 1, 'the procedure is filed');
select is((select steps->>'referred' from public.referrals where specialty = 'Gynecology'), '2026-09-02', 'the referral is filed with the day it was made');
select is((select insurance->>'provider' from public.profiles where id = '00000000-0000-0000-0000-0000000000d4'), 'Aetna', 'the insurance card becomes her plan');
select ok((select onboarding->'details'->'medications' ? 'Ferrous sulfate' from public.profiles where id = '00000000-0000-0000-0000-0000000000d4'),
  'the medication shows in her Health Details list too');

select throws_ok($$
  select public.save_document('visit', 'X', '2026-09-02', '00000000-0000-0000-0000-0000000000d4/documents/v2.pdf', '{}'::jsonb,
    '{"conditions":[{"name":"Ok","status":"active"}],"procedures":[{"name":"","performed_on":"2026-09-02"}]}'::jsonb, null)
$$, '23514', null, 'one invalid item refuses the whole document');
select is((select count(*)::int from public.conditions where name = 'Ok'), 0, 'and nothing of it was filed');

select throws_ok($$
  select public.save_document('visit', 'X', '2026-09-02', '00000000-0000-0000-0000-0000000000e4/documents/v3.pdf', '{}'::jsonb, '{}'::jsonb, null)
$$, '42501', null, 'a file outside her own folder is refused');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}';
select is(public.remove_document((select id from saved)), null, 'someone else cannot remove her document');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
select public.remove_document((select id from saved));
select is(
  (select count(*)::int from public.conditions where name in ('Endometriosis', 'Penicillin'))
  + (select count(*)::int from public.medications where name = 'Ferrous sulfate')
  + (select count(*)::int from public.procedures where name = 'Pelvic ultrasound')
  + (select count(*)::int from public.referrals where specialty = 'Gynecology')
  + 10 * (select count(*)::int from public.conditions where id = '50000000-0000-0000-0000-000000000002'),
  10, 'removing it takes what it filed, and keeps what she already had');

select * from finish();
rollback;
```

Run: `supabase test db`
Expected: FAIL, `save_document` does not exist.

- [ ] **Step 2: Write the migrations**

`supabase/migrations/20261020100000_allergy_kind.sql`:

```sql
-- Allergies a document names are filed in her conditions list, as their own
-- kind. In a migration of its own: Postgres will not let a new enum value
-- be used in the transaction that adds it.
alter type public.condition_kind add value if not exists 'allergy';
```

`supabase/migrations/20261020110000_documents_filing.sql`:

```sql
-- Any medical document she adds, and what it files: conditions, allergies,
-- medications, procedures, referrals and her plan, all written with the
-- document or not at all. Each filed row names its document and goes with
-- it when the document is removed. Rows she already had are only linked
-- (documents.metadata.linked) and never removed by it.
--
-- Security invoker: every table here already has owner RLS for insert,
-- update and delete, so this runs with exactly her rights.

alter table public.conditions add column document_id uuid references public.documents (id) on delete cascade;
alter table public.medications add column document_id uuid references public.documents (id) on delete cascade;
alter table public.procedures add column document_id uuid references public.documents (id) on delete cascade;
alter table public.referrals add column document_id uuid references public.documents (id) on delete cascade;

create function public.save_document(
  p_doc_type text,
  p_title text,
  p_occurred_on date,
  p_storage_path text,
  p_metadata jsonb,
  p_filings jsonb,
  p_insurance jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  doc uuid;
  f jsonb := coalesce(p_filings, '{}'::jsonb);
  at timestamptz := coalesce(p_occurred_on, current_date)::text || 'T12:00:00Z';
  added_conditions text[];
  added_meds text[];
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> me::text then
    raise exception 'not her file' using errcode = '42501';
  end if;
  if p_doc_type not in ('visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'other') then
    raise exception 'not a document type' using errcode = '22023';
  end if;

  insert into public.documents (user_id, storage_path, title, doc_type, extraction_status, occurred_at, metadata)
  values (me, p_storage_path, p_title, p_doc_type, 'extracted', at,
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('linked', coalesce(f->'linked', '[]'::jsonb)))
  returning id into doc;

  insert into public.conditions (user_id, name, kind, status, provenance, occurred_on, document_id)
  select me, x->>'name', 'condition', coalesce(x->>'status', 'unknown'), 'DOCUMENT', p_occurred_on, doc
  from jsonb_array_elements(coalesce(f->'conditions', '[]'::jsonb)) x;

  insert into public.conditions (user_id, name, kind, status, provenance, occurred_on, note, document_id)
  select me, x->>'name', 'allergy', 'unknown', 'DOCUMENT', p_occurred_on, x->>'reaction', doc
  from jsonb_array_elements(coalesce(f->'allergies', '[]'::jsonb)) x;

  insert into public.medications (user_id, name, dose, started_on, stopped_on, provenance, metadata, document_id)
  select me, x->>'name', x->>'dose', (x->>'started_on')::date, (x->>'stopped_on')::date, 'DOCUMENT',
         jsonb_strip_nulls(jsonb_build_object('route', x->>'route', 'prescriber', x->>'prescriber')), doc
  from jsonb_array_elements(coalesce(f->'medications', '[]'::jsonb)) x;

  update public.medications set stopped_on = p_occurred_on
  where user_id = me and stopped_on is null
    and id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(f->'stop_medications', '[]'::jsonb)) x);

  insert into public.procedures (user_id, client_id, name, performed_on, provenance, document_id)
  select me, 'doc-' || gen_random_uuid(), x->>'name', coalesce((x->>'performed_on')::date, p_occurred_on, current_date), 'DOCUMENT', doc
  from jsonb_array_elements(coalesce(f->'procedures', '[]'::jsonb)) x;

  insert into public.referrals (user_id, client_id, specialty, clinician, reason, referred_by, referred_on, steps, document_id)
  select me, 'doc-' || gen_random_uuid(), x->>'specialty', x->>'clinician', x->>'reason', x->>'referred_by', (x->>'referred_on')::date,
         case when x->>'referred_on' is null then '{}'::jsonb else jsonb_build_object('referred', x->>'referred_on') end, doc
  from jsonb_array_elements(coalesce(f->'referrals', '[]'::jsonb)) x;

  if p_insurance is not null then
    update public.profiles set insurance = p_insurance where id = me;
  end if;

  -- Health Details shows her kept lists once she has edited them; what was
  -- filed is added to them so it is visible there too.
  select array_agg(x->>'name') into added_conditions from jsonb_array_elements(coalesce(f->'conditions', '[]'::jsonb)) x;
  select array_agg(x->>'name') into added_meds from jsonb_array_elements(coalesce(f->'medications', '[]'::jsonb)) x where x->>'stopped_on' is null;
  update public.profiles p set onboarding = jsonb_set(
      jsonb_set(p.onboarding, '{details,conditions}',
        coalesce(p.onboarding->'details'->'conditions', '[]'::jsonb)
        || coalesce((select jsonb_agg(n) from unnest(added_conditions) n where not (coalesce(p.onboarding->'details'->'conditions', '[]'::jsonb) ? n)), '[]'::jsonb),
        p.onboarding->'details' ? 'conditions'),
      '{details,medications}',
      coalesce(p.onboarding->'details'->'medications', '[]'::jsonb)
      || coalesce((select jsonb_agg(n) from unnest(added_meds) n where not (coalesce(p.onboarding->'details'->'medications', '[]'::jsonb) ? n)), '[]'::jsonb),
      p.onboarding->'details' ? 'medications')
  where p.id = me and p.onboarding ? 'details';

  return doc;
end $$;

revoke execute on function public.save_document(text, text, date, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_document(text, text, date, text, jsonb, jsonb, jsonb) to authenticated;

-- Removing a document: what it filed goes with it by the cascade; rows it
-- only linked stay. Returns the stored file's path for the app to delete,
-- or null when the document was not hers.
create function public.remove_document(p_document uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  path text;
begin
  select storage_path into path from public.documents
  where id = p_document and user_id = me and doc_type <> 'lab_report';
  if path is null then
    return null;
  end if;
  delete from public.documents where id = p_document and user_id = me;
  return path;
end $$;

revoke execute on function public.remove_document(uuid) from public, anon;
grant execute on function public.remove_document(uuid) to authenticated;
```

The empty procedure name in the atomicity test must fail with `23514`. `procedures.name` already has `check (length(trim(name)) > 0)`, so it does. If the SQL test shows a different code, set the expected code to what the check raises and ledger it.

Add `remove_document` and `save_document` to `grants.test.sql`, in the alphabetical list and the comment.

Apply them: `supabase migration up`

- [ ] **Step 3: Run the SQL tests**

Run: `supabase test db`
Expected: `Result: PASS`. If the `jsonb_set` for a missing details key misbehaves, the third argument `create_missing` is the `?` test on purpose: it adds a list only where she already keeps one.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261020100000_allergy_kind.sql supabase/migrations/20261020110000_documents_filing.sql supabase/tests/documents_filing.test.sql supabase/tests/grants.test.sql
git commit -m "Documents filed whole: conditions, allergies, medications (and ones it stops), procedures, referrals and her plan, saved with the document or not at all, removed with it"
```

---

### Task 5: The repo

**Files:**
- Modify: `ciatta-mobile-app/src/data/repo.ts`
- Modify: `ciatta-mobile-app/src/lib/dataExport.ts` (nothing new to add; the new columns travel with their tables)
- Test: `ciatta-mobile-app/src/data/repo.test.ts`

**Interfaces:**
- Consumes: Task 2 (`DocumentScan`, `readDocumentScan`, `DocumentFilings`, `DocType`), Task 4 RPCs.
- Produces, on the repo:
  - `scanDocument(base64: string, kind: 'image' | 'pdf', as?: DocType): Promise<DocumentScan>`
  - `loadExistingForDocuments(): Promise<Existing>`
  - `saveDocument(input: { file: { base64: string; kind: 'image' | 'pdf' }; checksum: string; scan: DocumentScan; filings: DocumentFilings; insurance: { provider: string; plan: string | null; member_id: string | null } | null }): Promise<string>`
  - `findDocument(checksum: string): Promise<{ id: string; on: string; docType: string } | null>`
  - `loadDocuments(): Promise<DocumentSummary[]>`, where `DocumentSummary = { id: string; docType: DocType; title: string | null; on: string }`
  - `loadDocument(id: string): Promise<DocumentDetail | null>`, where `DocumentDetail = DocumentSummary & { extraction: DocumentScan; filed: { conditions: string[]; allergies: string[]; medications: string[]; procedures: string[]; referrals: string[] }; linked: { table: string; id: string }[] }`
  - `removeDocument(id: string): Promise<void>`

- [ ] **Step 1: Write the failing demo repo test** (append to `src/data/repo.test.ts`)

```ts
test('a document is read, filed, listed, opened and removed', async () => {
  const repo = demoRepo();
  const scan = await repo.scanDocument('aGVsbG8=', 'pdf');
  assert.equal(scan.docType, 'visit');
  const { reviewItems, buildFilings, insuranceFrom } = await import('../lib/documents');
  const items = reviewItems(scan, await repo.loadExistingForDocuments());
  const id = await repo.saveDocument({
    file: { base64: 'aGVsbG8=', kind: 'pdf' },
    checksum: 'doc-1',
    scan,
    filings: buildFilings(items, scan.date),
    insurance: insuranceFrom(items),
  });
  const list = await repo.loadDocuments();
  assert.equal(list[0].id, id);
  const doc = await repo.loadDocument(id);
  assert.ok(doc && doc.filed.medications.length > 0);
  assert.deepEqual(await repo.findDocument('doc-1'), { id, on: scan.date, docType: 'visit' });
  await repo.removeDocument(id);
  assert.equal((await repo.loadDocuments()).length, 0);
});
```

Run: `npx tsx --test src/data/repo.test.ts`
Expected: FAIL, `repo.scanDocument is not a function`.

- [ ] **Step 2: Implement**

Add to the interface, after `labReportFile`:

```ts
  // Any medical document: read it, see what she has, file it, list, open
  // and remove it. labReportFile opens any document's original.
  scanDocument(base64: string, kind: 'image' | 'pdf', as?: DocType): Promise<DocumentScan>;
  loadExistingForDocuments(): Promise<Existing>;
  saveDocument(input: DocumentInput): Promise<string>;
  findDocument(checksum: string): Promise<{ id: string; on: string; docType: string } | null>;
  loadDocuments(): Promise<DocumentSummary[]>;
  loadDocument(id: string): Promise<DocumentDetail | null>;
  removeDocument(id: string): Promise<void>;
```

Export these types above the interface:

```ts
export type DocumentInput = {
  file: { base64: string; kind: 'image' | 'pdf' };
  checksum: string;
  scan: DocumentScan;
  filings: DocumentFilings;
  insurance: { provider: string; plan: string | null; member_id: string | null } | null;
};
export type DocumentSummary = { id: string; docType: DocType; title: string | null; on: string };
export type DocumentDetail = DocumentSummary & {
  extraction: DocumentScan;
  filed: { conditions: string[]; allergies: string[]; medications: string[]; procedures: string[]; referrals: string[] };
  linked: { table: string; id: string }[];
};
```

Import `type DocType`, `type DocumentFilings`, `type DocumentScan`, `type Existing` and `readDocumentScan` from `../lib/documents`.

**Demo repo.** Declare `let demoDocuments: (DocumentDetail & { checksum: string })[] = [];` beside `demoReports`, then add:

```ts
    scanDocument: async (_b64, _kind, as) =>
      readDocumentScan({
        not_medical: false,
        doc_type: as ?? 'visit',
        title: 'Example visit summary',
        date: '2026-10-01',
        clinician: 'Dr Example',
        facility: 'Example Clinic',
        multiple_dates: false,
        unreadable_pages: [],
        visit:
          (as ?? 'visit') === 'visit'
            ? {
                reason: 'Follow up',
                diagnoses: [{ name: 'Iron deficiency anemia', status: 'new' }],
                medications_started: [{ name: 'Ferrous sulfate', strength: '325 mg', dose: null, frequency: 'once daily', route: 'oral', prescriber: null, date: null }],
                medications_stopped: [],
                medications_changed: [],
                procedures: [],
                follow_ups: [],
                instructions: ['Take with food.'],
                allergies: [],
              }
            : null,
        report: null,
        prescription: null,
        referral: null,
        insurance: null,
        other: (as ?? 'visit') === 'visit' ? null : { description: 'An example document' },
      }),
    loadExistingForDocuments: async () => ({ conditions: [], medications: [] }),
    saveDocument: async (input) => {
      const id = `document-${Date.now()}`;
      demoDocuments = [
        {
          id,
          checksum: input.checksum,
          docType: input.scan.docType,
          title: input.scan.title,
          on: input.scan.date ?? new Date().toISOString().slice(0, 10),
          extraction: input.scan,
          filed: {
            conditions: input.filings.conditions.map((c) => c.name),
            allergies: input.filings.allergies.map((a) => a.name),
            medications: input.filings.medications.map((m) => m.name),
            procedures: input.filings.procedures.map((p) => p.name),
            referrals: input.filings.referrals.map((r) => r.specialty),
          },
          linked: input.filings.linked,
        },
        ...demoDocuments,
      ];
      return id;
    },
    findDocument: async (checksum) => {
      const hit = demoDocuments.find((d) => d.checksum === checksum);
      return hit ? { id: hit.id, on: hit.on, docType: hit.docType } : null;
    },
    loadDocuments: async () => demoDocuments.map(({ id, docType, title, on }) => ({ id, docType, title, on })),
    loadDocument: async (id) => {
      const d = demoDocuments.find((x) => x.id === id);
      if (!d) return null;
      const { checksum: _c, ...rest } = d;
      return rest;
    },
    removeDocument: async (id) => {
      demoDocuments = demoDocuments.filter((d) => d.id !== id);
    },
```

**Real repo:**

```ts
    async scanDocument(base64, kind, as) {
      const { data, error } = await db.functions.invoke('document-scan', { body: { file: base64, kind, as } });
      if (error) {
        let sentence = 'The document could not be read. Try again.';
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (typeof body?.error === 'string') sentence = body.error;
        } catch {
          // Not JSON; the plain sentence stands.
        }
        throw new Error(sentence);
      }
      return readDocumentScan(data);
    },
    async loadExistingForDocuments() {
      const [conds, meds] = await Promise.all([
        db.from('conditions').select('id, name, kind').in('kind', ['condition', 'surgery']),
        db.from('medications').select('id, name, stopped_on'),
      ]);
      return {
        conditions: ((must(conds) as { id: string; name: string }[] | null) ?? []).map((c) => ({ id: c.id, name: c.name })),
        medications: ((must(meds) as { id: string; name: string; stopped_on: string | null }[] | null) ?? []).map((m) => ({ id: m.id, name: m.name, stoppedOn: m.stopped_on })),
      };
    },
    async saveDocument(input) {
      const docId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).toLowerCase();
      const ext = input.file.kind === 'pdf' ? 'pdf' : 'jpg';
      const path = `${userId}/documents/${docId}.${ext}`;
      const bytes = Uint8Array.from(atob(input.file.base64), (c) => c.charCodeAt(0));
      const { error: uploadError } = await db.storage
        .from('documents')
        .upload(path, bytes, { contentType: input.file.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await db.rpc('save_document', {
        p_doc_type: input.scan.docType,
        p_title: input.scan.title,
        p_occurred_on: input.scan.date,
        p_storage_path: path,
        p_metadata: { checksum: input.checksum, pages: null, clinician: input.scan.clinician, facility: input.scan.facility, extraction: input.scan },
        p_filings: input.filings,
        p_insurance: input.insurance,
      });
      if (error) {
        await db.storage.from('documents').remove([path]);
        throw error;
      }
      return data as string;
    },
    async findDocument(checksum) {
      const rows = must(await db.from('documents').select('id, occurred_at, doc_type').eq('metadata->>checksum', checksum).limit(1)) as
        | { id: string; occurred_at: string; doc_type: string }[]
        | null;
      const hit = rows?.[0];
      return hit ? { id: hit.id, on: hit.occurred_at.slice(0, 10), docType: hit.doc_type } : null;
    },
    async loadDocuments() {
      const rows = must(
        await db
          .from('documents')
          .select('id, doc_type, title, occurred_at')
          .not('doc_type', 'is', null)
          .neq('doc_type', 'lab_report')
          .order('occurred_at', { ascending: false })
          .limit(200),
      ) as { id: string; doc_type: string; title: string | null; occurred_at: string }[] | null;
      return (rows ?? []).map((r) => ({ id: r.id, docType: r.doc_type as DocType, title: r.title, on: r.occurred_at.slice(0, 10) }));
    },
    async loadDocument(id) {
      const rows = must(await db.from('documents').select('id, doc_type, title, occurred_at, metadata').eq('id', id).limit(1)) as
        | { id: string; doc_type: string; title: string | null; occurred_at: string; metadata: Record<string, unknown> }[]
        | null;
      const r = rows?.[0];
      if (!r) return null;
      const names = async (table: 'conditions' | 'medications' | 'procedures', extra?: (q: any) => any) => {
        let q = db.from(table).select('name').eq('document_id', id);
        if (extra) q = extra(q);
        return ((must(await q) as { name: string }[] | null) ?? []).map((x) => x.name);
      };
      const [conditions, allergies, medications, procedures, referrals] = await Promise.all([
        names('conditions', (q) => q.neq('kind', 'allergy')),
        names('conditions', (q) => q.eq('kind', 'allergy')),
        names('medications'),
        names('procedures'),
        db.from('referrals').select('specialty').eq('document_id', id).then((x: any) => ((must(x) as { specialty: string }[] | null) ?? []).map((y) => y.specialty)),
      ]);
      return {
        id: r.id,
        docType: r.doc_type as DocType,
        title: r.title,
        on: r.occurred_at.slice(0, 10),
        extraction: readDocumentScan(toSnake(r.metadata?.extraction)),
        filed: { conditions, allergies, medications, procedures, referrals },
        linked: Array.isArray(r.metadata?.linked) ? (r.metadata.linked as { table: string; id: string }[]) : [],
      };
    },
    async removeDocument(id) {
      const { data: path, error } = await db.rpc('remove_document', { p_document: id });
      if (error) throw error;
      if (typeof path === 'string') await db.storage.from('documents').remove([path]);
    },
```

The stored `extraction` is the camelCase `DocumentScan`. Store it snake cased instead, so `readDocumentScan` reads it back unchanged. Add `toSnake` (and use it in `saveDocument` for `extraction: toSnake(input.scan)`) in `src/lib/documents.ts`, exported, with a test that `readDocumentScan(toSnake(scan))` deep-equals `scan`:

```ts
// The scan as stored in documents.metadata.extraction: the function's own
// snake case shape, so readDocumentScan reads it back unchanged.
export function toSnake(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(toSnake);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), toSnake(x)]));
}
```

The test, appended to `src/lib/documents.test.ts` (add `toSnake` to the import):

```ts
test('a scan stored in snake case reads back the same', () => {
  const s = readDocumentScan(visitJson);
  assert.deepEqual(readDocumentScan(toSnake(s)), s);
});
```

Field names that differ only in case convert like this: `notMedical` → `not_medical`, `medicationsStarted` → `medications_started`, `followUps` → `follow_ups`, `bodySite` → `body_site`, `namedConditions` → `named_conditions`, `memberId` → `member_id`, `referredBy` → `referred_by`, `unreadablePages` → `unreadable_pages`, `multipleDates` → `multiple_dates`, `docType` → `doc_type`. All match the function's names.

- [ ] **Step 3: Run the tests and typecheck**

Run: `npx tsx --test src/data/repo.test.ts src/lib/documents.test.ts && npx tsc --noEmit && npm test`
Expected: PASS, silent typecheck, full suite green.

- [ ] **Step 4: Commit**

```bash
git add src/data/repo.ts src/data/repo.test.ts src/lib/documents.ts src/lib/documents.test.ts
git commit -m "Repo: read a document, file it with its original, find it again, list, open and remove it"
```

---

### Task 6: Scan or upload a document, and check it

**Files:**
- Create: `ciatta-mobile-app/src/ui/useCapture.ts`
- Create: `ciatta-mobile-app/src/screens/AddDocumentScreen.tsx`
- Create: `ciatta-mobile-app/src/lib/documentHandoff.ts`
- Modify: `ciatta-mobile-app/src/lib/labHandoff.ts` (a pending lab file)
- Modify: `ciatta-mobile-app/src/screens/AddLabsScreen.tsx` (read a pending lab file on open)
- Modify: `ciatta-mobile-app/src/navigation.ts`, `ciatta-mobile-app/src/Root.tsx` (`addDocument`, `document`)
- Modify: `ciatta-mobile-app/src/screens/AddRecordScreen.tsx` (the entry)

**Interfaces:**
- Consumes: Task 2, Task 5, `isScannerAvailable`/`scanDocument` (module), `labDay`.
- Produces:
  - `useCapture(onFile: (f: { base64: string; kind: 'image' | 'pdf' }) => void): { canScan: boolean; scanning: boolean; scan(): Promise<void>; pdf(): Promise<void>; photo(): Promise<void>; note: string | null }`
  - `chooseDocument(id: string)`, `chosenDocument(): string | null` in `documentHandoff.ts`
  - `chooseLabFile(f)`, `takeLabFile(): { base64: string; kind: 'image' | 'pdf' } | null` in `labHandoff.ts`
  - screens `'addDocument'` and `'document'`

- [ ] **Step 1: The capture hook and handoffs**

`src/ui/useCapture.ts`:

```ts
// Scan a paper document, upload a PDF, or choose a photo: one file, as
// base64, handed to whoever asked. The same three ways in as lab reports.

import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { isScannerAvailable, scanDocument } from '../../modules/document-scanner';

export type Captured = { base64: string; kind: 'image' | 'pdf' };

export function useCapture(onFile: (f: Captured) => void) {
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canScan = isScannerAvailable();

  const scan = async () => {
    if (scanning) return;
    setScanning(true);
    setNote(null);
    try {
      const scanned = await scanDocument();
      if (scanned) onFile({ base64: await new File(scanned.uri).base64(), kind: 'pdf' });
    } catch {
      setNote('The scan did not open. Try again.');
    } finally {
      setScanning(false);
    }
  };

  const pdf = async () => {
    setNote(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.length) return;
      onFile({ base64: await new File(picked.assets[0].uri).base64(), kind: 'pdf' });
    } catch {
      setNote('That PDF did not open.');
    }
  };

  const photo = async () => {
    setNote(null);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (picked.canceled || !picked.assets?.length) return;
      const ref = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 1800 }).renderAsync();
      const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      if (out.base64) onFile({ base64: out.base64, kind: 'image' });
    } catch {
      setNote('That photo did not open.');
    }
  };

  return { canScan, scanning, scan, pdf, photo, note };
}
```

`src/lib/documentHandoff.ts`:

```ts
// Which document the document screen opens on, left here by the row or the
// save that opened it.
let chosen: string | null = null;
export const chooseDocument = (id: string) => {
  chosen = id;
};
export const chosenDocument = () => chosen;
```

Append to `src/lib/labHandoff.ts`:

```ts
// A file a document reading found to be a lab report, handed to Add a Lab
// Report so it is read there, once.
let pendingLabFile: { base64: string; kind: 'image' | 'pdf' } | null = null;
export const chooseLabFile = (f: { base64: string; kind: 'image' | 'pdf' }) => {
  pendingLabFile = f;
};
export const takeLabFile = () => {
  const f = pendingLabFile;
  pendingLabFile = null;
  return f;
};
```

In `AddLabsScreen`, import `takeLabFile`, and add after the state declarations:

```tsx
  // A lab report found through Scan or Upload a Document is read here.
  useEffect(() => {
    const f = takeLabFile();
    if (f) void read(f.base64, f.kind);
    // read is stable for a once on open handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Add `useEffect` to its `react` import.

- [ ] **Step 2: `AddDocumentScreen`**

```tsx
// Scan or upload any medical document. Ciatta reads it and works out what
// it is, shows every item it found under where it will be filed, marks what
// she already has, and files only what she keeps. A lab report goes to Add
// a Lab Report, which reads labs.

import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { chooseDocument } from '../lib/documentHandoff';
import { buildFilings, DOC_TYPE_LABEL, type DocType, type DocumentScan, insuranceFrom, type ReviewItem, reviewItems, TARGET_HEADING, type Target } from '../lib/documents';
import { chooseLabFile } from '../lib/labHandoff';
import { labDay } from '../lib/labs';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, Lead, PrimaryButton, SaveBar, SecondaryButton } from '../ui/kit';
import { G } from '../ui/scheme';
import { HUE, L, SPACE, TILE_RADIUS } from '../ui/surface';
import { type Captured, useCapture } from '../ui/useCapture';

const ORDER: Target[] = ['conditions', 'allergies', 'medications', 'stop_medications', 'procedures', 'referrals', 'insurance'];
const TYPES: DocType[] = ['visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'lab_report', 'other'];

export function AddDocumentScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [file, setFile] = useState<(Captured & { checksum: string }) | null>(null);
  const [scan, setScan] = useState<DocumentScan | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; on: string } | null>(null);
  const [replacePlan, setReplacePlan] = useState(false);
  const [saving, setSaving] = useState(false);

  const read = async (f: Captured, as?: DocType) => {
    setNote(null);
    setDuplicate(null);
    const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, f.base64);
    if (!as) {
      const seen = await repo.findDocument(checksum).catch(() => null);
      if (seen) {
        setDuplicate({ id: seen.id, on: seen.on });
        return;
      }
    }
    setStage('reading');
    try {
      const s = await repo.scanDocument(f.base64, f.kind, as);
      if (s.notMedical) {
        setNote('This does not look like a medical document. Nothing was saved.');
        setStage('pick');
        return;
      }
      if (s.docType === 'lab_report') {
        chooseLabFile(f);
        nav.back();
        nav.push('addLabs');
        return;
      }
      setFile({ ...f, checksum });
      setScan(s);
      setItems(reviewItems(s, await repo.loadExistingForDocuments().catch(() => ({ conditions: [], medications: [] }))));
      setStage('review');
    } catch (e) {
      setNote(userFacingError(e, 'The document could not be read. Try again.'));
      setStage('pick');
    }
  };

  const capture = useCapture((f) => void read(f));
  useEffect(() => {
    if (capture.note) setNote(capture.note);
  }, [capture.note]);

  const edit = (key: string, patch: Partial<ReviewItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const hasPlan = items.some((i) => i.target === 'insurance' && i.keep);

  const save = async () => {
    if (!file || !scan || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const id = await repo.saveDocument({
        file: { base64: file.base64, kind: file.kind },
        checksum: file.checksum,
        scan,
        filings: buildFilings(items, scan.date),
        insurance: hasPlan && replacePlan ? insuranceFrom(items) : null,
      });
      chooseDocument(id);
      nav.back();
      nav.push('document');
    } catch (e) {
      setNote(userFacingError(e, 'The document did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Add a Document"
      onBack={nav.back}
      footer={stage === 'review' ? <SaveBar label={saving ? 'Saving' : 'Save Document'} disabled={saving} onPress={() => void save()} /> : undefined}
    >
      {stage === 'pick' ? (
        <>
          <Lead style={s.lede} text={"Visit summaries, imaging and pathology reports, prescriptions, referrals, insurance cards and lab reports. Ciatta reads it, then you check every item before anything is filed."} />
          <View style={{ gap: 12 }}>
            {capture.canScan ? <PrimaryButton label="Scan a Paper Document" onPress={() => void capture.scan()} disabled={capture.scanning} /> : null}
            {capture.canScan ? <SecondaryButton label="Upload a PDF" onPress={() => void capture.pdf()} /> : <PrimaryButton label="Upload a PDF" onPress={() => void capture.pdf()} />}
            <SecondaryButton label="Choose a Photo" onPress={() => void capture.photo()} />
          </View>
          {duplicate ? (
            <Pressable
              onPress={() => {
                chooseDocument(duplicate.id);
                nav.push('document');
              }}
              accessibilityRole="button"
              style={[s.card, { marginTop: SPACE.near }]}
            >
              <CardFill />
              <Text style={[font('subhead'), s.ink, { paddingVertical: 12 }]}>{displayCopy(`You added this document on ${labDay(duplicate.on)}. Tap to open it.`)}</Text>
            </Pressable>
          ) : null}
          <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near }]}>
            The document is sent to OpenAI to be read. The original is kept privately in your Ciatta account, and you can remove it at any time.
          </Text>
        </>
      ) : null}

      {stage === 'reading' ? <Lead style={s.lede} text={"Reading your document."} /> : null}

      {stage === 'review' && scan ? (
        <>
          <Text style={[font('caption1'), s.meta]}>Read as</Text>
          <View style={s.types}>
            {TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => file && t !== scan.docType && void read(file, t)}
                accessibilityRole="button"
                accessibilityState={{ selected: t === scan.docType }}
                style={[s.type, t === scan.docType && s.typeOn]}
              >
                <Text style={[font('caption1', t === scan.docType ? 'semibold' : 'regular'), s.ink]}>{DOC_TYPE_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[font('subhead'), s.ink, { marginTop: SPACE.near }]}>
            {displayCopy([scan.title, scan.date ? labDay(scan.date) : null, scan.clinician, scan.facility].filter(Boolean).join(', '))}
          </Text>
          {scan.multipleDates ? <Text style={[font('footnote'), s.warn, { marginTop: 8 }]}>This document covers more than one date. Check the items against it.</Text> : null}
          {scan.unreadablePages.length ? (
            <Text style={[font('footnote'), s.warn, { marginTop: 8 }]}>
              {`Page${scan.unreadablePages.length > 1 ? 's' : ''} ${scan.unreadablePages.join(', ')} could not be read. Check against your document.`}
            </Text>
          ) : null}
          {scan.report ? (
            <View style={s.card}>
              <CardFill />
              {scan.report.findings ? <Text style={[font('subhead'), s.ink, s.block]}>{displayCopy(`Findings: ${scan.report.findings}`)}</Text> : null}
              {scan.report.impression ? <Text style={[font('subhead', 'semibold'), s.ink, s.block]}>{displayCopy(`Impression: ${scan.report.impression}`)}</Text> : null}
            </View>
          ) : null}
          {scan.visit?.instructions.length ? (
            <View style={s.card}>
              <CardFill />
              {scan.visit.instructions.map((line) => (
                <Text key={line} style={[font('subhead'), s.ink, s.block]}>
                  {displayCopy(line)}
                </Text>
              ))}
            </View>
          ) : null}
          {scan.other?.description ? <Text style={[font('subhead'), s.ink, { marginTop: SPACE.near }]}>{displayCopy(scan.other.description)}</Text> : null}

          {ORDER.filter((t) => items.some((i) => i.target === t)).map((t) => (
            <View key={t} style={{ marginTop: SPACE.block }}>
              <Text style={[font('footnote', 'semibold'), { color: G.body }]}>{TARGET_HEADING[t]}</Text>
              <View style={s.card}>
                <CardFill />
                {items
                  .filter((i) => i.target === t)
                  .map((i, n) => (
                    <View key={i.key} style={[s.row, n > 0 && s.divided, !i.keep && { opacity: 0.45 }]}>
                      <View style={{ flex: 1 }}>
                        <TextInput value={i.title} onChangeText={(v) => edit(i.key, { title: v, value: { ...i.value, name: v, ...(t === 'referrals' ? { specialty: v } : {}), ...(t === 'insurance' ? { provider: v } : {}) } })} style={[font('subhead', 'semibold'), s.ink]} accessibilityLabel="Item" />
                        {i.detail ? <Text style={[font('caption1'), s.meta]}>{displayCopy(i.detail)}</Text> : null}
                        {i.existingId ? <Text style={[font('caption1'), s.meta]}>{t === 'stop_medications' ? 'In your Medications; it will be marked stopped' : 'Already in your record; it will be linked, not added again'}</Text> : null}
                      </View>
                      <Switch value={i.keep} onValueChange={(v) => edit(i.key, { keep: v })} trackColor={{ false: C.fill, true: C.green }} ios_backgroundColor={C.fill} accessibilityLabel={`Keep ${i.title}`} />
                    </View>
                  ))}
              </View>
            </View>
          ))}

          {hasPlan ? (
            <View style={[s.row, { marginTop: SPACE.near }]}>
              <Text style={[font('subhead'), s.ink, { flex: 1 }]}>Replace your current plan with this card</Text>
              <Switch value={replacePlan} onValueChange={setReplacePlan} trackColor={{ false: C.fill, true: C.green }} ios_backgroundColor={C.fill} accessibilityLabel="Replace your current plan" />
            </View>
          ) : null}

          {!items.length ? <Text style={[font('subhead'), s.meta, { marginTop: SPACE.near }]}>Nothing to file from this document. It will be kept, with its original.</Text> : null}
          <View style={{ marginTop: SPACE.block }}>
            <SecondaryButton label="Read a Different Document" onPress={() => setStage('pick')} />
          </View>
        </>
      ) : null}

      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 12 }]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  lede: { color: G.ink, lineHeight: 24, marginBottom: SPACE.near },
  meta: { color: L.meta },
  ink: { color: L.ink },
  warn: { color: HUE.attention },
  block: { paddingVertical: 8 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, paddingHorizontal: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: G.rule },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  type: { borderWidth: 1, borderColor: L.rule, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  typeOn: { borderColor: L.ink },
});
```

- [ ] **Step 3: Register screens and the entry**

- `src/navigation.ts`: add `| 'addDocument'` and `| 'document'`.
- `src/Root.tsx`: import `AddDocumentScreen` and `DocumentScreen` (Task 7). Add `addDocument: AddDocumentScreen,` and `document: DocumentScreen,`. Until Task 7 exists, register `document` in Task 7 instead, and keep this commit typechecking.
- `src/screens/AddRecordScreen.tsx`:
  - Above the `Composer`, add the primary entry:

    ```tsx
          <PrimaryButton label="Scan or Upload a Document" onPress={() => nav.push('addDocument')} />
          <Text style={[font('caption1'), a.hint, { marginTop: 6 }]}>Visit summaries, imaging, prescriptions, referrals, insurance cards and labs, read and filed for you</Text>
    ```

  - Change the lead line to "Or say it, type it, or attach a file as a note."
  - Change the note under the composer to "Files attached to a note stay on this phone, and are not read." Import `PrimaryButton` from `../ui/kit`.
- In `AddDocumentScreen`, the `nav.push('document')` calls need the `document` screen. Commit Task 6 and Task 7 together if the typecheck requires it, and ledger that.

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass. If only the missing `document` screen fails, go straight to Task 7 and commit both together.

- [ ] **Step 5: Commit**

```bash
git add src/ui/useCapture.ts src/screens/AddDocumentScreen.tsx src/lib/documentHandoff.ts src/lib/labHandoff.ts src/screens/AddLabsScreen.tsx src/navigation.ts src/Root.tsx src/screens/AddRecordScreen.tsx
git commit -m "Scan or Upload a Document: read as its type (changeable), every item shown where it will be filed, what she has marked, a lab report handed to Add a Lab Report"
```

---

### Task 7: The document screen, and Documents in Records

**Files:**
- Create: `ciatta-mobile-app/src/screens/DocumentScreen.tsx`
- Modify: `ciatta-mobile-app/src/ui/RecordsView.tsx` (a Documents section)
- Modify: `ciatta-mobile-app/src/Root.tsx` (register `document`)

**Interfaces:**
- Consumes: `repo.loadDocument`, `repo.removeDocument`, `repo.labReportFile` (opens any document's original), `chosenDocument`, `DOC_TYPE_LABEL`, `labDay`.
- Produces: the screen `document`. The marker comment `{/* PART B ANALYSIS */}` is where Part B adds the analysis.

- [ ] **Step 1: `DocumentScreen`**

```tsx
// One medical document: what it is, what it says, what was filed from it,
// and the original one tap away. Everything here is what the document said
// and she kept; nothing is interpreted. Part B adds the analysis below.

import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DocumentDetail } from '../data/repo';
import { displayCopy } from '../lib/displayCopy';
import { chosenDocument } from '../lib/documentHandoff';
import { DOC_TYPE_LABEL } from '../lib/documents';
import { labDay } from '../lib/labs';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, EmptyNote, SecondaryButton } from '../ui/kit';
import { G } from '../ui/scheme';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

function Section({ title, lines }: { title: string; lines: (string | null | undefined)[] }) {
  const kept = lines.filter((l): l is string => !!l);
  if (!kept.length) return null;
  return (
    <View style={{ marginTop: SPACE.block }}>
      <Eyebrow>{title}</Eyebrow>
      <View style={s.card}>
        <CardFill />
        {kept.map((line, n) => (
          <Text key={`${line}${n}`} style={[font('subhead'), s.ink, s.line, n > 0 && s.divided]}>
            {displayCopy(line)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function DocumentScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [id] = useState(() => chosenDocument());
  const [doc, setDoc] = useState<DocumentDetail | null | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return setDoc(null);
    repo.loadDocument(id).then(setDoc).catch(() => setDoc(null));
  }, [id, repo]);

  const openOriginal = useCallback(async () => {
    if (!id) return;
    const url = await repo.labReportFile(id);
    if (!url) return setNote('The original could not be opened just now.');
    await WebBrowser.openBrowserAsync(url);
  }, [id, repo]);

  const remove = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Remove this document?',
      'The document, its original, and what was filed from it are removed from Ciatta. Items you already had stay. A plan it replaced is not restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void repo
              .removeDocument(id)
              .then(() => nav.back())
              .catch(() => setNote('The document could not be removed just now. Nothing was changed.')),
        },
      ],
    );
  }, [id, repo, nav]);

  if (!doc) {
    return (
      <DetailScreen title="Document" onBack={nav.back}>
        {doc === null ? <EmptyNote text="This document was not found." /> : null}
      </DetailScreen>
    );
  }

  const x = doc.extraction;
  const v = x.visit;
  return (
    <DetailScreen title={displayCopy(doc.title ?? DOC_TYPE_LABEL[doc.docType])} onBack={nav.back}>
      <Text style={[font('caption1'), s.meta]}>{displayCopy([DOC_TYPE_LABEL[doc.docType], labDay(doc.on), x.clinician, x.facility].filter(Boolean).join(', '))}</Text>
      <Pressable onPress={() => void openOriginal()} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text style={[font('subhead', 'semibold'), s.link]}>View original</Text>
      </Pressable>
      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 8 }]}>{displayCopy(note)}</Text> : null}

      {v ? (
        <>
          <Section title="Reason for the visit" lines={[v.reason]} />
          <Section title="Diagnoses" lines={v.diagnoses.map((d) => `${d.name}${d.status === 'new' ? ' (new)' : ''}`)} />
          <Section title="Medications started or changed" lines={[...v.medicationsStarted, ...v.medicationsChanged].map((m) => [m.name, m.strength, m.dose, m.frequency].filter(Boolean).join(', '))} />
          <Section title="Medications stopped" lines={v.medicationsStopped.map((m) => m.name)} />
          <Section title="Procedures" lines={v.procedures.map((p) => [p.name, p.date ? labDay(p.date) : null].filter(Boolean).join(', '))} />
          <Section title="Follow ups" lines={v.followUps.map((f) => [f.specialty, f.clinician, f.reason, f.when].filter(Boolean).join(', '))} />
          <Section title="Instructions" lines={v.instructions} />
          <Section title="Allergies" lines={v.allergies.map((a) => [a.substance, a.reaction].filter(Boolean).join(', '))} />
        </>
      ) : null}
      {x.report ? (
        <>
          <Section title={x.report.study ?? 'Study'} lines={[x.report.bodySite ? `Body area: ${x.report.bodySite}` : null]} />
          <Section title="Findings" lines={[x.report.findings]} />
          <Section title="Impression" lines={[x.report.impression]} />
        </>
      ) : null}
      {x.prescription ? <Section title="Medications" lines={x.prescription.medications.map((m) => [m.name, m.strength, m.dose, m.frequency, m.prescriber].filter(Boolean).join(', '))} /> : null}
      {x.referral ? <Section title="Referral" lines={[x.referral.specialty, x.referral.clinician, x.referral.reason, x.referral.referredBy ? `Referred by ${x.referral.referredBy}` : null]} /> : null}
      {x.insurance ? <Section title="Insurance" lines={[x.insurance.provider, x.insurance.plan, x.insurance.memberId ? `Member ${x.insurance.memberId}` : null]} /> : null}
      {x.other ? <Section title="About" lines={[x.other.description]} /> : null}

      <Section
        title="Filed from this document"
        lines={[
          doc.filed.conditions.length ? `Conditions: ${doc.filed.conditions.join(', ')}` : null,
          doc.filed.allergies.length ? `Allergies: ${doc.filed.allergies.join(', ')}` : null,
          doc.filed.medications.length ? `Medications: ${doc.filed.medications.join(', ')}` : null,
          doc.filed.procedures.length ? `Procedures: ${doc.filed.procedures.join(', ')}` : null,
          doc.filed.referrals.length ? `Referrals: ${doc.filed.referrals.join(', ')}` : null,
          doc.linked.length ? `${doc.linked.length} already in your record, linked` : null,
        ]}
      />

      {/* PART B ANALYSIS */}

      <View style={{ marginTop: SPACE.section }}>
        <SecondaryButton label="Remove This Document" onPress={remove} />
      </View>
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  meta: { color: G.meta },
  ink: { color: L.ink },
  link: { color: G.ink, textDecorationLine: 'underline', marginTop: 4 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, paddingHorizontal: 14, overflow: 'hidden' },
  line: { paddingVertical: 10 },
  divided: { borderTopWidth: st, borderTopColor: G.rule },
});
```

Register it in `Root.tsx` as `document: DocumentScreen`.

- [ ] **Step 2: Documents in Records**

In `src/ui/RecordsView.tsx`, add a `DocumentsSection` above `<LabsSection onOpen={onOpen} />`. It loads `repo.loadDocuments()` when the view is in view (the same `nav.depth` pattern as `LabsSection`) and lists each as a `ListRow` (icon `doc`, title `displayCopy(d.title ?? DOC_TYPE_LABEL[d.docType])`, sub `` displayCopy(`${DOC_TYPE_LABEL[d.docType]}, ${labDay(d.on)}`) ``). On press it calls `chooseDocument(d.id)` and then `onOpen('document')`. With no documents it renders nothing.

```tsx
function DocumentsSection({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const repo = useRepo();
  const nav = useNav();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  useEffect(() => {
    if (nav.depth > 1) return;
    let ignore = false;
    repo
      .loadDocuments()
      .then((rows) => !ignore && setDocs(rows))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);
  if (!docs.length) return null;
  return (
    <ListGroup header="Documents" style={hr.section}>
      {docs.map((d, n) => (
        <ListRow
          key={d.id}
          first={n === 0}
          icon="doc"
          title={displayCopy(d.title ?? DOC_TYPE_LABEL[d.docType])}
          sub={displayCopy(`${DOC_TYPE_LABEL[d.docType]}, ${labDay(d.on)}`)}
          onPress={() => {
            chooseDocument(d.id);
            onOpen('document');
          }}
        />
      ))}
    </ListGroup>
  );
}
```

Imports to add: `type DocumentSummary` from `../data/repo`; `chooseDocument` from `../lib/documentHandoff`; `DOC_TYPE_LABEL` from `../lib/documents`. Check that `ListRow` accepts `onPress`. If it does not, wrap the row in a `Pressable`, as `LabsSection` does.

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: silent, all pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/DocumentScreen.tsx src/ui/RecordsView.tsx src/Root.tsx
git commit -m "Document screen: what the document said, what was filed from it, the original, remove; Documents listed in Records"
```

- [ ] **Step 5: Try it**

Not driveable without a tap tool in this session. Ledger it. The user's phone build (Part B's end) covers it.

# Lab Reports Part 1: Capture and Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** She can scan a paper report with Apple's document camera, upload a portal PDF of any length, or pick a photo. Ciatta reads every page, including panels, the ordering clinician and the specimen. She checks the lines grouped by panel, and the report is saved as one report with its original file kept privately.

**Architecture:** `lab-scan` splits long PDFs with `pdf-lib`, reads the chunks in parallel and merges them with pure, tested helpers. The app validates the result with `readLabScan`. A security invoker RPC, `save_lab_report`, writes the `documents` row and its `results` together after the file is uploaded to the existing private `documents` bucket. A local Expo module wraps `VNDocumentCameraViewController` and writes the scanned pages as one PDF.

**Tech Stack:** Expo 57 / React Native, local Expo module (Swift, VisionKit, PDFKit), Supabase Postgres + Storage + Edge Functions (Deno, `npm:pdf-lib@1.17.1`), node:test via `tsx --test`, pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-14-lab-reports-and-clinical-analysis-design.md` (Part 1).

## Spec amendments carried by this plan

- **Splitting happens in the function, not on the phone.** Splitting on the phone needs a PDF library in the app, while `pdf-lib` runs in the function with no new app dependency. The behaviour the spec asks for is unchanged: chunks of 8 pages, read separately, merged in page order, each chunk counted against the daily limit.
- **`save_lab_report` is security invoker.** `documents` and `results` already have owner RLS for insert and delete, so no definer rights are needed, and the RPC still makes the write atomic.
- **A photo report keeps its photo** (`.jpg`) as the original. A scan or PDF keeps the PDF.

## Global Constraints

- Run app commands from `ciatta-mobile-app/`. Unit tests: `npm test`. Typecheck: `npx tsc --noEmit`. SQL: `supabase test db`.
- Read https://docs.expo.dev/versions/v57.0.0/ (Modules API: local modules) before writing the Expo module.
- UI copy has no em dash, en dash or hyphen, and remote or model text renders through `displayCopy()`.
- Keep Jost and the existing design. Every screen sits on Ground. Reuse `ui/kit.tsx`, `ui/labs.tsx`, `ui/cardFill.tsx`.
- Health data is never logged: counts and failure reasons only.
- Absence is never normal: no range and no flag is never shown as in range.
- An edge function imports only files in its own directory.

## Review Focus

1. **A 20 page portal export.** She expects every page read, not just the first few, and the daily limit to be explained if it runs out. Pinned in Task 2 (`chunkRanges`, `mergeChunks` tests).
2. **A page the model could not read, in the middle of a long report.** She expects to be told which page, so she can check it. Pinned in Task 2 (a failed chunk marks its pages unreadable) and Task 1 (`unreadablePages` keeps only real page numbers).
3. **Saving where one line is invalid** (for example, a flag that is not an HL7 code). She expects either the whole report saved or nothing, never half a report. Pinned in Task 3 (the SQL atomicity test).
4. **Uploading the same PDF twice.** She expects "You added this report on…" rather than duplicate results. Pinned in Task 4 (`findLabReport` in the demo repo test) and Task 3 (the checksum lookup works under RLS).
5. **Another person's file path, or another person's report id.** Saving must refuse a path outside her folder, and removing must not touch another person's report. Pinned in Task 3.

---

### Task 1: Reading the new fields, and grouping by panel

**Files:**
- Modify: `ciatta-mobile-app/src/lib/labs.ts`
- Test: `ciatta-mobile-app/src/lib/labs.test.ts`

**Interfaces:**
- Produces:
  - `ScannedTest` gains `panel: string | null`
  - `LabScan` becomes `{ notLab: boolean; on: string | null; lab: string | null; orderingClinician: string | null; specimen: string | null; pages: number | null; unreadablePages: number[]; tests: ScannedTest[] }`
  - `testFromFields(f: { name; value; unit; range; flag; panel?: string | null }): ScannedTest | null`
  - `groupByPanel<T extends { panel: string | null }>(items: readonly T[]): { title: string; items: T[] }[]`
  - `OTHER_RESULTS = 'Other results'`
  - `LabResult` gains optional `documentId?: string | null` and `panel?: string | null`

- [ ] **Step 1: Write the failing tests** (append to `src/lib/labs.test.ts`, and add `groupByPanel`, `OTHER_RESULTS` to its import from `./labs`)

```ts
test('a report says which panel each test is printed under, and what else the page printed', () => {
  const read = readLabScan({
    not_lab: false,
    collected_on: '2026-06-12',
    lab: 'Quest Diagnostics',
    ordering_clinician: ' Dr A Rivera ',
    specimen: 'Serum',
    pages: 3,
    unreadable_pages: [3, 0, 'x', 9, 3],
    tests: [
      { name: 'Hemoglobin', value: 11.2, value_text: null, unit: 'g/dL', range: '12.0 to 15.5', flag: 'L', panel: 'Complete Blood Count' },
      { name: 'TSH', value: 2.1, value_text: null, unit: 'mIU/L', range: '0.4 to 4.0', flag: null, panel: '  ' },
    ],
  });
  assert.equal(read.orderingClinician, 'Dr A Rivera');
  assert.equal(read.specimen, 'Serum');
  assert.equal(read.pages, 3);
  assert.deepEqual(read.unreadablePages, [3], 'only page numbers that exist on the report, each once');
  assert.equal(read.tests[0].panel, 'Complete Blood Count');
  assert.equal(read.tests[1].panel, null);
});

test('a report with no page count keeps any positive page numbers it names', () => {
  const read = readLabScan({ not_lab: false, unreadable_pages: [2, -1, 1.5], tests: [] });
  assert.equal(read.pages, null);
  assert.deepEqual(read.unreadablePages, [2]);
});

test('a long report keeps every result it read', () => {
  const tests = Array.from({ length: 150 }, (_, n) => ({ name: `Test ${n}`, value: n, value_text: null, unit: null, range: null, flag: null, panel: null }));
  assert.equal(readLabScan({ not_lab: false, tests }).tests.length, 150);
});

test('a line she edited keeps its panel', () => {
  assert.equal(testFromFields({ name: 'TSH', value: '2', unit: '', range: '', flag: null, panel: ' Thyroid ' })?.panel, 'Thyroid');
  assert.equal(testFromFields({ name: 'TSH', value: '2', unit: '', range: '', flag: null })?.panel, null);
});

test('the review groups lines under their printed panel, in the order printed, with the rest last', () => {
  const lines = [
    { id: 'a', panel: 'Complete Blood Count' },
    { id: 'b', panel: null },
    { id: 'c', panel: 'Thyroid' },
    { id: 'd', panel: 'Complete Blood Count' },
  ];
  assert.deepEqual(groupByPanel(lines), [
    { title: 'Complete Blood Count', items: [lines[0], lines[3]] },
    { title: 'Thyroid', items: [lines[2]] },
    { title: OTHER_RESULTS, items: [lines[1]] },
  ]);
  assert.deepEqual(groupByPanel([]), []);
});
```

In the two existing tests `what the model read off a report is checked before she sees it` and `a line she edited is read back as a result, a number when it is one`, add `panel: null` to each `deepEqual` expected object (the shape now has the field).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/labs.test.ts`
Expected: FAIL. `groupByPanel` is not exported, `orderingClinician` is undefined, and the deepEquals miss `panel`.

- [ ] **Step 3: Implement** (in `src/lib/labs.ts`)

Add to `LabResult`, after `on: string;`:

```ts
  // The report it was read from, and the panel heading it was printed
  // under. Absent for provider results and anything saved before reports.
  documentId?: string | null;
  panel?: string | null;
```

Replace `ScannedTest`, `LabScan` and `readLabScan` with:

```ts
export type ScannedTest = {
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
  flag: LabFlag | null;
  // The heading it is printed under: "Complete Blood Count", "Lipid Panel".
  panel: string | null;
};

export type LabScan = {
  notLab: boolean;
  on: string | null;
  lab: string | null;
  orderingClinician: string | null;
  specimen: string | null;
  pages: number | null;
  // Pages of the report the model could not read, so she can check them.
  unreadablePages: number[];
  tests: ScannedTest[];
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pageNumber = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null);

// A long portal export can carry a few hundred results; past this it is not
// one report.
const MAX_TESTS = 300;

// What the model returned, checked. A test with no name, or with neither a
// number nor words for its result, is dropped; a flag that is not an HL7
// code is dropped; nothing is filled in. She checks every line after this.
export function readLabScan(json: unknown): LabScan {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const day = str(j.collected_on);
  const pages = pageNumber(j.pages);
  const tests: ScannedTest[] = [];
  for (const raw of Array.isArray(j.tests) ? j.tests : []) {
    const t = (raw ?? {}) as Record<string, unknown>;
    const name = str(t.name);
    const value = num(t.value);
    const valueText = str(t.value_text);
    if (!name || (value == null && !valueText)) continue;
    const rangeText = str(t.range);
    const flag = str(t.flag)?.toUpperCase() as LabFlag | undefined;
    tests.push({
      name,
      value,
      valueText: value == null ? valueText : null,
      unit: str(t.unit),
      ...parseRange(rangeText),
      rangeText,
      flag: flag && FLAGS.includes(flag) ? flag : null,
      panel: str(t.panel),
    });
  }
  const unreadable = new Set<number>();
  for (const p of Array.isArray(j.unreadable_pages) ? j.unreadable_pages : []) {
    const n = pageNumber(p);
    if (n != null && (pages == null || n <= pages)) unreadable.add(n);
  }
  return {
    notLab: j.not_lab === true,
    on: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    lab: str(j.lab),
    orderingClinician: str(j.ordering_clinician),
    specimen: str(j.specimen),
    pages,
    unreadablePages: [...unreadable].sort((a, b) => a - b),
    tests: tests.slice(0, MAX_TESTS),
  };
}
```

Replace `testFromFields` with:

```ts
// A line she checked on the review screen, read back. A value that is a
// number is kept as one; anything else is kept as her words. A line with no
// name or no result is not a result.
export function testFromFields(f: {
  name: string;
  value: string;
  unit: string;
  range: string;
  flag: LabFlag | null;
  panel?: string | null;
}): ScannedTest | null {
  const name = f.name.trim();
  const raw = f.value.trim();
  if (!name || !raw) return null;
  const n = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
  const rangeText = f.range.trim() || null;
  return {
    name,
    value: n,
    valueText: n == null ? raw : null,
    unit: f.unit.trim() || null,
    ...parseRange(rangeText),
    rangeText,
    flag: f.flag,
    panel: f.panel?.trim() || null,
  };
}

export const OTHER_RESULTS = 'Other results';

// Lines under the panel heading they were printed under, panels in the
// order they first appear, and anything without one last.
export function groupByPanel<T extends { panel: string | null }>(items: readonly T[]): { title: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  const loose: T[] = [];
  for (const item of items) {
    if (!item.panel) {
      loose.push(item);
      continue;
    }
    const list = groups.get(item.panel) ?? [];
    list.push(item);
    groups.set(item.panel, list);
  }
  const out = [...groups].map(([title, list]) => ({ title, items: list }));
  return loose.length ? [...out, { title: OTHER_RESULTS, items: loose }] : out;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/labs.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`. It reports errors where `ScannedTest` objects are built without `panel` (demo repo `scanLab` goes through `readLabScan`, so that one is fine). Fix any by adding `panel: null`. Expected afterwards: no output.

```bash
git add src/lib/labs.ts src/lib/labs.test.ts
git commit -m "Lab reading: panels, ordering clinician, specimen, page count and unreadable pages; review groups lines by panel"
```

---

### Task 2: `lab-scan` reads every page

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/lab-scan/scan.ts`
- Create: `ciatta-mobile-app/supabase/functions/lab-scan/pdf.ts`
- Create: `ciatta-mobile-app/supabase/functions/lab-scan/pdf.test.ts` (Deno)
- Modify: `ciatta-mobile-app/supabase/functions/lab-scan/index.ts`
- Test: `ciatta-mobile-app/src/lib/labScanChunks.test.ts`

**Interfaces:**
- Produces, in `scan.ts`:
  - `CHUNK_PAGES = 8`
  - `chunkRanges(pageCount: number, size?: number): { first: number; last: number }[]` (1 based, inclusive)
  - `type ChunkRead = { first: number; last: number; parsed: Record<string, unknown> | null }`
  - `mergeChunks(reads: ChunkRead[], pages: number): Record<string, unknown>`, in the model's snake_case shape plus `pages`
- Produces, in `pdf.ts`: `pageCount(bytes: Uint8Array): Promise<number>` and `splitPdf(bytes: Uint8Array, ranges: { first: number; last: number }[]): Promise<string[]>` (base64 per range)
- The response body adds `pages`, `ordering_clinician`, `specimen`, `unreadable_pages`, and `panel` per test.

- [ ] **Step 1: Write the failing tests**

`src/lib/labScanChunks.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHUNK_PAGES, chunkRanges, mergeChunks } from '../../supabase/functions/lab-scan/scan.ts';

const t = (name: string, panel: string | null = null) => ({ name, value: 1, value_text: null, unit: null, range: null, flag: null, panel });

test('a short report is read in one go', () => {
  assert.deepEqual(chunkRanges(3), [{ first: 1, last: 3 }]);
  assert.equal(CHUNK_PAGES, 8);
});

test('a long report is read eight pages at a time, every page once', () => {
  assert.deepEqual(chunkRanges(20), [
    { first: 1, last: 8 },
    { first: 9, last: 16 },
    { first: 17, last: 20 },
  ]);
  assert.deepEqual(chunkRanges(0), []);
});

test('chunks merge in page order, with the first report details any chunk found', () => {
  const merged = mergeChunks(
    [
      { first: 9, last: 12, parsed: { not_lab: false, collected_on: null, lab: 'Quest', ordering_clinician: null, specimen: 'Serum', unreadable_pages: [], tests: [t('TSH', 'Thyroid')] } },
      { first: 1, last: 8, parsed: { not_lab: false, collected_on: '2026-06-12', lab: null, ordering_clinician: 'Dr Rivera', specimen: null, unreadable_pages: [2], tests: [t('Hemoglobin', 'CBC')] } },
    ],
    12,
  );
  assert.equal(merged.collected_on, '2026-06-12');
  assert.equal(merged.lab, 'Quest');
  assert.equal(merged.ordering_clinician, 'Dr Rivera');
  assert.equal(merged.specimen, 'Serum');
  assert.deepEqual((merged.tests as { name: string }[]).map((x) => x.name), ['Hemoglobin', 'TSH']);
  assert.deepEqual(merged.unreadable_pages, [2]);
  assert.equal(merged.pages, 12);
  assert.equal(merged.not_lab, false);
});

test('a page number a chunk reports is counted from the start of the whole report', () => {
  const merged = mergeChunks([{ first: 9, last: 16, parsed: { not_lab: false, unreadable_pages: [3, 40], tests: [t('TSH')] } }], 16);
  assert.deepEqual(merged.unreadable_pages, [11], 'page 3 of the second chunk is page 11; a page beyond the chunk is dropped');
});

test('a chunk that could not be read marks all its pages unreadable, and the rest still arrive', () => {
  const merged = mergeChunks(
    [
      { first: 1, last: 8, parsed: { not_lab: false, tests: [t('Hemoglobin')] } },
      { first: 9, last: 10, parsed: null },
    ],
    10,
  );
  assert.deepEqual(merged.unreadable_pages, [9, 10]);
  assert.equal((merged.tests as unknown[]).length, 1);
});

test('it is not a lab report only when no chunk found a lab report', () => {
  assert.equal(mergeChunks([{ first: 1, last: 1, parsed: { not_lab: true, tests: [] } }], 1).not_lab, true);
  assert.equal(
    mergeChunks(
      [
        { first: 1, last: 8, parsed: { not_lab: true, tests: [] } },
        { first: 9, last: 9, parsed: { not_lab: false, tests: [t('TSH')] } },
      ],
      9,
    ).not_lab,
    false,
  );
});
```

`supabase/functions/lab-scan/pdf.test.ts` (Deno):

```ts
import { assertEquals } from 'jsr:@std/assert@1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

import { pageCount, splitPdf } from './pdf.ts';

async function pdfOf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return await doc.save();
}

Deno.test('a PDF is counted and split into the ranges asked for', async () => {
  const bytes = await pdfOf(20);
  assertEquals(await pageCount(bytes), 20);
  const parts = await splitPdf(bytes, [
    { first: 1, last: 8 },
    { first: 9, last: 16 },
    { first: 17, last: 20 },
  ]);
  const counts = await Promise.all(parts.map(async (b64) => (await PDFDocument.load(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).getPageCount()));
  assertEquals(counts, [8, 8, 4]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/labScanChunks.test.ts`
Expected: FAIL, `scan.ts` cannot be found.
Run: `deno test --node-modules-dir=none supabase/functions/lab-scan/pdf.test.ts`
Expected: FAIL, `./pdf.ts` cannot be found. If Deno refuses the flag, run from `supabase/functions/lab-scan` with `deno test --no-config pdf.test.ts`, and use the same form in Step 4.

- [ ] **Step 3: Implement**

`supabase/functions/lab-scan/scan.ts`:

```ts
// Reading a long report in pieces, and putting the pieces back together.
// Pure, so it is tested from the app's suite.

export const CHUNK_PAGES = 8;

export function chunkRanges(pageCount: number, size = CHUNK_PAGES): { first: number; last: number }[] {
  const out: { first: number; last: number }[] = [];
  for (let first = 1; first <= pageCount; first += size) out.push({ first, last: Math.min(pageCount, first + size - 1) });
  return out;
}

export type ChunkRead = { first: number; last: number; parsed: Record<string, unknown> | null };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

// Chunks in page order. Report details come from the first chunk that has
// them. A page number a chunk names is counted from that chunk's first
// page. A chunk that failed to read marks every one of its pages
// unreadable, so she is told exactly what to check.
export function mergeChunks(reads: ChunkRead[], pages: number): Record<string, unknown> {
  const ordered = [...reads].sort((a, b) => a.first - b.first);
  const pick = (key: string) => {
    for (const r of ordered) {
      const v = text(r.parsed?.[key]);
      if (v) return v;
    }
    return null;
  };
  const tests: unknown[] = [];
  const unreadable = new Set<number>();
  let anyLab = false;
  for (const r of ordered) {
    if (!r.parsed) {
      for (let p = r.first; p <= r.last; p++) unreadable.add(p);
      continue;
    }
    const chunkTests = Array.isArray(r.parsed.tests) ? r.parsed.tests : [];
    if (r.parsed.not_lab !== true || chunkTests.length) anyLab = true;
    tests.push(...chunkTests);
    for (const p of Array.isArray(r.parsed.unreadable_pages) ? r.parsed.unreadable_pages : []) {
      if (typeof p !== 'number' || !Number.isInteger(p) || p < 1) continue;
      const page = r.first + p - 1;
      if (page <= r.last) unreadable.add(page);
    }
  }
  return {
    not_lab: !anyLab,
    collected_on: pick('collected_on'),
    lab: pick('lab'),
    ordering_clinician: pick('ordering_clinician'),
    specimen: pick('specimen'),
    pages,
    unreadable_pages: [...unreadable].sort((a, b) => a - b),
    tests,
  };
}
```

`supabase/functions/lab-scan/pdf.ts`:

```ts
// Counting and splitting a PDF, so a long portal export is read in pieces
// small enough for the model. Nothing is kept: the pieces exist only for
// the length of the request.

import { PDFDocument } from 'npm:pdf-lib@1.17.1';

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function splitPdf(bytes: Uint8Array, ranges: { first: number; last: number }[]): Promise<string[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out: string[] = [];
  for (const { first, last } of ranges) {
    const part = await PDFDocument.create();
    const indices = Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i);
    for (const page of await part.copyPages(src, indices)) part.addPage(page);
    out.push(await part.saveAsBase64());
  }
  return out;
}
```

In `supabase/functions/lab-scan/index.ts`:
- Update the header comment's first paragraph to add: "A PDF over eight pages is split and read eight pages at a time; each piece counts against the day's limit."
- Add imports: `import { pageCount, splitPdf } from './pdf.ts';` and `import { chunkRanges, type ChunkRead, mergeChunks } from './scan.ts';`
- In `SCHEMA.schema`, set `required` to `['not_lab', 'collected_on', 'lab', 'ordering_clinician', 'specimen', 'unreadable_pages', 'tests']`. Add these properties:
  - `ordering_clinician: NULLABLE('string')`
  - `specimen: NULLABLE('string')`
  - `unreadable_pages: { type: 'array', items: { type: 'integer' } }`
- In the test item schema, add `'panel'` to `required` and `panel: NULLABLE('string')` to `properties`.
- Append to `INSTRUCTIONS` (before `.join(' ')`):

```ts
  'panel is the heading the test is printed under, such as "Complete Blood Count", "Comprehensive Metabolic Panel" or "Lipid Panel", or null when it is under none.',
  'ordering_clinician is the ordering or referring clinician as printed, or null. specimen is the specimen as printed (for example "Serum", "Whole blood", "Urine"), or null.',
  'unreadable_pages lists the page numbers of this document, counted from 1, that you could not read; an empty list when you read every page.',
```

- Replace everything from `// Counted before anything is spent` up to the end of `Deno.serve` with:

```ts
  if (!openAiKey) {
    console.log('lab-scan: no OPENAI_API_KEY configured');
    return json({ error: 'Reading lab reports is not set up yet' }, 503);
  }

  let body: { file?: unknown; kind?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const { file, kind } = body;
  if (typeof file !== 'string' || !file.length || (kind !== 'image' && kind !== 'pdf')) return json({ error: 'Bad request' }, 400);
  if (file.length > MAX_BASE64) return json({ error: 'That file is too large' }, 413);

  // The pieces to read: one for a photo, eight pages at a time for a PDF.
  let pages = 1;
  let parts: { first: number; last: number; part: unknown }[];
  if (kind === 'pdf') {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(file), (c) => c.charCodeAt(0));
      pages = await pageCount(bytes);
    } catch {
      return json({ error: 'That PDF could not be opened' }, 400);
    }
    const ranges = chunkRanges(pages);
    const pieces = ranges.length === 1 ? [file] : await splitPdf(bytes, ranges);
    parts = ranges.map((r, i) => ({
      ...r,
      part: { type: 'file', file: { filename: `lab-report-${r.first}.pdf`, file_data: `data:application/pdf;base64,${pieces[i]}` } },
    }));
  } else {
    parts = [{ first: 1, last: 1, part: { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${file}`, detail: 'high' } } }];
  }

  // Counted before anything is spent: each piece is one of the day's 20.
  for (let i = 0; i < parts.length; i++) {
    const { data: allowed, error: claimError } = await db.rpc('claim_lab_scan');
    if (claimError) return json({ error: 'Could not check today\'s scans' }, 500);
    if (allowed !== true) {
      return json({ error: parts.length > 1 ? `This report needs ${parts.length} of today's reads and there are not enough left. Try again tomorrow.` : 'That is the most lab reports for today. Try again tomorrow.' }, 429);
    }
  }

  const reads: ChunkRead[] = await Promise.all(parts.map(async ({ first, last, part }) => ({ first, last, parsed: await readPart(part) })));
  if (reads.every((r) => r.parsed == null)) return json({ error: 'Could not read the report' }, 502);
  const merged = mergeChunks(reads, pages);
  console.log(`lab-scan: ${kind}, ${pages} pages, ${parts.length} pieces, ${(merged.tests as unknown[]).length} tests`);
  return json(merged);
});

// One piece, read by the model. Null when the model failed or answered
// with something that is not the schema; the merge marks its pages.
async function readPart(part: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          { role: 'user', content: [part] },
        ],
      }),
    });
    if (!res.ok) {
      console.log(`lab-scan: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? JSON.parse(text) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.log(`lab-scan: piece failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/labScanChunks.test.ts`
Expected: PASS.
Run: the Deno command that worked in Step 2.
Expected: `ok | 1 passed`.

- [ ] **Step 5: Check the function type checks, and commit**

Run: `deno check --node-modules-dir=none supabase/functions/lab-scan/index.ts`, or the `--no-config` form from inside the directory.
Expected: no errors. If the only error is Deno not resolving `npm:@supabase/supabase-js` from `node_modules` (the known local setting), note it in the ledger and move on.

```bash
git add supabase/functions/lab-scan src/lib/labScanChunks.test.ts
git commit -m "lab-scan reads every page: PDFs over eight pages are split and read in parallel, merged in page order, unreadable pages named"
```

---

### Task 3: Saving and removing a report, atomically

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261019100000_lab_reports.sql`
- Test: `ciatta-mobile-app/supabase/tests/lab_reports.test.sql`
- Modify: `ciatta-mobile-app/supabase/tests/grants.test.sql`

**Interfaces:**
- Produces:
  - `public.save_lab_report(p_title text, p_collected_on date, p_storage_path text, p_metadata jsonb, p_tests jsonb) returns uuid`. Each element of `p_tests` is `{ name, panel, value, value_text, unit, low, high, range, flag }`.
  - `public.remove_lab_report(p_document uuid) returns text`: the storage path to delete, or null when it was not hers.
  - Index `documents_lab_checksum` on `(user_id, (metadata->>'checksum'))` where `doc_type = 'lab_report'`.

- [ ] **Step 1: Write the failing SQL test**

`supabase/tests/lab_reports.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'f@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

create temp table saved (id uuid) on commit drop;
grant all on saved to authenticated;

select lives_ok($$
  insert into saved select public.save_lab_report(
    'Quest Diagnostics', '2026-06-12',
    '00000000-0000-0000-0000-0000000000e1/lab-reports/r1.pdf',
    '{"lab":"Quest Diagnostics","pages":3,"checksum":"abc"}'::jsonb,
    '[{"name":"Hemoglobin","panel":"Complete Blood Count","value":11.2,"value_text":null,"unit":"g/dL","low":12,"high":15.5,"range":"12.0 to 15.5","flag":"L"},
      {"name":"HBsAg","panel":null,"value":null,"value_text":"Non reactive","unit":null,"low":null,"high":null,"range":"Non reactive","flag":null}]'::jsonb)
$$, 'she can save a report');

select is((select count(*)::int from public.documents where doc_type = 'lab_report'), 1, 'one report');
select is((select count(*)::int from public.results where document_id = (select id from saved)), 2, 'its results point at it');
select is((select panel from public.results where test_name = 'Hemoglobin'), 'Complete Blood Count', 'the panel is kept');
select is((select source from public.results where test_name = 'HBsAg'), 'report', 'results are marked as read from a report');
select is((select id from public.documents where metadata->>'checksum' = 'abc' and doc_type = 'lab_report'), (select id from saved),
  'the same file is found again by its checksum');

select throws_ok($$
  select public.save_lab_report('X', '2026-06-12', '00000000-0000-0000-0000-0000000000e1/lab-reports/r2.pdf', '{}'::jsonb,
    '[{"name":"TSH","panel":null,"value":2,"value_text":null,"unit":null,"low":null,"high":null,"range":null,"flag":null},
      {"name":"Bad","panel":null,"value":1,"value_text":null,"unit":null,"low":null,"high":null,"range":null,"flag":"Q"}]'::jsonb)
$$, '23514', null, 'one invalid line refuses the whole report');
select is((select count(*)::int from public.documents where storage_path like '%r2.pdf'), 0, 'and nothing of it was saved');

select throws_ok($$
  select public.save_lab_report('X', '2026-06-12', '00000000-0000-0000-0000-0000000000f1/lab-reports/r3.pdf', '{}'::jsonb,
    '[{"name":"TSH","panel":null,"value":2,"value_text":null,"unit":null,"low":null,"high":null,"range":null,"flag":null}]'::jsonb)
$$, '42501', null, 'a file outside her own folder is refused');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is(public.remove_lab_report((select id from saved)), null, 'someone else cannot remove her report');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select is(public.remove_lab_report((select id from saved)), '00000000-0000-0000-0000-0000000000e1/lab-reports/r1.pdf',
  'she removes it, and is given the file to delete');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: `lab_reports.test.sql` fails because `public.save_lab_report(...)` does not exist.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261019100000_lab_reports.sql`:

```sql
-- A lab report she added: one documents row, and its results pointing at
-- it, written together or not at all. The file itself is uploaded by the
-- app to the private documents bucket first, under her own folder; this
-- refuses any path outside it.
--
-- Security invoker: documents and results already carry owner RLS for
-- insert and delete, so these run with exactly her rights, and the
-- function only adds the all or nothing.

create function public.save_lab_report(
  p_title text,
  p_collected_on date,
  p_storage_path text,
  p_metadata jsonb,
  p_tests jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  doc uuid;
  at timestamptz := (p_collected_on::text || 'T12:00:00Z')::timestamptz;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> me::text then
    raise exception 'not her file' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tests) <> 'array' or jsonb_array_length(p_tests) = 0 then
    raise exception 'no results' using errcode = '22023';
  end if;

  insert into public.documents (user_id, storage_path, title, doc_type, extraction_status, occurred_at, metadata)
  values (me, p_storage_path, p_title, 'lab_report', 'extracted', at, coalesce(p_metadata, '{}'::jsonb))
  returning id into doc;

  insert into public.results (
    user_id, document_id, test_name, panel, value, value_text, unit,
    reference_low, reference_high, reference_text, flag, status, provider, source, occurred_at
  )
  select
    me, doc, t->>'name', nullif(t->>'panel', ''), (t->>'value')::numeric, t->>'value_text', t->>'unit',
    (t->>'low')::numeric, (t->>'high')::numeric, t->>'range', t->>'flag', 'final', p_metadata->>'lab', 'report', at
  from jsonb_array_elements(p_tests) as t;

  return doc;
end $$;

revoke execute on function public.save_lab_report(text, date, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_lab_report(text, date, text, jsonb, jsonb) to authenticated;

-- Removing a report: its results, then the report. results.document_id is
-- on delete set null, so the results are deleted here rather than left
-- behind as labs with no report. Returns the stored file's path for the
-- app to delete from storage, or null when the report was not hers.
create function public.remove_lab_report(p_document uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  path text;
begin
  select storage_path into path from public.documents
  where id = p_document and user_id = me and doc_type = 'lab_report';
  if path is null then
    return null;
  end if;
  delete from public.results where document_id = p_document and user_id = me;
  delete from public.documents where id = p_document and user_id = me;
  return path;
end $$;

revoke execute on function public.remove_lab_report(uuid) from public, anon;
grant execute on function public.remove_lab_report(uuid) to authenticated;

create index documents_lab_checksum on public.documents (user_id, (metadata->>'checksum'))
  where doc_type = 'lab_report';
```

In `supabase/tests/grants.test.sql`, add `remove_lab_report` and `save_lab_report` to the alphabetical expected list, and add `remove_lab_report and save_lab_report (20261019100000_lab_reports.sql)` to the comment above it.

Apply it: `supabase migration up`

- [ ] **Step 4: Run the SQL tests**

Run: `supabase test db`
Expected: `Result: PASS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261019100000_lab_reports.sql supabase/tests/lab_reports.test.sql supabase/tests/grants.test.sql
git commit -m "Lab reports saved and removed whole: one report and its results together, only from her own folder"
```

---

### Task 4: The repo saves, finds and removes reports

**Files:**
- Modify: `ciatta-mobile-app/src/data/repo.ts`
- Test: `ciatta-mobile-app/src/data/repo.test.ts`

**Interfaces:**
- Consumes: `ScannedTest`, `LabScan` (Task 1), `save_lab_report` and `remove_lab_report` (Task 3).
- Produces, on the repo interface (replacing `saveLabs`):
  - `type LabReportInput = { file: { base64: string; kind: 'image' | 'pdf' }; checksum: string; on: string; lab: string | null; orderingClinician: string | null; specimen: string | null; pages: number | null; tests: ScannedTest[] }`
  - `saveLabReport(input: LabReportInput): Promise<string>` (the document id)
  - `findLabReport(checksum: string): Promise<{ id: string; on: string } | null>`
  - `removeLabReport(id: string): Promise<void>`
  - `loadLabs()` rows now carry `documentId` and `panel`

- [ ] **Step 1: Change the failing test** (in `src/data/repo.test.ts`, replace the body of `the example person has labs, and a scanned report is saved as hers` from `const scan = ...` to the end)

```ts
  const scan = await repo.scanLab('base64', 'image');
  assert.ok(scan.tests.length > 0);
  const input = {
    file: { base64: 'aGVsbG8=', kind: 'pdf' as const },
    checksum: 'sum-1',
    on: '2026-10-01',
    lab: 'Example Lab',
    orderingClinician: null,
    specimen: null,
    pages: 1,
    tests: scan.tests.slice(0, 1),
  };
  const id = await repo.saveLabReport(input);
  const after = await repo.loadLabs();
  assert.equal(after.length, before.length + 1);
  const saved = after.find((l) => l.on === '2026-10-01')!;
  assert.equal(saved.source, 'report');
  assert.equal(saved.documentId, id);
  assert.deepEqual(await repo.findLabReport('sum-1'), { id, on: '2026-10-01' }, 'the same file is recognised');
  assert.equal(await repo.findLabReport('another'), null);
  await repo.removeLabReport(id);
  assert.equal((await repo.loadLabs()).length, before.length, 'removing the report removes its results');
  assert.equal(await repo.findLabReport('sum-1'), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test src/data/repo.test.ts`
Expected: FAIL, `repo.saveLabReport is not a function`.

- [ ] **Step 3: Implement** (in `src/data/repo.ts`)

- In the interface, replace the `saveLabs` line and its comment with:

```ts
  // A checked lab report: its original file kept privately, and its results
  // saved with it, all or nothing. Returns the report's id.
  saveLabReport(input: LabReportInput): Promise<string>;
  // A report she already added from the same file, by its checksum.
  findLabReport(checksum: string): Promise<{ id: string; on: string } | null>;
  // The report, its results and its stored file.
  removeLabReport(id: string): Promise<void>;
```

- Above the interface, export:

```ts
export type LabReportInput = {
  file: { base64: string; kind: 'image' | 'pdf' };
  checksum: string;
  on: string;
  lab: string | null;
  orderingClinician: string | null;
  specimen: string | null;
  pages: number | null;
  tests: ScannedTest[];
};
```

- In the demo repo, replace `saveLabs` with:

```ts
    saveLabReport: async (input) => {
      const id = `report-${Date.now()}`;
      demoReports.push({ id, on: input.on, checksum: input.checksum });
      labs = [
        ...labs,
        ...input.tests.map((t, n) => ({ id: `${id}-${n}`, ...t, status: 'final', source: 'report' as const, lab: input.lab, on: input.on, documentId: id })),
      ];
      return id;
    },
    findLabReport: async (checksum) => {
      const hit = demoReports.find((r) => r.checksum === checksum);
      return hit ? { id: hit.id, on: hit.on } : null;
    },
    removeLabReport: async (id) => {
      demoReports = demoReports.filter((r) => r.id !== id);
      labs = labs.filter((l) => l.documentId !== id);
    },
```

  and declare next to `let labs: LabResult[] = sampleLabs();`:

```ts
  let demoReports: { id: string; on: string; checksum: string }[] = [];
```

- In the real repo, replace `saveLabs` with:

```ts
    async saveLabReport(input) {
      const reportId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).toLowerCase();
      const ext = input.file.kind === 'pdf' ? 'pdf' : 'jpg';
      const path = `${userId}/lab-reports/${reportId}.${ext}`;
      const bytes = Uint8Array.from(atob(input.file.base64), (c) => c.charCodeAt(0));
      const { error: uploadError } = await db.storage
        .from('documents')
        .upload(path, bytes, { contentType: input.file.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await db.rpc('save_lab_report', {
        p_title: input.lab ?? 'Lab report',
        p_collected_on: input.on,
        p_storage_path: path,
        p_metadata: {
          lab: input.lab,
          ordering_clinician: input.orderingClinician,
          specimen: input.specimen,
          pages: input.pages,
          panels: [...new Set(input.tests.map((t) => t.panel).filter((p): p is string => !!p))],
          checksum: input.checksum,
        },
        p_tests: input.tests.map((t) => ({
          name: t.name,
          panel: t.panel,
          value: t.value,
          value_text: t.valueText,
          unit: t.unit,
          low: t.low,
          high: t.high,
          range: t.rangeText,
          flag: t.flag,
        })),
      });
      if (error) {
        // The file went up but the report did not: take the file back down.
        await db.storage.from('documents').remove([path]);
        throw error;
      }
      return data as string;
    },
    async findLabReport(checksum) {
      const rows = must(
        await db
          .from('documents')
          .select('id, occurred_at')
          .eq('doc_type', 'lab_report')
          .eq('metadata->>checksum', checksum)
          .limit(1),
      ) as { id: string; occurred_at: string }[] | null;
      const hit = rows?.[0];
      return hit ? { id: hit.id, on: hit.occurred_at.slice(0, 10) } : null;
    },
    async removeLabReport(id) {
      const { data: path, error } = await db.rpc('remove_lab_report', { p_document: id });
      if (error) throw error;
      if (typeof path === 'string') await db.storage.from('documents').remove([path]);
    },
```

- In `loadLabs`, add `, document_id, panel` to the `select` list. Add `document_id: string | null; panel: string | null;` to `LabRow`, and add to the object `labFromRow` returns:

```ts
    documentId: r.document_id,
    panel: r.panel,
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx tsx --test src/data/repo.test.ts && npx tsc --noEmit`
Expected: PASS. The only typecheck error is `AddLabsScreen.tsx` calling `repo.saveLabs`, which Task 6 replaces. Leave it until then and note it in the ledger, or change that call to the new method now with `file: { base64: '', kind: 'pdf' }` and `checksum: ''`.

- [ ] **Step 5: Commit**

```bash
git add src/data/repo.ts src/data/repo.test.ts
git commit -m "Repo: a lab report is saved with its original file, found again by checksum, and removed whole"
```

---

### Task 5: The document scanner module

**Files:**
- Create: `ciatta-mobile-app/modules/document-scanner/expo-module.config.json`
- Create: `ciatta-mobile-app/modules/document-scanner/index.ts`
- Create: `ciatta-mobile-app/modules/document-scanner/ios/DocumentScanner.podspec`
- Create: `ciatta-mobile-app/modules/document-scanner/ios/DocumentScannerModule.swift`
- Test: `ciatta-mobile-app/src/lib/documentScanner.test.ts`

**Interfaces:**
- Produces, from `modules/document-scanner`:
  - `isScannerAvailable(): boolean`
  - `scanDocument(): Promise<{ uri: string; pages: number } | null>`

- [ ] **Step 1: Read the Expo 57 local module docs**

Fetch https://docs.expo.dev/versions/v57.0.0/ for the Modules API pages "Get started" (local module with `npx create-expo-module --local`), "Module API reference" and "Native module tutorial". Confirm three things:
- the config file name and shape
- that `modules/` is autolinked
- how an `AsyncFunction` presents a view controller (`appContext?.utilities?.currentViewController()`)

Where they differ from the code below, follow the docs and ledger a ruling.

- [ ] **Step 2: Write the failing test**

`src/lib/documentScanner.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isScannerAvailable, scanDocument } from '../../modules/document-scanner';

test('without the native scanner (Android, web, tests) the scan option is unavailable and scanning returns nothing', async () => {
  assert.equal(isScannerAvailable(), false);
  assert.equal(await scanDocument(), null);
});
```

Run: `npx tsx --test src/lib/documentScanner.test.ts`
Expected: FAIL, the module cannot be found.

- [ ] **Step 3: Implement**

`modules/document-scanner/expo-module.config.json`:

```json
{
  "platforms": ["apple"],
  "apple": {
    "modules": ["DocumentScannerModule"]
  }
}
```

`modules/document-scanner/index.ts`:

```ts
// Apple's document camera, for scanning a paper lab report: it finds the
// page edges, straightens each page, and takes several pages in one go.
// The pages come back as one PDF in the app's cache, so a scan takes the
// same path as a PDF from a patient portal.
//
// iOS only. Anywhere the native module is missing (Android, web, tests)
// the option is unavailable and scanning returns nothing.

type Native = { isAvailable(): boolean; scan(): Promise<{ uri: string; pages: number } | null> };

function native(): Native | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    return requireOptionalNativeModule<Native>('DocumentScanner');
  } catch {
    return null;
  }
}

export function isScannerAvailable(): boolean {
  try {
    return native()?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

export async function scanDocument(): Promise<{ uri: string; pages: number } | null> {
  const scanner = native();
  if (!scanner) return null;
  return await scanner.scan();
}
```

`modules/document-scanner/ios/DocumentScanner.podspec`:

```ruby
Pod::Spec.new do |s|
  s.name           = 'DocumentScanner'
  s.version        = '1.0.0'
  s.summary        = 'Apple document camera for scanning lab reports in Ciatta'
  s.description    = 'Wraps VNDocumentCameraViewController and returns the scanned pages as one PDF.'
  s.author         = 'Ciatta'
  s.homepage       = 'https://www.ciatta.io'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'VisionKit', 'PDFKit'
  s.source_files   = '**/*.{h,m,swift}'
end
```

`modules/document-scanner/ios/DocumentScannerModule.swift`:

```swift
import ExpoModulesCore
import PDFKit
import UIKit
import VisionKit

// Apple's document camera, returning the pages as one PDF in the cache.
// Pages are downscaled and recompressed so a several page report stays
// small enough to send to be read.
public class DocumentScannerModule: Module {
  private var session: ScanSession?

  public func definition() -> ModuleDefinition {
    Name("DocumentScanner")

    Function("isAvailable") { () -> Bool in
      VNDocumentCameraViewController.isSupported
    }

    AsyncFunction("scan") { (promise: Promise) in
      guard VNDocumentCameraViewController.isSupported else {
        promise.resolve(nil)
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("E_NO_VIEW", "There is no screen to show the scanner on")
        return
      }
      let session = ScanSession(promise: promise) { [weak self] in self?.session = nil }
      self.session = session
      let camera = VNDocumentCameraViewController()
      camera.delegate = session
      presenter.present(camera, animated: true)
    }.runOnQueue(.main)
  }
}

final class ScanSession: NSObject, VNDocumentCameraViewControllerDelegate {
  private let promise: Promise
  private let finished: () -> Void

  init(promise: Promise, finished: @escaping () -> Void) {
    self.promise = promise
    self.finished = finished
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    let pdf = PDFDocument()
    for index in 0..<scan.pageCount {
      if let page = PDFPage(image: Self.compressed(scan.imageOfPage(at: index))) {
        pdf.insert(page, at: pdf.pageCount)
      }
    }
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("lab-scan-\(UUID().uuidString).pdf")
    controller.dismiss(animated: true) {
      if pdf.pageCount > 0 && pdf.write(to: url) {
        self.promise.resolve(["uri": url.absoluteString, "pages": pdf.pageCount])
      } else {
        self.promise.reject("E_WRITE", "The scan could not be saved")
      }
      self.finished()
    }
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true) {
      self.promise.resolve(nil)
      self.finished()
    }
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    controller.dismiss(animated: true) {
      self.promise.reject("E_SCAN", "The scanner stopped")
      self.finished()
    }
  }

  // Wide enough for small print, small enough to send.
  private static func compressed(_ image: UIImage) -> UIImage {
    let maxWidth: CGFloat = 1700
    let scale = min(1, maxWidth / max(image.size.width, 1))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let resized = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    guard let data = resized.jpegData(compressionQuality: 0.6), let out = UIImage(data: data) else { return resized }
    return out
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx tsx --test src/lib/documentScanner.test.ts`
Expected: PASS (no native module under node).

- [ ] **Step 5: Compile it into the iOS app**

Run: `npx expo prebuild --platform ios --no-install && cd ios && pod install && cd ..`, then `npx expo run:ios --no-bundler` (a simulator build).
Expected: the build succeeds and the pod list includes `DocumentScanner`. The camera does not exist in the simulator, so `isScannerAvailable()` is false there. That is expected, and scanning itself is tried on a device in Task 6 Step 5.

If the build fails for a reason outside this module (signing, an unrelated pod), note the error in the ledger and continue. The module's own Swift must compile.

- [ ] **Step 6: Commit**

```bash
git add modules/document-scanner src/lib/documentScanner.test.ts
git commit -m "Document scanner: a local Expo module wrapping Apple's document camera, returning the pages as one PDF"
```

---

### Task 6: Add a Lab Report, rebuilt around reports

**Files:**
- Modify: `ciatta-mobile-app/src/screens/AddLabsScreen.tsx`

**Interfaces:**
- Consumes: `isScannerAvailable`, `scanDocument` (Task 5); `readLabScan` fields and `groupByPanel`, `OTHER_RESULTS` (Task 1); `repo.saveLabReport`, `repo.findLabReport` (Task 4).
- Produces: after saving, `nav.back()`. Part 2 changes this to open the new report.

- [ ] **Step 1: Hold the file, and read the pages**

In `AddLabsScreen`:
- Add `import * as Crypto from 'expo-crypto';`, `import { isScannerAvailable, scanDocument } from '../../modules/document-scanner';`, and `groupByPanel` to the `../lib/labs` import.
- Extend `Line` with `panel: string | null`, and `lineFrom` with `panel: t.panel`.
- Add state:

```tsx
  const [file, setFile] = useState<{ base64: string; kind: 'image' | 'pdf'; checksum: string } | null>(null);
  const [meta, setMeta] = useState<{ orderingClinician: string | null; specimen: string | null; pages: number | null; unreadable: number[] }>({
    orderingClinician: null,
    specimen: null,
    pages: null,
    unreadable: [],
  });
  const [duplicate, setDuplicate] = useState<{ id: string; on: string } | null>(null);
  const canScan = isScannerAvailable();
```

- Replace `read` with:

```tsx
  const read = async (base64: string, kind: 'image' | 'pdf') => {
    setNote(null);
    setDuplicate(null);
    const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    const seen = await repo.findLabReport(checksum).catch(() => null);
    if (seen) {
      setDuplicate(seen);
      return;
    }
    setStage('reading');
    try {
      const scan = await repo.scanLab(base64, kind);
      if (scan.notLab || !scan.tests.length) {
        setNote(scan.notLab ? 'This does not look like a lab report. Nothing was saved.' : 'Ciatta could not read any results from this file. Nothing was saved.');
        setStage('pick');
        return;
      }
      setFile({ base64, kind, checksum });
      setMeta({ orderingClinician: scan.orderingClinician, specimen: scan.specimen, pages: scan.pages, unreadable: scan.unreadablePages });
      setLines(scan.tests.map(lineFrom));
      setLab(scan.lab ?? '');
      if (scan.on) {
        const [y, m, d] = scan.on.split('-');
        setYear(y);
        setMonth(String(Number(m)));
        setDay(String(Number(d)));
      }
      setStage('review');
    } catch (e) {
      setNote(userFacingError(e, 'The report could not be read. Try again.'));
      setStage('pick');
    }
  };
```

- Replace `fromCamera(camera: boolean)` with `fromPhoto()`, which is the library branch only, since the camera is replaced by the scanner. Add:

```tsx
  const fromScan = async () => {
    try {
      const scanned = await scanDocument();
      if (!scanned) return;
      await read(await new File(scanned.uri).base64(), 'pdf');
    } catch {
      setNote('The scan did not open. Try again.');
    }
  };
```

- In `kept`, pass the panel through: `testFromFields(l)` already receives `l`, and `l` now has `panel`.

- Replace `save` with:

```tsx
  const save = async () => {
    if (!on || !kept.length || saving || !file) return;
    setSaving(true);
    setNote(null);
    try {
      await repo.saveLabReport({
        file: { base64: file.base64, kind: file.kind },
        checksum: file.checksum,
        on,
        lab: lab.trim() || null,
        orderingClinician: meta.orderingClinician,
        specimen: meta.specimen,
        pages: meta.pages,
        tests: kept,
      });
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'Your report did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 2: The pick stage: three choices, and the duplicate notice**

Replace the `stage === 'pick'` block's contents with:

```tsx
        <>
          <Lead style={s.lede} text={"Scan a paper report, or upload the PDF from your patient portal. Ciatta reads every page, then you check each line before anything is saved."} />
          <View style={{ gap: 12 }}>
            {canScan ? <PrimaryButton label="Scan a Paper Report" onPress={() => void fromScan()} /> : null}
            {canScan ? (
              <SecondaryButton label="Upload a PDF" onPress={() => void fromPdf()} />
            ) : (
              <PrimaryButton label="Upload a PDF" onPress={() => void fromPdf()} />
            )}
            <SecondaryButton label="Choose a Photo" onPress={() => void fromPhoto()} />
          </View>
          {duplicate ? (
            <View style={[s.card, { marginTop: SPACE.near }]}>
              <CardFill />
              <Text style={[font('subhead'), s.ink]}>{displayCopy(`You added this report on ${labDay(duplicate.on)}. It is already in your labs.`)}</Text>
            </View>
          ) : null}
          <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near }]}>
            The report is sent to OpenAI to be read. The original is kept privately in your Ciatta account so you can check any result against it, and you can remove it at any time.
          </Text>
        </>
```

Add `labDay` to the `../lib/labs` import.

- [ ] **Step 3: The review stage: panels and unreadable pages**

In the `stage === 'review'` block:
- Directly after the collection date row, add:

```tsx
          {meta.unreadable.length ? (
            <Text style={[font('footnote'), s.warn, { marginTop: 10 }]}>
              {meta.unreadable.length === 1
                ? `Page ${meta.unreadable[0]} could not be read. Check it against your report.`
                : `Pages ${meta.unreadable.join(', ')} could not be read. Check them against your report.`}
            </Text>
          ) : null}
```

- Replace `{lines.map((l) => { ... })}` with a grouped render. The existing per line card JSX moves unchanged into `renderLine`:

```tsx
          {groupByPanel(lines).map((group) => (
            <View key={group.title} style={{ marginTop: SPACE.block }}>
              <Text style={[font('footnote', 'semibold'), s.panel]}>{displayCopy(group.title)}</Text>
              {group.items.map(renderLine)}
            </View>
          ))}
```

  Define `const renderLine = (l: Line) => { const p = preview(l); return ( ...the existing card JSX... ); };` above the `return`.

- Add to the stylesheet:

```ts
  panel: { color: G.body, marginBottom: 2 },
  warn: { color: HUE.attention },
```

  and import `HUE` from `../ui/surface`.

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: the typecheck is silent and every test passes.

- [ ] **Step 5: Try it**

In the demo repo, in a development build or the simulator, sign in with Look Around First (the demo person):
- Open Care, then Add a lab report, then Upload a PDF, and pick any PDF. The demo `scanLab` returns its two fixed results.
- Check the review shows them under Other results with the date filled in, then save.
- Records → Labs shows the new draw on 1 Oct 2026.
- Pick the same file again. The duplicate notice appears.

On a device, scan a 2 page paper document with Scan a Paper Report and confirm it reaches the reading stage. That needs a development build installed on the phone. If none is available in this session, ledger it for the user.

- [ ] **Step 6: Commit**

```bash
git add src/screens/AddLabsScreen.tsx
git commit -m "Add a Lab Report: scan a paper report, upload a PDF of any length, or choose a photo; lines grouped by panel; unreadable pages named; the same file recognised"
```

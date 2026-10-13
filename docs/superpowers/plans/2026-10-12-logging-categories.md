# Logging by Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Log screen organises everything she can log into eight categories, one sentence can file into several of them, and every category's entry is actually saved.

**Architecture:** A pure category model (`lib/logCategories.ts`) and a pure reader plus save planner (`lib/quickLog.ts`) decide what a sentence and her tapped chips mean and where each part is stored. Storage reuses what exists: cycle and bowel entries are episodes, gut and check ins go to `daily_metrics` through a new `save_daily_log` RPC, and everything else is a journal entry with `metadata.category` and `metadata.items`. The screen only renders and calls the planner.

**Tech Stack:** Expo 57 / React Native, TypeScript, node:test via `tsx --test`, Supabase Postgres with pgTAP tests in `supabase/tests`.

**Spec:** `docs/superpowers/specs/2026-10-12-logging-categories-and-period-products-design.md` (section 1, Categories). Period products and safety are later plans.

## Global Constraints

- Keep Jost and the existing design; new UI reuses `ui/kit.tsx`, `ui/chrome.tsx`, `ui/bento.tsx` and the shared `ui/composer.tsx` box.
- UI copy has no em dash, en dash or hyphen, and passes through `displayCopy()` (`src/lib/displayCopy.ts`).
- Logged items are reported. Nothing is inferred from absence or from a device. Everything recognised is shown before saving.
- Existing saved data (episodes, daily logs, journal entries) must still load.
- Run all app commands from `ciatta-mobile-app/`. Unit tests: `npm test`. Typecheck: `npx tsc --noEmit`.

## Spec amendment carried by this plan

The spec stores Nutrition and gut in the daily log. Bowel movements cannot move there: `lib/bodyMap.ts`, `lib/cyclePatterns.ts` and `lib/cycleLens.ts` read them from episodes, and `daily_metrics` has no stool column. So stool is **logged** under Nutrition and gut and **stored** as a `Bowel movement` episode, as today. The cycle questionnaire stops offering Bowel movement, and the Daily Log screen drops its own stool picker, so there is one place to log it. Task 5 updates the spec text.

## Review Focus

1. A sentence that names nothing recognisable (e.g. "long day") under a non note category: she expects it saved as a journal entry in that category, not dropped. Pinned in Task 2.
2. A sentence that names several categories ("period started, bloated, foggy"): she expects each part saved where it belongs, and her words saved once, not three times. Pinned in Task 2.
3. Saving gut flags on a day that already has device data or earlier flags: she expects earlier flags kept and device columns untouched. Pinned in Task 4 (SQL test).
4. A file attached with no text: she expects it kept with an entry. Pinned in Task 2.
5. Signed in as someone else: the RPC must never write another person's day. Pinned in Task 4 (SQL test).

---

### Task 1: The category model

**Files:**
- Create: `ciatta-mobile-app/src/lib/logCategories.ts`
- Test: `ciatta-mobile-app/src/lib/logCategories.test.ts`

**Interfaces:**
- Consumes: `EntryKind` from `src/data/sample.ts` (`'Notes' | 'Symptoms' | 'Context'`); `DIGESTION_FLAGS` from `src/lib/dailyLog.ts`; `Screen` from `src/navigation.ts`.
- Produces:
  - `type CategoryKey = 'cycle' | 'nutrition' | 'body' | 'mind' | 'skin' | 'sexual' | 'context' | 'note'`
  - `type LogCategory = { key: CategoryKey; label: string; example: string; quick: readonly string[]; detail: Screen | null; detailLabel: string | null; journalKind: EntryKind }`
  - `const CATEGORIES: readonly LogCategory[]` (in display order)
  - `function category(key: CategoryKey): LogCategory`
  - `const BOWEL = 'Bowel movement'`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WHAT_HAPPENED } from '../data/cycleLog';
import { BOWEL, CATEGORIES, category } from './logCategories';

test('eight categories, in the order the Log screen shows them', () => {
  assert.deepEqual(
    CATEGORIES.map((c) => c.key),
    ['cycle', 'nutrition', 'body', 'mind', 'skin', 'sexual', 'context', 'note'],
  );
});

test('every category has a real example sentence', () => {
  for (const c of CATEGORIES) assert.ok(c.example.length > 15, c.key);
});

test('no label, example or chip carries a dash', () => {
  for (const c of CATEGORIES) {
    for (const s of [c.label, c.example, c.detailLabel ?? '', ...c.quick]) assert.ok(!/[-–—]/.test(s), s);
  }
});

test('a detailed form is named only where one exists', () => {
  assert.equal(category('cycle').detail, 'cycleLog');
  assert.equal(category('nutrition').detail, 'dailyLog');
  assert.equal(category('note').detail, 'journal');
  assert.equal(category('mind').detail, null);
  for (const c of CATEGORIES) assert.equal(c.detail === null, c.detailLabel === null, c.key);
});

test('stool is logged under Nutrition and gut, as the episode kind the record already reads', () => {
  assert.ok(category('nutrition').quick.includes(BOWEL));
  assert.ok((WHAT_HAPPENED as readonly string[]).includes(BOWEL));
});

test('journal kinds stay inside the table check constraint', () => {
  for (const c of CATEGORIES) assert.ok(['Notes', 'Symptoms', 'Context'].includes(c.journalKind), c.key);
});

test('no chip appears in two categories, so a tap has one meaning', () => {
  const seen = new Map<string, string>();
  for (const c of CATEGORIES) {
    for (const q of c.quick) {
      assert.ok(!seen.has(q), `${q} is in ${seen.get(q)} and ${c.key}`);
      seen.set(q, c.key);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/logCategories.test.ts`
Expected: FAIL, cannot find module `./logCategories`.

- [ ] **Step 3: Write the implementation**

```ts
// What she can log, by what it is about.
//
// Logging was split by screen: a Cycle questionnaire, a Daily Log, a
// journal, each with its own copy of some of the same things. These are
// the eight subjects instead, each with the chips worth one tap and the
// example sentence that teaches the rest. Where each one is stored is
// decided in lib/quickLog.ts, not here: this file only names things.

import type { EntryKind } from '../data/sample';
import type { Screen } from '../navigation';
import { DIGESTION_FLAGS } from './dailyLog';

export type CategoryKey = 'cycle' | 'nutrition' | 'body' | 'mind' | 'skin' | 'sexual' | 'context' | 'note';

export type LogCategory = {
  key: CategoryKey;
  label: string;
  // The placeholder: a real sentence, because an example teaches the
  // grammar at once and "describe your symptoms" teaches nothing.
  example: string;
  // One tap each. Multi select.
  quick: readonly string[];
  // The full form, for the entry worth more than a line, where one exists.
  detail: Screen | null;
  detailLabel: string | null;
  // The journal_entries.kind this category files under when it becomes a
  // journal entry. The table only allows these three.
  journalKind: EntryKind;
};

// The episode kind the body map, cycle patterns and cycle lens already
// read. Logged under Nutrition and gut, stored as an episode.
export const BOWEL = 'Bowel movement';

export const CATEGORIES: readonly LogCategory[] = [
  {
    key: 'cycle',
    label: 'Cycle',
    example: 'Period started yesterday, heavy, cramping since the morning',
    quick: ['Period', 'Spotting'],
    detail: 'cycleLog',
    detailLabel: 'Describe it step by step',
    journalKind: 'Symptoms',
  },
  {
    key: 'nutrition',
    label: 'Nutrition and gut',
    example: 'Porridge and two coffees, bloated after lunch',
    quick: [...DIGESTION_FLAGS, BOWEL],
    detail: 'dailyLog',
    detailLabel: 'Log food, drinks, and how your gut felt',
    journalKind: 'Context',
  },
  {
    key: 'body',
    label: 'Body',
    example: 'Sore lower back and hot flashes all evening',
    quick: ['Pain', 'Breast tenderness', 'Hot flashes', 'Night sweats', 'Fatigue', 'Chills', 'Swelling', 'Joint pain'],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'mind',
    label: 'Mind',
    example: 'Foggy all afternoon, could not focus, a bit anxious',
    quick: [
      'Brain fog', 'Memory lapses', 'Hard to focus', 'Headache', 'Migraine', 'Dizziness',
      'Tingling or numbness', 'Low mood', 'Anxiety', 'Irritability', 'Mood swings',
    ],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'skin',
    label: 'Skin and hair',
    example: 'Breakout on my chin, more hair in the brush than usual',
    quick: ['Acne', 'Oily skin', 'Dry skin', 'Hair shedding', 'Unwanted hair growth', 'Dark patches', 'Itching'],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'sexual',
    label: 'Sexual and urinary',
    example: 'Some pain with sex, and needing to pee more often',
    quick: [
      'Pain with sex', 'Low libido', 'Vaginal dryness', 'Discharge change', 'Urinary urgency', 'Leaking',
      'Burning when peeing', 'Bleeding after sex',
    ],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'context',
    label: 'Context',
    example: 'Slept badly, long flight, took ibuprofen at noon',
    quick: ['Slept badly', 'Slept well', 'Exercised', 'Stressful event', 'Travel', 'Took medication', 'Took supplement', 'Sex', 'Illness'],
    detail: null,
    detailLabel: null,
    journalKind: 'Context',
  },
  {
    key: 'note',
    label: 'Note',
    example: 'Anything at all, in your own words',
    quick: [],
    detail: 'journal',
    detailLabel: 'Open your notes',
    journalKind: 'Notes',
  },
];

export const category = (key: CategoryKey): LogCategory => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
```

Note: `DIGESTION_FLAGS` contains `'Cramping'` and Body has `'Pain'`, not `'Cramping'`, so the no-duplicate test holds. If it fails on a duplicate, remove the duplicate from the later category, never from `DIGESTION_FLAGS`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/logCategories.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/src/lib/logCategories.ts ciatta-mobile-app/src/lib/logCategories.test.ts
git commit -m "Name the eight things she can log"
```

---

### Task 2: Read a sentence by category, and plan where each part is saved

**Files:**
- Modify: `ciatta-mobile-app/src/lib/quickLog.ts` (replace `QUICK_TABS`/`quickTab`/`QuickTab`, narrow `KIND_CUES`, add readers and planner)
- Test: `ciatta-mobile-app/src/lib/quickLog.test.ts` (rewrite the tab tests, adjust the Symptoms test, add new ones)

**Interfaces:**
- Consumes: `CategoryKey`, `category`, `BOWEL` (Task 1); `readNote` (`src/lib/readNote.ts`); `Attachment` (`src/lib/attachments.ts`); `EntryKind`.
- Produces:
  - `type Found = Partial<Record<CategoryKey, string[]>>`
  - `function readCategories(text: string): Found`
  - `type QuickReading = { kinds: string[]; context: string[]; flow: string | null; daysAgo: number; found: Found }`
  - `function readQuick(text: string): QuickReading`
  - `function mergeFound(a: Found, b: Found): Found`
  - `function readingLine(found: Found, flow: string | null, daysAgo: number): string | null`
  - `type SavePlan = { episode: { kinds: string[]; flow: string | null; daysAgo: number; context: string[] } | null; daily: { digestion: string[] } | null; journal: { kind: EntryKind; category: CategoryKey; items: Found } | null; wordsGoTo: 'journal' | 'episode' | 'daily' }`
  - `function planSave(input: { text: string; selected: CategoryKey; tapped: string[]; files: Attachment[] }): SavePlan | null` (null when there is nothing to save)
  - Kept unchanged: `readKinds`, `readFlow`, `readDaysAgo`.

- [ ] **Step 1: Write the failing tests**

Replace the import line and the last test (`every tab has an example...`) in `quickLog.test.ts`, change the `'bloated and nauseous'` expectation, and append the new tests:

```ts
import { WHAT_HAPPENED } from '../data/cycleLog';
import { planSave, readCategories, readDaysAgo, readFlow, readingLine, readKinds, readQuick } from './quickLog';
```

In `reads the kinds her words name`, replace the line `assert.deepEqual(readKinds('bloated and nauseous'), ['Symptoms']);` with:

```ts
  // Symptoms are no longer an episode kind from a sentence: they are read
  // into their own categories instead.
  assert.deepEqual(readKinds('bloated and nauseous'), []);
```

In `every kind it can produce is one the record already uses`, delete the `'nausea headache bloating',` line.

Replace `the line shows back everything that would be stored`, `nothing recognised draws no line` and `every tab has an example and a way into the full screen` with:

```ts
test('one sentence is read into every category it names', () => {
  const f = readCategories('Period started, bloated after lunch, foggy all afternoon, breakout on my chin');
  assert.deepEqual(f.cycle, ['Period']);
  assert.deepEqual(f.nutrition, ['Bloating']);
  assert.deepEqual(f.mind, ['Brain fog']);
  assert.deepEqual(f.skin, ['Acne']);
});

test('the line groups what was recognised by category', () => {
  const r = readQuick('Period started yesterday, heavy, foggy');
  const line = readingLine(r.found, r.flow, r.daysAgo) as string;
  assert.equal(line, 'Cycle: Period, Heavy flow, yesterday · Mind: Brain fog');
});

test('nothing recognised draws no line', () => {
  const r = readQuick('A quiet one');
  assert.equal(readingLine(r.found, r.flow, r.daysAgo), null);
});

test('several categories save each part once, and her words once', () => {
  const plan = planSave({ text: 'Period started, bloated, foggy', selected: 'cycle', tapped: [], files: [] })!;
  assert.deepEqual(plan.episode?.kinds, ['Period']);
  assert.deepEqual(plan.daily?.digestion, ['Bloating']);
  assert.deepEqual(plan.journal?.items.mind, ['Brain fog']);
  // Words go to the journal entry, the one place that holds them all.
  assert.equal(plan.wordsGoTo, 'journal');
});

test('unrecognised words under a category are kept, in that category', () => {
  const plan = planSave({ text: 'long day', selected: 'mind', tapped: [], files: [] })!;
  assert.equal(plan.episode, null);
  assert.equal(plan.daily, null);
  assert.equal(plan.journal?.category, 'mind');
  assert.equal(plan.journal?.kind, 'Symptoms');
  assert.equal(plan.wordsGoTo, 'journal');
});

test('unrecognised words under Cycle stay a cycle entry, as before', () => {
  const plan = planSave({ text: 'felt off today', selected: 'cycle', tapped: [], files: [] })!;
  assert.ok(plan.episode);
  assert.equal(plan.journal, null);
  assert.equal(plan.wordsGoTo, 'episode');
});

test('tapped chips count as hers, in the category she tapped them in', () => {
  const plan = planSave({ text: '', selected: 'skin', tapped: ['Acne'], files: [] })!;
  assert.deepEqual(plan.journal?.items.skin, ['Acne']);
});

test('a bowel movement is saved as the episode kind the record reads', () => {
  const plan = planSave({ text: '', selected: 'nutrition', tapped: ['Bowel movement', 'Gas'], files: [] })!;
  assert.deepEqual(plan.episode?.kinds, ['Bowel movement']);
  assert.deepEqual(plan.daily?.digestion, ['Gas']);
});

test('pain is an episode, so the body map still sees it', () => {
  const plan = planSave({ text: 'sharp pain in my lower back', selected: 'body', tapped: [], files: [] })!;
  assert.deepEqual(plan.episode?.kinds, ['Pain']);
});

test('a file on its own is kept with an entry', () => {
  const file = { id: 'f', kind: 'document' as const, name: 'labs.pdf', uri: 'file:///labs.pdf', addedAt: '2026-10-12T09:00:00Z' };
  const plan = planSave({ text: '', selected: 'note', tapped: [], files: [file] })!;
  assert.equal(plan.wordsGoTo, 'journal');
});

test('nothing at all plans nothing', () => {
  assert.equal(planSave({ text: '  ', selected: 'mind', tapped: [], files: [] }), null);
});

test('every item it reads is a chip of the category it lands in', async () => {
  const { category } = await import('./logCategories');
  const f = readCategories(
    'period spotting pain bloated reflux gas constipated diarrhea pooped nauseous headache migraine foggy forgetful ' +
      'dizzy anxious irritable acne oily hair shedding dry skin itchy pain with sex dryness urgency leaking slept badly ' +
      'flight ibuprofen vitamin hot flashes night sweats tired',
  );
  for (const [key, items] of Object.entries(f)) {
    for (const item of items ?? []) assert.ok(category(key as never).quick.includes(item), `${item} not a ${key} chip`);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/quickLog.test.ts`
Expected: FAIL, `planSave` / `readCategories` not exported.

- [ ] **Step 3: Write the implementation**

In `quickLog.ts`:

1. Delete `QuickTab`, `QUICK_TABS` and `quickTab` and their comments.
2. In `KIND_CUES`, delete the `'Symptoms'` row (the line starting `[/\b(nausea|nauseous|headache`).
3. Replace `QuickReading`, `readQuick` and `readingLine` with the code below, and add the imports at the top:

```ts
import type { EntryKind } from '../data/sample';
import type { Attachment } from './attachments';
import { BOWEL, category, type CategoryKey } from './logCategories';
```

```ts
// What a sentence names, by category. Each cue maps a word she wrote to a
// chip that already exists in that category, so a sentence and a tap make
// the same entry. Order inside a category is the chip order.
export type Found = Partial<Record<CategoryKey, string[]>>;

const CUES: [RegExp, CategoryKey, string][] = [
  [/\b(period|menstruat\w*|bleeding|bled)\b/i, 'cycle', 'Period'],
  [/\bspott?ing\b/i, 'cycle', 'Spotting'],
  [/\bbloat\w*/i, 'nutrition', 'Bloating'],
  [/\bcramp\w*/i, 'nutrition', 'Cramping'],
  [/\b(nausea|nauseous|queasy)\b/i, 'nutrition', 'Nausea'],
  [/\b(reflux|heartburn)\b/i, 'nutrition', 'Reflux'],
  [/\b(gas|gassy|wind)\b/i, 'nutrition', 'Gas'],
  [/\bconstipat\w*/i, 'nutrition', 'Constipation'],
  [/\b(loose|diarrh\w*|runny)\b/i, 'nutrition', 'Loose'],
  [/\b(stool|poop|pooped|bowel)\b/i, 'nutrition', BOWEL],
  [/\b(pain|painful|ache|aching|aches|sore|hurts?|hurting)\b/i, 'body', 'Pain'],
  [/\b(tender breasts?|breast tenderness|sore breasts?)\b/i, 'body', 'Breast tenderness'],
  [/\bhot flash(es)?\b/i, 'body', 'Hot flashes'],
  [/\bnight sweats?\b/i, 'body', 'Night sweats'],
  [/\b(fatigue|fatigued|exhausted|tired)\b/i, 'body', 'Fatigue'],
  [/\bchills?\b/i, 'body', 'Chills'],
  [/\b(swollen|swelling|puffy)\b/i, 'body', 'Swelling'],
  [/\bjoint pain\b/i, 'body', 'Joint pain'],
  [/\b(fog|foggy|brain fog)\b/i, 'mind', 'Brain fog'],
  [/\b(forgetful|forgot|memory)\b/i, 'mind', 'Memory lapses'],
  [/\b(focus|concentrat\w*)\b/i, 'mind', 'Hard to focus'],
  [/\bheadache\b/i, 'mind', 'Headache'],
  [/\bmigraine\b/i, 'mind', 'Migraine'],
  [/\b(dizzy|dizziness|lightheaded)\b/i, 'mind', 'Dizziness'],
  [/\b(tingl\w*|numb\w*|pins and needles)\b/i, 'mind', 'Tingling or numbness'],
  [/\b(low mood|sad|down|teary)\b/i, 'mind', 'Low mood'],
  [/\b(anxious|anxiety|panick?y)\b/i, 'mind', 'Anxiety'],
  [/\b(irritable|irritated|snappy)\b/i, 'mind', 'Irritability'],
  [/\bmood swings?\b/i, 'mind', 'Mood swings'],
  [/\b(acne|breakout|broke out|spots|pimples?)\b/i, 'skin', 'Acne'],
  [/\boily\b/i, 'skin', 'Oily skin'],
  [/\bdry skin\b/i, 'skin', 'Dry skin'],
  [/\b(hair (shedding|loss|falling)|more hair in)\b/i, 'skin', 'Hair shedding'],
  [/\b(chin hair|facial hair|unwanted hair)\b/i, 'skin', 'Unwanted hair growth'],
  [/\b(dark patch\w*|pigment\w*)\b/i, 'skin', 'Dark patches'],
  [/\b(itch\w*)\b/i, 'skin', 'Itching'],
  [/\bpain with sex\b|\bpainful sex\b/i, 'sexual', 'Pain with sex'],
  [/\b(low libido|no sex drive|low sex drive)\b/i, 'sexual', 'Low libido'],
  [/\b(vaginal dryness|dryness down there)\b/i, 'sexual', 'Vaginal dryness'],
  [/\bdischarge\b/i, 'sexual', 'Discharge change'],
  [/\b(urgency|pee more|peeing more|need to pee)\b/i, 'sexual', 'Urinary urgency'],
  [/\b(leak|leaking|leaked)\b/i, 'sexual', 'Leaking'],
  [/\bburn\w* when (i )?pee\w*/i, 'sexual', 'Burning when peeing'],
  [/\bbleeding after sex\b/i, 'sexual', 'Bleeding after sex'],
  [/\b(slept badly|bad sleep|poor sleep|could not sleep|couldn.t sleep)\b/i, 'context', 'Slept badly'],
  [/\b(slept well|good sleep)\b/i, 'context', 'Slept well'],
  [/\b(exercised|workout|ran|run|gym|yoga|walked)\b/i, 'context', 'Exercised'],
  [/\b(stressful|stressed)\b/i, 'context', 'Stressful event'],
  [/\b(flight|flew|travel\w*|trip)\b/i, 'context', 'Travel'],
  [/\b(ibuprofen|paracetamol|tylenol|advil|medication|meds|pill)\b/i, 'context', 'Took medication'],
  [/\b(supplement|vitamin|magnesium|iron)\b/i, 'context', 'Took supplement'],
  [/\b(sick|ill|a cold|flu|fever)\b/i, 'context', 'Illness'],
];

export function readCategories(text: string): Found {
  const found: Found = {};
  if (!text.trim()) return found;
  for (const [cue, key, item] of CUES) {
    if (!cue.test(text)) continue;
    const list = (found[key] ??= []);
    if (!list.includes(item)) list.push(item);
  }
  // "Pain with sex" is sexual health, not general pain, when that is all
  // the pain she named.
  if (found.sexual?.includes('Pain with sex') && found.body?.includes('Pain') && !/\bpain\b(?! with sex)/i.test(text.replace(/pain with sex/gi, ''))) {
    found.body = found.body.filter((x) => x !== 'Pain');
    if (!found.body.length) delete found.body;
  }
  return found;
}

export function mergeFound(a: Found, b: Found): Found {
  const out: Found = {};
  for (const src of [a, b]) {
    for (const [key, items] of Object.entries(src) as [CategoryKey, string[]][]) {
      const list = (out[key] ??= []);
      for (const item of items) if (!list.includes(item)) list.push(item);
    }
  }
  return out;
}

export type QuickReading = { kinds: string[]; context: string[]; flow: string | null; daysAgo: number; found: Found };

export function readQuick(text: string): QuickReading {
  return {
    kinds: readKinds(text),
    context: readNote(text),
    flow: readFlow(text),
    daysAgo: readDaysAgo(text),
    found: readCategories(text),
  };
}

const ORDER: CategoryKey[] = ['cycle', 'nutrition', 'body', 'mind', 'skin', 'sexual', 'context'];

// What was recognised, grouped as it will be filed. Null when nothing was,
// so no empty label is drawn; the words still save.
export function readingLine(found: Found, flow: string | null, daysAgo: number): string | null {
  const groups: string[] = [];
  for (const key of ORDER) {
    const items = [...(found[key] ?? [])];
    if (key === 'cycle') {
      if (flow) items.push(`${flow} flow`);
      if (items.length && daysAgo === 1) items.push('yesterday');
      else if (items.length && daysAgo > 1) items.push(`${daysAgo} days ago`);
    }
    if (items.length) groups.push(`${category(key).label}: ${items.join(', ')}`);
  }
  return groups.length ? groups.join(' · ') : null;
}

// Where each part of one log goes. Storage is what already exists:
//
//   Cycle items, Pain and Bowel movement are episodes, because the body
//   map, cycle patterns and the cycle lens read them there.
//   Gut flags are the day's digestion list in daily_metrics, which the
//   engine's food and bloating check already reads.
//   Everything else is one journal entry carrying its category and items.
//
// Her words and files are saved once: on the journal entry when there is
// one, else on the episode, else on the day.
export type SavePlan = {
  episode: { kinds: string[]; flow: string | null; daysAgo: number; context: string[] } | null;
  daily: { digestion: string[] } | null;
  journal: { kind: EntryKind; category: CategoryKey; items: Found } | null;
  wordsGoTo: 'journal' | 'episode' | 'daily';
};

const JOURNAL_KEYS: CategoryKey[] = ['body', 'mind', 'skin', 'sexual', 'context'];

export function planSave(input: { text: string; selected: CategoryKey; tapped: string[]; files: Attachment[] }): SavePlan | null {
  const text = input.text.trim();
  const found = mergeFound(readCategories(text), input.tapped.length ? { [input.selected]: input.tapped } : {});
  if (!text && !input.files.length && !Object.keys(found).length) return null;

  const kinds = [
    ...(found.cycle ?? []),
    ...(found.body?.includes('Pain') ? ['Pain'] : []),
    ...(found.nutrition?.includes(BOWEL) ? [BOWEL] : []),
  ];
  const digestion = (found.nutrition ?? []).filter((x) => x !== BOWEL);

  const items: Found = {};
  for (const key of JOURNAL_KEYS) {
    const list = (found[key] ?? []).filter((x) => !(key === 'body' && x === 'Pain'));
    if (list.length) items[key] = list;
  }
  const hasWords = !!text || input.files.length > 0;
  const wantsJournal =
    Object.keys(items).length > 0 ||
    input.selected === 'note' ||
    (hasWords && !kinds.length && !digestion.length && input.selected !== 'cycle');
  const wantsEpisode = kinds.length > 0 || (hasWords && input.selected === 'cycle' && !wantsJournal);

  const journalCategory: CategoryKey =
    (JOURNAL_KEYS as CategoryKey[]).includes(input.selected) || input.selected === 'note'
      ? input.selected
      : ((Object.keys(items)[0] as CategoryKey | undefined) ?? input.selected);

  return {
    episode: wantsEpisode
      ? { kinds, flow: readFlow(text), daysAgo: readDaysAgo(text), context: readNote(text) }
      : null,
    daily: digestion.length ? { digestion } : null,
    journal: wantsJournal ? { kind: category(journalCategory).journalKind, category: journalCategory, items } : null,
    wordsGoTo: wantsJournal ? 'journal' : wantsEpisode ? 'episode' : 'daily',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/lib/quickLog.test.ts`
Expected: PASS. If `every item it reads is a chip...` fails, fix the cue's item string to match the chip exactly; never add a chip to make a cue pass.

- [ ] **Step 5: Run the typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `src/screens/QuickLogScreen.tsx` (it still imports `QUICK_TABS`); Task 6 replaces that file's logic. If the errors block committing, leave them; do not edit the screen in this task.

- [ ] **Step 6: Commit**

```bash
git add ciatta-mobile-app/src/lib/quickLog.ts ciatta-mobile-app/src/lib/quickLog.test.ts
git commit -m "Read a sentence into every category it names, and plan where each part is kept"
```

---

### Task 3: Journal entries carry their category and items

**Files:**
- Modify: `ciatta-mobile-app/src/data/repo.ts` (the `addJournal` signature at the `Repo` type, the demo implementation, the real implementation)
- Modify: `ciatta-mobile-app/src/data/rows.ts` (`JournalRow.metadata`, `JournalView` item, `journalView`)
- Test: `ciatta-mobile-app/src/data/rows.test.ts`

**Interfaces:**
- Consumes: `CategoryKey` (Task 1), `Found` (Task 2).
- Produces:
  - `addJournal(text: string, kind: EntryKind, attachments?: Attachment[], tags?: { category: CategoryKey; items: Found }): Promise<void>`
  - Journal view items gain `category?: CategoryKey` and `items?: Found`.

- [ ] **Step 1: Write the failing test** (append to `rows.test.ts`)

```ts
test('a journal entry keeps the category and chips it was logged with', () => {
  const view = journalView([
    {
      client_id: 'j1', text: 'Foggy', kind: 'Symptoms', tag: null, occurred_at: '2026-10-12T09:00:00Z',
      metadata: { category: 'mind', items: { mind: ['Brain fog'] } },
    },
  ]);
  const item = view.months[0].items[0];
  assert.equal(item.category, 'mind');
  assert.deepEqual(item.items, { mind: ['Brain fog'] });
});

test('an old entry with no category reads as none, not as a guess', () => {
  const view = journalView([{ client_id: 'j1', text: 'x', kind: 'Notes', tag: null, occurred_at: '2026-10-12T09:00:00Z' }]);
  assert.equal(view.months[0].items[0].category, undefined);
});
```

Also update the existing `notes group by month, newest first` expectation object to include `category: undefined, items: undefined` after `attachments: []`.

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test src/data/rows.test.ts`
Expected: FAIL on `item.category`.

- [ ] **Step 3: Implement**

In `rows.ts`:

```ts
import type { CategoryKey } from '../lib/logCategories';
import type { Found } from '../lib/quickLog';
```

Change `JournalRow.metadata` to `metadata?: { attachments?: unknown; category?: unknown; items?: unknown } | null;`, add `category?: CategoryKey; items?: Found` to the `JournalView` item type, and in `journalView` push:

```ts
    group.items.push({
      text: r.text,
      date: shortDate(d),
      tag: r.tag ?? r.kind,
      kind: r.kind,
      usedInInsight: false,
      attachments: normalizeAttachments(r.metadata?.attachments),
      category: typeof r.metadata?.category === 'string' ? (r.metadata.category as CategoryKey) : undefined,
      items: r.metadata?.items && typeof r.metadata.items === 'object' ? (r.metadata.items as Found) : undefined,
    });
```

In `repo.ts`, change the `Repo` type line to:

```ts
  addJournal(text: string, kind: EntryKind, attachments?: Attachment[], tags?: { category: CategoryKey; items: Found }): Promise<void>;
```

Demo implementation: `addJournal: async (text, kind, attachments = [], tags) => {` and add `category: tags?.category, items: tags?.items` to `item`.

Real implementation: `async addJournal(text, kind, attachments = [], tags) {` and build metadata as:

```ts
          metadata: {
            ...(attachments.length ? { attachments } : {}),
            ...(tags ? { category: tags.category, items: tags.items } : {}),
          },
```

Add the two type imports to `repo.ts`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx tsx --test src/data/rows.test.ts && npx tsc --noEmit`
Expected: rows tests PASS; typecheck errors only in `QuickLogScreen.tsx` (from Task 2).

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/src/data/rows.ts ciatta-mobile-app/src/data/rows.test.ts ciatta-mobile-app/src/data/repo.ts
git commit -m "Keep the category and chips a journal entry was logged with"
```

---

### Task 4: The day she logs is actually saved

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261012120000_save_daily_log.sql`
- Create: `ciatta-mobile-app/supabase/tests/save_daily_log.test.sql`
- Modify: `ciatta-mobile-app/src/lib/dailyLog.ts` (add `DailyPatch`, `dailyLogPatch`)
- Test: `ciatta-mobile-app/src/lib/dailyLog.test.ts`
- Modify: `ciatta-mobile-app/src/data/repo.ts` (add `saveDailyLog`)
- Modify: `ciatta-mobile-app/src/screens/DailyLogScreen.tsx` (save on the button; remove the stool picker)

**Interfaces:**
- Produces:
  - `type DailyPatch = { day: string; digestion?: string[]; foods?: string[]; caffeine?: number; alcohol?: number; energy?: number; mood?: number; stress?: number; note?: string; attachments?: Attachment[] }`
  - `function dailyLogPatch(log: DailyLog): DailyPatch` (only fields she filled in)
  - Repo: `saveDailyLog(patch: DailyPatch): Promise<void>`
  - RPC: `public.save_daily_log(p_day date, p_digestion text[], p_foods text[], p_caffeine numeric, p_alcohol numeric, p_energy smallint, p_mood smallint, p_stress smallint, p_note text, p_attachments jsonb) returns void`

- [ ] **Step 1: Write the failing unit test** (append to `dailyLog.test.ts`)

```ts
import { dailyLogPatch } from './dailyLog';

test('the patch carries only what she filled in, so a save never blanks a column', () => {
  const log = { ...emptyLog('2026-10-12'), digestion: ['Bloating'], caffeine: 2, note: '  ' };
  assert.deepEqual(dailyLogPatch(log), { day: '2026-10-12', digestion: ['Bloating'], caffeine: 2 });
});

test('a full day maps every field she owns', () => {
  const log = {
    ...emptyLog('2026-10-12'),
    foods: [{ id: 'a', name: 'Porridge', kcal: null, kcalFrom: null }],
    digestion: ['Gas'], caffeine: 1, alcohol: 0, energy: 3, mood: 4, stress: 2, note: 'Fine',
  };
  const p = dailyLogPatch(log as never);
  assert.deepEqual(p.foods, ['Porridge']);
  assert.equal(p.alcohol, 0, 'a logged zero is a fact, unlike a missing figure');
  assert.equal(p.note, 'Fine');
});
```

Check the `FoodEntry` shape in `dailyLog.ts` before running; adjust the literal's field names to match it exactly.

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test src/lib/dailyLog.test.ts`
Expected: FAIL, `dailyLogPatch` not exported.

- [ ] **Step 3: Implement `dailyLogPatch`** (append to `dailyLog.ts`)

```ts
// What a save sends: only the fields she filled in. The RPC leaves every
// field it is not given as it was, so a quick "bloated" never blanks the
// foods she logged this morning, and a device's columns are never touched.
export type DailyPatch = {
  day: string;
  digestion?: string[];
  foods?: string[];
  caffeine?: number;
  alcohol?: number;
  energy?: number;
  mood?: number;
  stress?: number;
  note?: string;
  attachments?: Attachment[];
};

export function dailyLogPatch(log: DailyLog): DailyPatch {
  const p: DailyPatch = { day: log.date };
  if (log.digestion.length) p.digestion = [...log.digestion];
  if (log.foods.length) p.foods = log.foods.map((f) => f.name);
  for (const k of ['caffeine', 'alcohol', 'energy', 'mood', 'stress'] as const) {
    const v = log[k];
    if (v != null) p[k] = v;
  }
  if (log.note.trim()) p.note = log.note.trim();
  if (log.attachments.length) p.attachments = [...log.attachments];
  return p;
}
```

- [ ] **Step 4: Run unit tests**

Run: `npx tsx --test src/lib/dailyLog.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the migration**

```sql
-- She logs her day, and it is kept.
--
-- daily_metrics is read only to the client (20260916100100): device sync
-- owns the measured columns and must never be overwritten from the phone.
-- That file promised the self reported columns would come back through an
-- explicit path rather than by reopening the table. This is that path: one
-- function that writes only her columns, only her row, and only what she
-- sent. Null means "not sent", so it leaves the column as it was.
-- Lists merge rather than replace, so a quick "bloated" does not erase
-- this morning's foods. A note is appended. Files are appended to
-- metadata.attachments.
create function public.save_daily_log(
  p_day date,
  p_digestion text[] default null,
  p_foods text[] default null,
  p_caffeine numeric default null,
  p_alcohol numeric default null,
  p_energy smallint default null,
  p_mood smallint default null,
  p_stress smallint default null,
  p_note text default null,
  p_attachments jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.daily_metrics (user_id, day, provenance)
  values (me, p_day, 'REPORTED')
  on conflict (user_id, day) do nothing;

  update public.daily_metrics d set
    digestion = case when p_digestion is null then d.digestion
                     else array(select distinct unnest(coalesce(d.digestion, '{}') || p_digestion)) end,
    foods = case when p_foods is null then d.foods else coalesce(d.foods, '{}') || p_foods end,
    caffeine = coalesce(p_caffeine, d.caffeine),
    alcohol = coalesce(p_alcohol, d.alcohol),
    energy = coalesce(p_energy, d.energy),
    mood = coalesce(p_mood, d.mood),
    stress = coalesce(p_stress, d.stress),
    note = case when p_note is null then d.note
                when d.note is null or d.note = '' then p_note
                else d.note || E'\n' || p_note end,
    metadata = case when p_attachments is null then d.metadata
                    else jsonb_set(d.metadata, '{attachments}', coalesce(d.metadata -> 'attachments', '[]'::jsonb) || p_attachments) end,
    updated_at = now()
  where d.user_id = me and d.day = p_day;
end $$;

revoke execute on function public.save_daily_log(date, text[], text[], numeric, numeric, smallint, smallint, smallint, text, jsonb) from public, anon;
grant execute on function public.save_daily_log(date, text[], text[], numeric, numeric, smallint, smallint, smallint, text, jsonb) to authenticated;
```

- [ ] **Step 6: Write the SQL test**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- A day the device already wrote, as the ingest function would.
insert into public.daily_metrics (user_id, day, steps, sleep_hours)
values ('00000000-0000-0000-0000-00000000000a', '2026-10-12', 8000, 7.5);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$ select public.save_daily_log('2026-10-12', p_digestion => array['Bloating'], p_caffeine => 2) $$,
  'she can save her day');
select is((select steps from public.daily_metrics where day = '2026-10-12'), 8000, 'device columns are untouched');
select is((select digestion from public.daily_metrics where day = '2026-10-12'), array['Bloating'], 'her flags are kept');

select public.save_daily_log('2026-10-12', p_digestion => array['Gas', 'Bloating']);
select is((select array_length(digestion, 1) from public.daily_metrics where day = '2026-10-12'), 2,
  'a second save merges flags without repeating one');
select is((select caffeine from public.daily_metrics where day = '2026-10-12'), 2::numeric,
  'a field not sent is left as it was');

select public.save_daily_log('2026-10-12', p_note => 'first');
select public.save_daily_log('2026-10-12', p_note => 'second');
select is((select note from public.daily_metrics where day = '2026-10-12'), E'first\nsecond', 'notes append');

select lives_ok($$ select public.save_daily_log('2026-10-13', p_mood => 4::smallint) $$, 'a day with no device row is created');
select is((select provenance::text from public.daily_metrics where day = '2026-10-13'), 'REPORTED', 'and is marked as hers');

-- B cannot reach A's day: the function writes only the caller's row.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select public.save_daily_log('2026-10-12', p_caffeine => 9);
reset role;
select is((select caffeine from public.daily_metrics
           where user_id = '00000000-0000-0000-0000-00000000000a' and day = '2026-10-12'), 2::numeric,
  'another person saving the same date never writes her row');

select * from finish();
rollback;
```

- [ ] **Step 7: Run the SQL test**

Run: `npx supabase db reset && npx supabase test db` (from `ciatta-mobile-app/`, with the local Supabase stack running via `npx supabase start`).
Expected: `save_daily_log.test.sql .. ok` and every other test file still ok. If the local stack is not available, record that in the task report and continue; do not skip writing the test.

- [ ] **Step 8: Add `saveDailyLog` to the repo**

In the `Repo` type: `saveDailyLog(patch: DailyPatch): Promise<void>;`

Demo implementation: `saveDailyLog: async () => {},` with the comment `// The example person's record is fixed; a demo save changes nothing she can be misled by.`

Real implementation:

```ts
    async saveDailyLog(patch) {
      must(
        await db.rpc('save_daily_log', {
          p_day: patch.day,
          p_digestion: patch.digestion ?? null,
          p_foods: patch.foods ?? null,
          p_caffeine: patch.caffeine ?? null,
          p_alcohol: patch.alcohol ?? null,
          p_energy: patch.energy ?? null,
          p_mood: patch.mood ?? null,
          p_stress: patch.stress ?? null,
          p_note: patch.note ?? null,
          p_attachments: patch.attachments ?? null,
        }),
      );
    },
```

Import `DailyPatch` from `../lib/dailyLog`.

- [ ] **Step 9: Save from the Daily Log screen, and drop its stool picker**

In `DailyLogScreen.tsx`:
- Add `const repo = useRepo();` (import `useRepo` from `../state/session`), `const [saving, setSaving] = useState(false);` and `const [error, setError] = useState<string | null>(null);`.
- Replace `<PrimaryButton label="Save today" onPress={() => nav.back()} disabled={!hasAnything(log)} />` with:

```tsx
          <PrimaryButton
            label={saving ? 'Saving' : 'Save today'}
            disabled={!hasAnything(log) || saving}
            onPress={async () => {
              setSaving(true);
              setError(null);
              try {
                await repo.saveDailyLog(dailyLogPatch(log));
                nav.back();
              } catch (e) {
                setError(userFacingError(e, 'That did not save. Try again.'));
              } finally {
                setSaving(false);
              }
            }}
          />
          {error ? <Text style={[font('footnote'), { color: L.ink, marginTop: 10 }]}>{displayCopy(error)}</Text> : null}
```

- Delete the stool section (the block that maps `STOOL_TYPES` and calls `set('stool', ...)`, including its heading) and the `STOOL_TYPES` import. Add a one line comment where it was: `{/* Stool is logged once, under Nutrition and gut on the Log screen, as the bowel movement entry the body map reads. */}`
- Import `dailyLogPatch` and `userFacingError` (`../lib/userFacingError`).

- [ ] **Step 10: Run all checks**

Run: `npm test && npx tsc --noEmit`
Expected: tests PASS; typecheck errors only in `QuickLogScreen.tsx`.

- [ ] **Step 11: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20261012120000_save_daily_log.sql ciatta-mobile-app/supabase/tests/save_daily_log.test.sql ciatta-mobile-app/src/lib/dailyLog.ts ciatta-mobile-app/src/lib/dailyLog.test.ts ciatta-mobile-app/src/data/repo.ts ciatta-mobile-app/src/screens/DailyLogScreen.tsx
git commit -m "Keep the day she logs, through the one path that writes only her columns"
```

---

### Task 5: Bowel movements are logged in one place

**Files:**
- Modify: `ciatta-mobile-app/src/lib/cycleLens.ts` (`kindsFor`)
- Test: `ciatta-mobile-app/src/lib/cycleLens.test.ts:34`
- Modify: `docs/superpowers/specs/2026-10-12-logging-categories-and-period-products-design.md` (section 1, Data)

- [ ] **Step 1: Change the test**

Replace `assert.ok(l.kinds.includes('Bowel movement'));` at `cycleLens.test.ts:34` with:

```ts
  // Logged under Nutrition and gut on the Log screen now, so the cycle
  // questionnaire no longer offers a second way in. Old episodes keep it.
  assert.ok(!l.kinds.includes('Bowel movement'));
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test src/lib/cycleLens.test.ts`
Expected: FAIL at that assertion.

- [ ] **Step 3: Implement**

In `kindsFor`, change the loop head to skip it:

```ts
  for (const k of WHAT_HAPPENED) {
    // Logged under Nutrition and gut instead; still a kind an old episode
    // can carry, which is why WHAT_HAPPENED keeps it.
    if (k === 'Bowel movement') continue;
    out.push(k);
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS. If another test asserted Bowel movement in `lens.kinds`, update it the same way and say so in the commit message.

- [ ] **Step 5: Amend the spec**

In the spec's section 1 `### Data` list, replace the `nutrition` bullet and the sentence after it with:

```markdown
- `nutrition`: gut flags, foods, caffeine and alcohol go to `daily_metrics`
  through the `save_daily_log` RPC. Stool is logged here but stored as a
  `Bowel movement` episode, because the body map, cycle patterns and cycle
  lens read it from episodes and `daily_metrics` has no stool column. The
  cycle questionnaire and the Daily Log screen stop offering their own copy.
```

- [ ] **Step 6: Commit**

```bash
git add ciatta-mobile-app/src/lib/cycleLens.ts ciatta-mobile-app/src/lib/cycleLens.test.ts docs/superpowers/specs/2026-10-12-logging-categories-and-period-products-design.md
git commit -m "Log a bowel movement in one place"
```

---

### Task 6: The Log screen, by category

**Files:**
- Modify: `ciatta-mobile-app/src/screens/QuickLogScreen.tsx` (rewrite body; keep the file's header comment, updated)

**Interfaces:**
- Consumes: `CATEGORIES`, `category`, `CategoryKey` (Task 1); `planSave`, `readQuick`, `readingLine` (Task 2); `repo.addJournal(text, kind, files, tags)` (Task 3); `repo.saveDailyLog(patch)` (Task 4); `useCycle().add`, `formToEpisode`, `emptyForm` (existing).

- [ ] **Step 1: Rewrite the screen**

Replace everything below the imports with:

```tsx
export function QuickLogScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { add } = useCycle();
  const [key, setKey] = useState<CategoryKey>('cycle');
  const [tapped, setTapped] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [spoken, setSpoken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cat = category(key);
  const reading = useMemo(() => readQuick(text), [text]);
  const recognised = readingLine(
    tapped.length ? mergeFound(reading.found, { [key]: tapped }) : reading.found,
    reading.flow,
    reading.daysAgo,
  );

  // Switching category clears the chips, which belong to the category they
  // were tapped in. Her words stay: she may have chosen the category after
  // writing the sentence.
  const choose = (next: CategoryKey) => {
    setKey(next);
    setTapped([]);
  };
  const toggle = (item: string) =>
    setTapped((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));

  const send = async () => {
    if (saving) return;
    const plan = planSave({ text, selected: key, tapped, files });
    if (!plan) return;
    const said = text.trim();
    setSaving(true);
    setError(null);
    try {
      const day = new Date();
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      if (plan.episode) {
        add(
          formToEpisode(
            {
              ...emptyForm(),
              kinds: plan.episode.kinds,
              flow: plan.episode.flow,
              day: plan.episode.daysAgo,
              periodStart: plan.episode.daysAgo,
              context: plan.episode.context,
              note: plan.wordsGoTo === 'episode' ? said : '',
              attachments: plan.wordsGoTo === 'episode' ? files : [],
            },
            false,
          ),
        );
      }
      if (plan.daily) {
        await repo.saveDailyLog({
          day: iso,
          digestion: plan.daily.digestion,
          ...(plan.wordsGoTo === 'daily' && said ? { note: said } : {}),
          ...(plan.wordsGoTo === 'daily' && files.length ? { attachments: files } : {}),
        });
      }
      if (plan.journal) {
        await repo.addJournal(said, plan.journal.kind, files, { category: plan.journal.category, items: plan.journal.items });
      }
      nav.back();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen title="Log" onBack={nav.back}>
      {/* Eight subjects, one row, scrolled sideways: the label is the choice. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={q.cats}>
        {CATEGORIES.map((c) => {
          const on = c.key === key;
          return (
            <Pressable
              key={c.key}
              onPress={() => choose(c.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [q.cat, on && q.catOn, pressed && q.pressed]}
            >
              <Text style={[font('subhead', on ? 'semibold' : 'regular'), on ? q.catTextOn : q.catText]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={q.pad}>
        {cat.quick.length ? (
          <View style={q.chips}>
            {cat.quick.map((item) => {
              const on = tapped.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggle(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [q.chip, on && q.chipOn, pressed && q.pressed]}
                >
                  <Text style={[font('footnote', on ? 'semibold' : 'regular'), on ? q.chipTextOn : q.chipText]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={[font('caption1'), q.hint]}>Or type it or say it, in a sentence. For example:</Text>
        <Text style={[font('subhead'), q.example]}>{displayCopy(cat.example)}</Text>

        <Composer
          value={text}
          onChange={(v, how) => {
            setText(v);
            if (how === 'spoken') setSpoken(true);
          }}
          placeholder={cat.example}
          label={`Log ${cat.label.toLowerCase()} in your own words`}
          attachments={files}
          onAttachments={setFiles}
          onSend={send}
        />

        {recognised ? (
          <Text style={[font('footnote'), q.noted]}>
            Will be saved as: {displayCopy(recognised)}
            {spoken ? ', spoken' : ''}
          </Text>
        ) : text.trim() ? (
          <Text style={[font('footnote'), q.noted]}>Saved in your own words, under {cat.label}.</Text>
        ) : null}

        {error ? <Text style={[font('footnote'), q.error]}>{displayCopy(error)}</Text> : null}

        {cat.detail && cat.detailLabel ? (
          <Pressable
            onPress={() => nav.push(cat.detail as Screen)}
            accessibilityRole="button"
            accessibilityLabel={cat.detailLabel}
            style={({ pressed }) => [q.detail, pressed && q.pressed]}
          >
            <Text style={[font('subhead'), q.detailText]}>{displayCopy(cat.detailLabel)}</Text>
          </Pressable>
        ) : null}
      </View>
    </DetailScreen>
  );
}

const q = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER },
  cats: { gap: 8, paddingHorizontal: GUTTER, paddingVertical: 4 },
  cat: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    backgroundColor: L.recessed,
  },
  catOn: { backgroundColor: L.ink, borderColor: L.ink },
  catText: { color: L.body },
  catTextOn: { color: L.canvas },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACE.near },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  chipOn: { backgroundColor: L.statement, borderColor: L.ink },
  chipText: { color: L.body },
  chipTextOn: { color: L.ink },
  hint: { color: L.meta, marginTop: SPACE.block },
  example: { color: L.body, marginTop: 4, marginBottom: 12, lineHeight: 22 },
  noted: { color: L.meta, marginTop: 10, lineHeight: 18 },
  error: { color: L.ink, marginTop: 10 },
  detail: { marginTop: SPACE.block, paddingVertical: 14, alignItems: 'center' },
  detailText: { color: L.body },
  pressed: { opacity: 0.55 },
});
```

Set the imports to:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { emptyForm, formToEpisode } from '../data/cycleLog';
import type { Attachment } from '../lib/attachments';
import { displayCopy } from '../lib/displayCopy';
import { CATEGORIES, category, type CategoryKey } from '../lib/logCategories';
import { mergeFound, planSave, readingLine, readQuick } from '../lib/quickLog';
import { userFacingError } from '../lib/userFacingError';
import { type Screen, useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { Composer } from '../ui/composer';
import { DetailScreen } from '../ui/kit';
import { L, SPACE } from '../ui/surface';
```

Update the file header comment's middle paragraph to say: categories replace the three tabs, chips are one tap, one sentence may file into several categories, and `planSave` decides where each part is kept.

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors anywhere; all tests PASS.

- [ ] **Step 3: Drive it on the phone**

With the dev server running (`npx expo start --dev-client`) and the app open on the phone: open Log from the plus, tap each of the eight categories, tap two chips in Mind, type "period started, bloated" under Cycle, confirm the line reads `Cycle: Period · Nutrition and gut: Bloating`, send, and confirm the screen closes without an error. Repeat with only a photo attached under Note. Report what was seen.

- [ ] **Step 4: Commit**

```bash
git add ciatta-mobile-app/src/screens/QuickLogScreen.tsx
git commit -m "Log by category: eight subjects, one tap chips, one sentence filed where it belongs"
```

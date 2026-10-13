import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CHECK_INS,
  dailyLogPatch,
  DIGESTION_FLAGS,
  emptyLog,
  type FoodEntry,
  hasAnything,
  kcalLine,
  kcalTotal,
  kcalTotalLine,
  logLine,
  STOOL_TYPES,
  stoolText,
  toDayFields,
} from './dailyLog';

const food = (over: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'f1', name: 'Porridge', kcal: null, kcalFrom: null, at: '2026-10-12T08:00:00.000Z', photoUri: null, ...over,
});

// ── An estimate can never render as a measurement ────────────────────

test('a figure is never returned without saying where it came from', () => {
  // A bare number is remembered as a fact whatever the copy around it
  // said, so there is no path that returns one.
  assert.equal(kcalLine(food({ kcal: 240, kcalFrom: null })), null);
  assert.equal(kcalLine(food({ kcal: null, kcalFrom: 'estimated' })), null);
});

test('an estimate says it is one, and hedges the number', () => {
  assert.equal(kcalLine(food({ kcal: 243.6, kcalFrom: 'estimated' })), 'About 244 kcal, estimated');
});

test('a figure she read off a label is attributed to the label, not to Ciatta', () => {
  assert.equal(kcalLine(food({ kcal: 240, kcalFrom: 'reported' })), '240 kcal, from the label');
});

test('no code path emits a kcal figure with no provenance', () => {
  const src = readFileSync(new URL('./dailyLog.ts', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // Every template that prints a kcal number also prints a word about it.
  for (const m of code.matchAll(/`[^`]*kcal[^`]*`/g)) {
    const t = m[0];
    assert.ok(/estimated|label/.test(t), `a kcal template with no provenance: ${t}`);
  }
});

// ── Totals are honest about what they could not count ────────────────

test('a day where nothing carried a figure has no total, rather than zero', () => {
  assert.equal(kcalTotal([food(), food()]), null);
  assert.equal(kcalTotalLine([food(), food()]), null);
});

test('a total says how many items it skipped', () => {
  // A total that silently skipped four meals reads as her whole day.
  const line = kcalTotalLine([food({ kcal: 240, kcalFrom: 'reported' }), food(), food()]) as string;
  assert.ok(line.includes('1 of 3 items'), line);
  assert.ok(line.includes('The rest had no figure'), line);
});

test('a total built from any estimate is itself an estimate', () => {
  const line = kcalTotalLine([
    food({ kcal: 240, kcalFrom: 'reported' }),
    food({ kcal: 100, kcalFrom: 'estimated' }),
  ]) as string;
  assert.ok(line.startsWith('About 340 kcal, estimated'), line);
});

test('a total from labels alone is not hedged', () => {
  const line = kcalTotalLine([food({ kcal: 240, kcalFrom: 'reported' })]) as string;
  assert.ok(line.startsWith('240 kcal from labels across 1 item'), line);
});

// ── Her words, kept ──────────────────────────────────────────────────

test('food reaches the engine as she wrote it, never recategorised', () => {
  // foodAndBloating tallies on her own words. "toast" counted as
  // "refined grain" is a judgement she did not make.
  const log = { ...emptyLog('2026-10-12'), foods: [food({ name: 'toast' }), food({ name: 'oat milk latte' })] };
  assert.deepEqual(toDayFields(log).foods, ['toast', 'oat milk latte']);
});

test('the fields handed to the engine are exactly the ones Day holds', () => {
  const keys = Object.keys(toDayFields(emptyLog('2026-10-12'))).sort();
  assert.deepEqual(keys, ['alcohol', 'caffeine', 'digestion', 'energy', 'foods', 'mood', 'stress']);
});

// ── The stool scale describes, it does not grade ─────────────────────

test('every stool type is described in plain words and none is graded', () => {
  assert.equal(STOOL_TYPES.length, 7);
  assert.equal(stoolText(4), 'Smooth and soft');
  for (const s of STOOL_TYPES) {
    for (const verdict of ['normal', 'healthy', 'poor', 'bad', 'good', 'abnormal']) {
      assert.ok(!s.text.toLowerCase().includes(verdict), `${s.text} grades her`);
    }
  }
});

test('an unlogged bowel movement has no text at all', () => {
  assert.equal(stoolText(null), null);
});

// ── Missing stays missing ────────────────────────────────────────────

test('no caffeine logged is not zero coffees', () => {
  const log = emptyLog('2026-10-12');
  assert.equal(log.caffeine, null);
  assert.ok(!logLine(log).includes('no caffeine'));
  assert.equal(logLine(log), 'Nothing logged for today yet.');
});

test('an empty day is not worth saving', () => {
  assert.equal(hasAnything(emptyLog('2026-10-12')), false);
  assert.equal(hasAnything({ ...emptyLog('2026-10-12'), stress: 3 }), true);
});

test('the line counts what is there and judges none of it', () => {
  const log = { ...emptyLog('2026-10-12'), foods: [food()], stool: 4, digestion: ['Bloating'], energy: 2 };
  const line = logLine(log);
  assert.ok(line.includes('one item of food'), line);
  assert.ok(line.includes('a bowel movement'), line);
  for (const verdict of ['good', 'poor', 'healthy', 'should', 'too much']) {
    assert.ok(!line.toLowerCase().includes(verdict), line);
  }
});

test('nothing rendered carries a dash or a forbidden word', () => {
  const log = { ...emptyLog('2026-10-12'), foods: [food({ kcal: 240, kcalFrom: 'estimated' })], digestion: ['Bloating'] };
  const lines = [logLine(log), kcalTotalLine(log.foods), kcalLine(log.foods[0]), ...STOOL_TYPES.map((s) => s.text), ...DIGESTION_FLAGS, ...CHECK_INS.map((c) => c.question)];
  for (const line of lines) {
    if (!line) continue;
    assert.ok(!/[—–]/.test(line), line);
    for (const w of ['cause', 'because', 'diagnos', 'you have', 'risk of']) {
      assert.ok(!line.toLowerCase().includes(w), `${line} says ${w}`);
    }
  }
});

// ── Her words and her files belong to the day too ────────────────────

test('a day carries a note and attachments, like the cycle log does', () => {
  const log = emptyLog('2026-10-12');
  assert.equal(log.note, '');
  assert.deepEqual(log.attachments, []);
});

test('a day holding only a note is worth saving', () => {
  // The box was wired to an empty string and an ignored onChange, so
  // typing in it did nothing and nothing it produced could be saved.
  assert.equal(hasAnything({ ...emptyLog('2026-10-12'), note: 'Felt heavy all afternoon' }), true);
  assert.equal(hasAnything({ ...emptyLog('2026-10-12'), note: '   ' }), false);
});

test('a day holding only an attachment is worth saving', () => {
  const file = { id: 'a', kind: 'photo' as const, name: 'lunch.jpg', uri: 'file:///a', addedAt: '' };
  assert.equal(hasAnything({ ...emptyLog('2026-10-12'), attachments: [file] }), true);
});

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

test('files are not sent to the day, where nothing shows them again', () => {
  const file = { id: 'f', kind: 'photo' as const, name: 'Photo at 9:00 AM', uri: 'file:///p.jpg', addedAt: '2026-10-12T09:00:00Z' };
  const p = dailyLogPatch({ ...emptyLog('2026-10-12'), digestion: ['Gas'], attachments: [file] });
  assert.equal('attachments' in p, false);
});

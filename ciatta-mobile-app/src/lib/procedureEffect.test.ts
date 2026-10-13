import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { dayFromParts, procedureEffect, rangeLine } from './procedureEffect';

// A procedure on 12 Jan 2026. Before is 1 Dec to 11 Jan, after 13 Jan to 23 Feb.
const DATE = '2026-01-12';
const iso = (offset: number) => {
  const d = new Date(2026, 0, 12 + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const day = (offset: number, sleep: number | null): Day =>
  ({ date: iso(offset), sleepHours: sleep, hrv: null, restingHR: null, steps: null } as unknown as Day);
const covered = (from: number, to: number, sleep: (o: number) => number | null = () => 7) =>
  Array.from({ length: to - from + 1 }, (_, i) => day(from + i, sleep(from + i)));
const ep = (offset: number, kinds = ['Pain']) => ({ date: `${iso(offset)}T10:00:00.000Z`, kinds });
const LATER = new Date(2026, 3, 1);

test('the windows are six weeks either side, and the procedure day is in neither', () => {
  const e = procedureEffect({ date: DATE, days: covered(-90, 60), episodes: [], journalSymptomDates: [], now: LATER });
  assert.equal(e.before.from, '2025-12-01');
  assert.equal(e.before.to, '2026-01-11');
  assert.equal(e.after.from, '2026-01-13');
  assert.equal(e.after.to, '2026-02-23');
});

test('symptom days count episodes and symptom notes, one per day', () => {
  const episodes = [ep(-30), ep(-30), ep(-20, ['Symptoms']), ep(-10, ['Period']), ep(0), ep(5)];
  const e = procedureEffect({ date: DATE, days: covered(-90, 60), episodes, journalSymptomDates: [iso(-5), iso(10)], now: LATER });
  assert.equal(e.before.symptomDays, 3, 'two the same day count once; a period alone is not a symptom day');
  assert.equal(e.after.symptomDays, 2, 'the procedure day itself counts on neither side');
});

test('the sentence says which way, counted', () => {
  const before = Array.from({ length: 14 }, (_, i) => ep(-40 + i * 2));
  const after = Array.from({ length: 5 }, (_, i) => ep(3 + i * 7));
  const e = procedureEffect({ date: DATE, days: covered(-90, 60), episodes: [...before, ...after], journalSymptomDates: [], now: LATER });
  assert.equal(e.sentence, 'Your symptom days fell from 14 in the six weeks before to 5 in the six weeks after.');
});

test('rose and stayed read as plainly', () => {
  const rose = procedureEffect({ date: DATE, days: covered(-90, 60), episodes: [ep(-3), ep(3), ep(4)], journalSymptomDates: [], now: LATER });
  assert.equal(rose.sentence, 'Your symptom days rose from 1 in the six weeks before to 2 in the six weeks after.');
  const stayed = procedureEffect({ date: DATE, days: covered(-90, 60), episodes: [ep(-3), ep(3)], journalSymptomDates: [], now: LATER });
  assert.equal(stayed.sentence, 'Your symptom days stayed at 1 in the six weeks before and after.');
});

test('a side with too little record says so instead of comparing', () => {
  const e = procedureEffect({ date: DATE, days: covered(-10, 60), episodes: [], journalSymptomDates: [], now: LATER });
  assert.equal(e.before.enough, false);
  assert.equal(e.sentence, null);
});

test('six weeks not yet over: weeks so far, and no comparison', () => {
  const e = procedureEffect({ date: DATE, days: covered(-90, 20), episodes: [], journalSymptomDates: [], now: new Date(2026, 1, 2) });
  assert.equal(e.weeksAfter, 3);
  assert.equal(e.sentence, null);
});

test('a measure that left her usual says the week it came back', () => {
  // Usual sleep 7h; the first three weeks after are 5h, then 7h from week 4.
  const sleep = (o: number) => (o > 0 && o <= 21 ? 5 : 7);
  const e = procedureEffect({ date: DATE, days: covered(-95, 60, sleep), episodes: [], journalSymptomDates: [], now: LATER });
  assert.deepEqual(e.measures, ['Sleep returned to your usual in week 4.']);
});

test('one that never came back within six weeks says that', () => {
  const sleep = (o: number) => (o > 0 ? 5 : 7);
  const e = procedureEffect({ date: DATE, days: covered(-95, 60, sleep), episodes: [], journalSymptomDates: [], now: LATER });
  assert.deepEqual(e.measures, ['Sleep had not returned to your usual by week 6.']);
});

test('one that never left her usual gets no line', () => {
  const e = procedureEffect({ date: DATE, days: covered(-95, 60), episodes: [], journalSymptomDates: [], now: LATER });
  assert.deepEqual(e.measures, []);
});

test('date ranges read without dashes', () => {
  assert.equal(rangeLine('2025-12-01', '2026-01-11'), '1 Dec to 11 Jan');
});

test('a date she types becomes a day, or nothing when it is not one', () => {
  assert.equal(dayFromParts('12', '1', '2026'), '2026-01-12');
  assert.equal(dayFromParts('31', '2', '2026'), null);
  assert.equal(dayFromParts('', '1', '2026'), null);
  assert.equal(dayFromParts('1', '1', '2090', new Date(2026, 9, 13)), null, 'not in the future');
});

test('the list: dated procedures newest first, each with where it came from; undated surgeries asked for a date', async () => {
  const { procedureList } = await import('./procedureEffect');
  const list = procedureList(
    [{ id: 'a1', name: 'Laparoscopy', date: '2026-01-12' }],
    [
      { sourceId: 'c1', kind: 'procedure', name: 'Pelvic ultrasound', effectiveOn: '2026-03-02' },
      { sourceId: 'c2', kind: 'procedure', name: 'Undated thing', effectiveOn: null },
      { sourceId: 'c3', kind: 'lab', name: 'Ferritin', effectiveOn: '2026-03-01' },
    ],
    ['laparoscopy', 'Appendectomy'],
  );
  assert.deepEqual(list.dated, [
    { id: 'c1', name: 'Pelvic ultrasound', date: '2026-03-02', source: 'Imported' },
    { id: 'a1', name: 'Laparoscopy', date: '2026-01-12', source: 'You added' },
  ]);
  // A surgery she already dated is not asked about again.
  assert.deepEqual(list.undated, ['Appendectomy']);
});

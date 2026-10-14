import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { metricCorrelation, symptomCorrelation, windowDays } from './symptomCorrelation';
import { symptomStrip } from './symptomStrip';

const NOW = new Date(2026, 9, 28, 12);
const keyOf = (n: number) => {
  const d = new Date(2026, 9, 28 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const days28 = windowDays('28', NOW);
const set = (ns: number[]) => new Set(ns.map(keyOf));

test('the window is every day, oldest first, ending today; three months is ninety days', () => {
  assert.equal(days28.length, 28);
  assert.equal(days28[27], keyOf(0));
  assert.equal(windowDays('90', NOW).length, 90);
});

test('two symptoms: how often one came on the days of the other, against the rest', () => {
  const bloating = set([1, 4, 8, 12, 20]);
  const headache = set([1, 4, 8, 12, 25]);
  const c = symptomCorrelation('Bloating', bloating, 'Headache', headache, days28);
  assert.deepEqual({ both: c.both, a: c.a, b: c.b, days: c.days }, { both: 4, a: 5, b: 5, days: 28 });
  assert.equal(c.together, true);
  assert.equal(c.sentence, 'Headache came on 4 of the 5 days you logged bloating, against 1 of the other 23 days.');
  // Rarely together.
  const apart = symptomCorrelation('Bloating', bloating, 'Acne', set([2, 3, 5, 6]), days28);
  assert.equal(apart.together, false);
  assert.equal(apart.sentence, 'Acne came on none of the 5 days you logged bloating, against 4 of the other 23 days.');
  // Too few days to say anything.
  const thin = symptomCorrelation('Bloating', set([1]), 'Headache', headache, days28);
  assert.equal(thin.sentence, 'Log bloating on at least 2 days, and headache on at least 2, to compare them.');
});

const day = (n: number, over: Partial<Day>): Day => ({
  date: keyOf(n), sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});

test('a symptom against a wearable metric: her average on those days against the others', () => {
  const headache = set([1, 4, 8, 12, 20]);
  const days = Array.from({ length: 28 }, (_, n) => day(n, { sleepHours: headache.has(keyOf(n)) ? 6 : 7.5, hrv: headache.has(keyOf(n)) ? 38 : 50 }));
  const sleep = metricCorrelation('Headache', headache, 'sleep', days, days28);
  assert.equal(sleep.sentence, 'On the 5 days you logged headache, you slept 6h 00m on average, against 7h 30m on the other 23.');
  assert.equal(sleep.direction, 'lower');
  const hrv = metricCorrelation('Headache', headache, 'hrv', days, days28);
  assert.equal(hrv.sentence, 'On the 5 days you logged headache, your HRV averaged 38 ms, against 50 ms on the other 23.');
  // No readings on enough of either side: says what is missing.
  const none = metricCorrelation('Headache', headache, 'steps', days, days28);
  assert.equal(none.sentence, 'Not enough steps readings on headache days and other days to compare yet.');
});

test('rows follow her chosen symptoms, even ones she has not logged yet', () => {
  const seen = new Map<string, Map<string, number | null>>([['Bloating', new Map([[keyOf(0), 5]])], ['Acne', new Map([[keyOf(2), null]])]]);
  const strip = symptomStrip(seen, '7', NOW, 4, ['Headache', 'Bloating']);
  assert.deepEqual(strip.rows.map((r) => r.name), ['Headache', 'Bloating']);
  assert.ok(strip.rows[0].cells.every((c) => c == null), 'not logged yet: empty days');
  assert.deepEqual(symptomStrip(seen, '7', NOW).rows.map((r) => r.name), ['Bloating', 'Acne'], 'with none chosen, the ones she logged most');
});

test('end to end: symptoms logged in different places line up on the card and compare', async () => {
  const { symptomDays } = await import('./symptomsView');
  const at = (n: number) => new Date(2026, 9, 28 - n, 9);
  // Headache from the daily log on 4 days; bloating from the gut flags on 3
  // of those and 1 other; pain from a cycle log on 2 days.
  const logs = [1, 3, 6, 9].map((n) => ({ at: at(n).toISOString(), category: 'mind', items: { mind: ['Headache'] } }));
  const daysRows = [1, 3, 6, 15].map((n) => ({ date: keyOf(n), digestion: ['Bloating'] }));
  const signals = [2, 5].map((n) => ({ date: at(n), episode: { kinds: ['Pain'], symptoms: [], severity: 6 } }));
  const seen = symptomDays({ signals, logs, days: daysRows, now: NOW });

  // She chose Headache and Bloating to follow, and one she has not logged.
  const strip = symptomStrip(seen, '28', NOW, 4, ['Headache', 'Bloating', 'Night sweats']);
  assert.deepEqual(strip.rows.map((r) => [r.name, r.cells.filter(Boolean).length]), [['Headache', 4], ['Bloating', 4], ['Night sweats', 0]]);

  const window = windowDays('28', NOW);
  const d = (name: string) => new Set(seen.get(name)?.keys() ?? []);
  assert.equal(
    symptomCorrelation('Headache', d('Headache'), 'Bloating', d('Bloating'), window).sentence,
    'Bloating came on 3 of the 4 days you logged headache, against 1 of the other 24 days.',
  );
  assert.equal(symptomCorrelation('Headache', d('Headache'), 'Night sweats', d('Night sweats'), window).sentence, 'Log headache on at least 2 days, and night sweats on at least 2, to compare them.');

  // And against her sleep on the same days.
  const sleepDays = Array.from({ length: 28 }, (_, n) => day(n, { sleepHours: [1, 3, 6, 9].includes(n) ? 5.5 : 7 }));
  assert.equal(
    metricCorrelation('Headache', d('Headache'), 'sleep', sleepDays, window).sentence,
    'On the 4 days you logged headache, you slept 5h 30m on average, against 7h 00m on the other 24.',
  );
});

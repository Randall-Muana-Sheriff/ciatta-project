import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { hormoneCurves, hormoneView, phaseBounds, phaseEffects } from './hormones';

const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs)) + 1;

test('the phases of a cycle, by day: menstrual, follicular, ovulatory, luteal', () => {
  assert.deepEqual(phaseBounds(28, 14, 5), [
    { phase: 'Menstrual', from: 1, to: 5 },
    { phase: 'Follicular', from: 6, to: 12 },
    { phase: 'Ovulatory', from: 13, to: 15 },
    { phase: 'Luteal', from: 16, to: 28 },
  ]);
  // A long cycle keeps a fourteen day luteal phase and a longer follicular one.
  assert.deepEqual(phaseBounds(35, 21, 5).map((p) => [p.phase, p.to - p.from + 1]), [
    ['Menstrual', 5], ['Follicular', 14], ['Ovulatory', 3], ['Luteal', 13],
  ]);
});

test('typical hormone curves follow the cycle\'s shape: LH surges just before ovulation, progesterone peaks mid luteal', () => {
  const c = hormoneCurves(28, 14);
  for (const k of ['estradiol', 'progesterone', 'lh', 'fsh'] as const) {
    assert.equal(c[k].length, 28);
    assert.equal(Math.max(...c[k]), 1, `${k} is scaled to its own peak`);
  }
  assert.equal(argmax(c.lh), 13);
  assert.ok(argmax(c.estradiol) >= 11 && argmax(c.estradiol) <= 13, 'estradiol peaks before ovulation');
  assert.equal(argmax(c.progesterone), 21);
  assert.ok(c.progesterone[5] < 0.1, 'progesterone is low before ovulation');
  // Fitted to her own cycle: a 35 day cycle moves the surge, not the luteal length.
  assert.equal(argmax(hormoneCurves(35, 21).lh), 20);
});

const day = (date: string, over: Partial<Day>): Day => ({
  date, sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});

test('each phase, from her own cycles, against her own usual, once two cycles back it', () => {
  // Two 28 day cycles: sleep 6h in the luteal phase, 8h otherwise; stress 4 luteal, 2 otherwise.
  const windows = [
    { index: 0, start: new Date(2026, 7, 1), end: new Date(2026, 7, 28), length: 28 },
    { index: 1, start: new Date(2026, 7, 29), end: new Date(2026, 8, 25), length: 28 },
  ];
  const days: Day[] = [];
  for (const w of windows) {
    for (let i = 0; i < 28; i++) {
      const d = new Date(w.start.getFullYear(), w.start.getMonth(), w.start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const luteal = i + 1 >= 16;
      days.push(day(iso, { sleepHours: luteal ? 6 : 8, stress: luteal ? 4 : 2 }));
    }
  }
  const fx = phaseEffects(days, windows);
  const luteal = fx.Luteal;
  assert.deepEqual(luteal.find((r) => r.key === 'sleep'), { key: 'sleep', label: 'Sleep', value: '6h 00m', compare: 'Lower than your usual', cycles: 2 });
  assert.deepEqual(luteal.find((r) => r.key === 'stress'), { key: 'stress', label: 'Stress you logged', value: '4.0 of 5', compare: 'Higher than your usual', cycles: 2 });
  assert.equal(fx.Follicular.find((r) => r.key === 'sleep')?.compare, 'Higher than your usual');
  // HRV was never measured, so nothing is said about it.
  assert.equal(luteal.find((r) => r.key === 'hrv'), undefined);
  // One cycle is not enough to say anything about a phase.
  assert.deepEqual(phaseEffects(days, windows.slice(0, 1)).Luteal, []);
});

test('the view: fitted to her usual length, today\'s day and phase, estimated unless ovulation is confirmed', () => {
  const now = new Date(2026, 9, 20);
  const open = { index: 2, start: new Date(2026, 9, 1), end: null, length: null };
  const v = hormoneView({ open, usualLength: 30, situations: ['Regular'], confirmedOvulation: null, now })!;
  assert.deepEqual({ length: v.length, ovulationDay: v.ovulationDay, today: v.today, phase: v.phase, confirmed: v.confirmed, ownLength: v.ownLength },
    { length: 30, ovulationDay: 16, today: 20, phase: 'Luteal', confirmed: false, ownLength: true });
  // Ovulation confirmed on day 19: days 18 to 20 are ovulatory, so today is too.
  const c = hormoneView({ open, usualLength: 30, situations: [], confirmedOvulation: new Date(2026, 9, 19), now })!;
  assert.equal(c.ovulationDay, 19);
  assert.equal(c.phase, 'Ovulatory');
  assert.equal(c.confirmed, true);
  // With nothing of hers to go on, a 28 day cycle, and it says so.
  assert.equal(hormoneView({ open, usualLength: null, situations: [], confirmedOvulation: null, now })!.ownLength, false);
});

test('typical curves are not drawn where they would not describe her cycle', () => {
  const now = new Date(2026, 9, 20);
  const open = { index: 2, start: new Date(2026, 9, 1), end: null, length: null };
  for (const s of ['Hormonal contraception', 'PCOS / PMOS', 'Perimenopause', 'Postpartum', 'No periods right now'] as const) {
    assert.equal(hormoneView({ open, usualLength: 28, situations: [s], confirmedOvulation: null, now })!.applies, false, s);
  }
  assert.equal(hormoneView({ open: null, usualLength: 28, situations: [], confirmedOvulation: null, now }), null, 'no logged cycle, nothing to place');
});

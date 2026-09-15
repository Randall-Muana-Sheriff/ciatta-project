import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, emptyForm, type Episode, formToEpisode, isoDay } from '../data/cycleLog';
import { bandOf, countedWindows, cycleWindows, medianLength, periodStarts, phaseOf, regularity } from './cycleModel';
import type { CycleProfile } from './cycleProfile';

const NOW = new Date(2026, 8, 15);
const day = (ago: number) => addDays(NOW, -ago);
const bleed = (kind: string, ago: number): Episode => formToEpisode({ ...emptyForm(), kinds: [kind], periodStart: ago }, false, NOW);
const profile = (p: Partial<CycleProfile>): CycleProfile => ({ situations: [], setupDone: true, ...p });
// Completed lengths oldest first; the current cycle started 5 days ago.
function windowsOf(lengths: number[]) {
  let ago = 5;
  const starts = [day(ago)];
  for (const l of [...lengths].reverse()) {
    ago += l;
    starts.unshift(day(ago));
  }
  return cycleWindows(starts);
}

test('periodStarts uses only period episodes', () => {
  const starts = periodStarts([bleed('Period', 40), bleed('Spotting', 20), bleed('Postpartum bleeding', 10), bleed('Period', 5)]);
  assert.deepEqual(starts.map(isoDay), [isoDay(day(40)), isoDay(day(5))]);
});

test('cycleWindows merges starts under 10 days apart and measures lengths', () => {
  const w = cycleWindows([day(70), day(40), day(36), day(5)]);
  assert.deepEqual(w.map((x) => x.length), [30, 35, null]);
  assert.equal(w[2].end, null);
});

test('medianLength takes the middle completed length', () => {
  assert.equal(medianLength(windowsOf([28, 30, 29])), 29);
  assert.equal(medianLength(cycleWindows([day(3)])), null);
});

test('three steady cycles are predictable', () => {
  assert.equal(regularity(windowsOf([28, 29, 30]), profile({ situations: ['Regular'] })), 'predictable');
});

test('a spread over 7 days is unpredictable', () => {
  assert.equal(regularity(windowsOf([26, 41, 30]), profile({ situations: ['Regular'] })), 'unpredictable');
});

test('fewer than 3 completed cycles is unpredictable', () => {
  assert.equal(regularity(windowsOf([28, 29]), profile({})), 'unpredictable');
});

test('some situations always mean unpredictable', () => {
  for (const s of ['Irregular', 'PCOS / PMOS', 'Perimenopause', 'No periods right now'] as const) {
    assert.equal(regularity(windowsOf([28, 28, 28]), profile({ situations: [s] })), 'unpredictable');
  }
});

test('postpartum stays unpredictable until 3 periods have returned', () => {
  const w = windowsOf([28, 28, 28]); // starts 89, 61, 33 and 5 days ago
  assert.equal(regularity(w, profile({ situations: ['Postpartum'], birthDate: isoDay(day(50)) })), 'unpredictable');
  assert.equal(regularity(w, profile({ situations: ['Postpartum'], birthDate: isoDay(day(70)) })), 'unpredictable');
  assert.equal(regularity(w, profile({ situations: ['Postpartum'], birthDate: isoDay(day(95)) })), 'predictable');
});

test('postpartum with mixed pre/post birth cycles', () => {
  // windowsOf([45, 20, 28, 28, 28]) creates windows starting at:
  // day(154), day(109), day(89), day(61), day(33), day(5)
  // with completed lengths [45, 20, 28, 28, 28] for the first five windows.
  // Set birthDate to day(100) so only the last three 28-day completed cycles
  // (windows starting at day(89), day(61), day(33)) start on or after birth.
  // Spread is 0, so predictable.
  const w = windowsOf([45, 20, 28, 28, 28]);
  assert.equal(regularity(w, profile({ situations: ['Postpartum'], birthDate: isoDay(day(100)) })), 'predictable');
});

test('countedWindows keeps only cycles from the birth on, when a birth date is set', () => {
  const w = windowsOf([45, 20, 28, 28, 28]); // starts 154, 109, 89, 61, 33 and 5 days ago
  const after = countedWindows(w, profile({ situations: ['Postpartum'], birthDate: isoDay(day(100)) }));
  assert.deepEqual(after.map((x) => isoDay(x.start)), [89, 61, 33, 5].map((ago) => isoDay(day(ago))));
  assert.deepEqual(after.map((x) => x.length), [28, 28, 28, null]);
});

test('countedWindows leaves windows unchanged without a birth date or outside Postpartum', () => {
  const w = windowsOf([45, 20, 28]);
  assert.equal(countedWindows(w, profile({ situations: ['Postpartum'] })), w);
  assert.equal(countedWindows(w, profile({ situations: ['Regular'], birthDate: isoDay(day(30)) })), w);
});

test('completed cycles keep all four phases', () => {
  const [w] = cycleWindows([day(40), day(10)]);
  assert.equal(phaseOf(day(38), w, null), 'During period');
  assert.equal(phaseOf(day(34), w, null), 'After period');
  assert.equal(phaseOf(day(25), w, null), 'Between periods');
  assert.equal(phaseOf(day(12), w, null), 'Before period');
});

test('an open cycle without a prediction has no phase after the first week', () => {
  const [w] = cycleWindows([day(20)]);
  assert.equal(phaseOf(day(19), w, null), 'During period');
  assert.equal(phaseOf(day(0), w, null), null);
});

test('an open predictable cycle uses the predicted length', () => {
  const [w] = cycleWindows([day(26)]);
  assert.equal(phaseOf(day(0), w, 28), 'Before period');
});

test('bandOf groups days since a period', () => {
  assert.equal(bandOf(3).label, '0 to 7 days');
  assert.equal(bandOf(35).label, '22 to 35 days');
  assert.equal(bandOf(36).label, 'Over 35 days');
});

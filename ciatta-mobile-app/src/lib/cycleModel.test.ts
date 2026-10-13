import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, emptyForm, type Episode, formToEpisode, isoDay } from '../data/cycleLog';
import { bandOf, clinicalPhase, clinicalPhaseLabel, countedWindows, estimatedPhase, estimatedPhaseLabel, cycleToday, cycleTodayLabel, cycleWindows, medianLength, periodStarts, phaseLine, phaseOf, regularity, type CycleWindow } from './cycleModel';
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

// ── Where today sits in the open cycle ───────────────────────────────

const TODAY = new Date(2026, 9, 11);
const openAt = (start: Date): CycleWindow => ({ index: 0, start, end: null, length: null });

test('day one is the day the period started, not the day after', () => {
  assert.equal(cycleToday(openAt(TODAY), 28, TODAY)?.day, 1);
  assert.equal(cycleToday(openAt(new Date(2026, 9, 7)), 28, TODAY)?.day, 5);
});

test('the label carries the phase when there is one', () => {
  const t = cycleToday(openAt(new Date(2026, 9, 7)), 28, TODAY);
  // Day 5 is still inside the period by this model, which is also what
  // the concept's "Menstrual, day 5" is saying.
  assert.equal(cycleTodayLabel(t), 'During period · day 5');
});

test('no open cycle means no label, never a guess', () => {
  assert.equal(cycleToday(null, 28, TODAY), null);
  assert.equal(cycleTodayLabel(null), null);
});

test('a phase that cannot be known is left off rather than invented', () => {
  // An open cycle with no predicted length has no phases past its first
  // week, so the label falls back to the day count, which is still true.
  const t = cycleToday(openAt(new Date(2026, 8, 1)), null, TODAY);
  assert.equal(t?.phase, null);
  assert.equal(cycleTodayLabel(t), 'Day 41');
});

test('a cycle left open far too long is not a day count worth showing', () => {
  // A period she never logged leaves the last one open forever, and "day
  // 400" is a number about Ciatta's bookkeeping rather than about her.
  assert.equal(cycleToday(openAt(new Date(2025, 0, 1)), 28, TODAY), null);
});

test('a cycle starting in the future is refused', () => {
  assert.equal(cycleToday(openAt(new Date(2027, 0, 1)), 28, TODAY), null);
});

// ── Clinical phase names, and when they may be used ──────────────────

const d = (iso: string) => { const [y, m, day] = iso.split('-').map(Number); return new Date(y, m - 1, day); };

test('without a known ovulation there is no follicular or luteal', () => {
  // Naming them from a day count assumes a 28 day cycle ovulating on day
  // 14. For a woman with PCOS or an irregular cycle that is wrong often
  // enough to be worthless and confident enough to be believed.
  assert.equal(clinicalPhase({ date: d('2026-03-10'), bleeding: false, ovulation: null }), null);
  assert.equal(clinicalPhase({ date: d('2026-03-25'), bleeding: false, ovulation: null }), null);
});

test('bleeding is observed, so it is named with or without ovulation', () => {
  assert.equal(clinicalPhase({ date: d('2026-03-02'), bleeding: true, ovulation: null }), 'Menstrual');
  assert.equal(clinicalPhase({ date: d('2026-03-02'), bleeding: true, ovulation: d('2026-03-14') }), 'Menstrual');
});

test('with ovulation known, before it is follicular and after it is luteal', () => {
  const ovulation = d('2026-03-14');
  assert.equal(clinicalPhase({ date: d('2026-03-08'), bleeding: false, ovulation }), 'Follicular');
  assert.equal(clinicalPhase({ date: d('2026-03-22'), bleeding: false, ovulation }), 'Luteal');
});

test('the day of ovulation and either side of it is ovulatory', () => {
  const ovulation = d('2026-03-14');
  for (const day of ['2026-03-13', '2026-03-14', '2026-03-15']) {
    assert.equal(clinicalPhase({ date: d(day), bleeding: false, ovulation }), 'Ovulatory', day);
  }
  assert.equal(clinicalPhase({ date: d('2026-03-16'), bleeding: false, ovulation }), 'Luteal');
});

test('the label reads naturally and never says menstrual phase', () => {
  assert.equal(clinicalPhaseLabel('Follicular'), 'Follicular phase');
  assert.equal(clinicalPhaseLabel('Luteal'), 'Luteal phase');
  assert.equal(clinicalPhaseLabel('Ovulatory'), 'Ovulatory phase');
  assert.equal(clinicalPhaseLabel('Menstrual'), 'Menstrual');
});

test('the line prefers the clinical name and falls back to the observed one', () => {
  assert.equal(phaseLine('Luteal', 'Between periods'), 'Luteal phase');
  assert.equal(phaseLine(null, 'Between periods'), 'Between periods');
  assert.equal(phaseLine(null, null), null);
});

test('a clinical name never appears beside the observational one', () => {
  // Two names for where she is, shown together, is the screen hedging.
  const line = phaseLine('Follicular', 'After period') as string;
  assert.ok(!line.includes('After period'), line);
});

test('an estimated phase comes from the day and her own usual length', () => {
  assert.equal(estimatedPhase(3, null), 'Menstrual');
  // Day 12 of a 28 day cycle is before ovulation on day 14.
  assert.equal(estimatedPhase(12, null), 'Follicular');
  assert.equal(estimatedPhase(14, 28), 'Ovulatory');
  assert.equal(estimatedPhase(20, 28), 'Luteal');
  // Her own 40 day cycle puts ovulation near day 26, so day 20 is still before it.
  assert.equal(estimatedPhase(20, 40), 'Follicular');
});

test('an estimated phase says it is one, before the name', () => {
  assert.equal(estimatedPhaseLabel('Follicular'), 'Likely follicular');
  assert.equal(estimatedPhaseLabel('Luteal'), 'Likely luteal');
  assert.equal(estimatedPhaseLabel('Menstrual'), 'Menstrual');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { hasPoints, sleepPoints, sleepScale, symptomPlacement, symptomPoints } from './journeyLanes';

const day = (date: string, sleepHours: number | null): Day => ({
  date, sleepHours, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null,
  steps: null, activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null,
  energy: null, mood: null, stress: null, caffeine: null, alcohol: null, foods: [], digestion: [],
});

// ── Missing nights are missing, not zero ─────────────────────────────

test('a night with no sleep figure contributes no point', () => {
  // A night she did not wear her ring is not a night of no sleep, and a
  // zero would draw a bar to the floor and read as exactly that.
  const pts = sleepPoints([day('2026-03-01', 7), day('2026-03-02', null), day('2026-03-03', 6.5)]);
  assert.equal(pts.length, 2);
  assert.ok(pts.every((p) => p.hours > 0));
});

test('points come out in date order whatever order they went in', () => {
  const pts = sleepPoints([day('2026-03-03', 6), day('2026-03-01', 7)]);
  assert.deepEqual(pts.map((p) => p.at.getDate()), [1, 3]);
});

test('a point sits inside its day rather than on the boundary', () => {
  assert.equal(sleepPoints([day('2026-03-01', 7)])[0].at.getHours(), 12);
});

test('the label is hours and minutes, not a decimal', () => {
  assert.equal(sleepPoints([day('2026-03-01', 7.5)])[0].label, '7h 30m');
});

// ── The lane is scaled to her, not to a fixed range ──────────────────

test('a short sleeper still gets a lane with shape in it', () => {
  // Scaled to a fixed six to nine hours, someone who sleeps five to six
  // sees a flat line on the floor.
  const pts = sleepPoints([day('2026-03-01', 5), day('2026-03-02', 6)]);
  const y = sleepScale(pts, 100);
  assert.ok(y(5) > y(6), 'more sleep should sit higher');
  assert.notEqual(y(5), y(6));
});

test('nothing touches the edge of the lane', () => {
  const pts = sleepPoints([day('2026-03-01', 5), day('2026-03-02', 9)]);
  const y = sleepScale(pts, 100);
  assert.ok(y(9) > 0, 'the longest night should not be clipped at the top');
  assert.ok(y(5) < 100, 'the shortest should not sit on the floor');
});

test('one night, or a flat run, sits in the middle rather than at an extreme', () => {
  // There is nothing to compare it to, and the top or the bottom would
  // imply there were.
  const one = sleepPoints([day('2026-03-01', 7)]);
  assert.equal(sleepScale(one, 100)(7), 50);
  const flat = sleepPoints([day('2026-03-01', 7), day('2026-03-02', 7)]);
  assert.equal(sleepScale(flat, 100)(7), 50);
});

test('an empty lane does not divide by zero', () => {
  assert.equal(sleepScale([], 100)(7), 50);
});

// ── Symptoms ─────────────────────────────────────────────────────────

const sig = (date: Date, severity: number | null) => ({ date, episode: { severity } });

test('severity is carried per log, never averaged across a day', () => {
  // A mean would flatten a nine and a four into two sixes and a half.
  const pts = symptomPoints([sig(new Date(2026, 2, 1), 9), sig(new Date(2026, 2, 1), 4)]);
  assert.deepEqual(pts.map((p) => p.severity), [9, 4]);
});

test('worse days sit lower and draw larger', () => {
  const low = symptomPlacement({ at: new Date(), severity: 2 }, 100);
  const high = symptomPlacement({ at: new Date(), severity: 9 }, 100);
  assert.ok(high.y > low.y, 'a worse day should sit lower in the lane');
  assert.ok(high.r > low.r, 'a worse day should draw larger');
});

test('a log with no severity sits at the midline and draws small', () => {
  // She recorded that it happened without saying how much. The dot must
  // not imply a number she did not give.
  const p = symptomPlacement({ at: new Date(), severity: null }, 100);
  assert.equal(p.y, 50);
  assert.equal(p.r, 2.5);
});

test('a severity outside the scale is clamped rather than drawn off the lane', () => {
  const over = symptomPlacement({ at: new Date(), severity: 99 }, 100);
  const under = symptomPlacement({ at: new Date(), severity: -5 }, 100);
  assert.ok(over.y <= 100 && under.y >= 0);
});

test('an empty lane knows it is empty', () => {
  assert.equal(hasPoints([]), false);
  assert.equal(hasPoints(sleepPoints([day('2026-03-01', 7)])), true);
});

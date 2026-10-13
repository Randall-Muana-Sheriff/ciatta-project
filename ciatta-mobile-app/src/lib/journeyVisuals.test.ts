import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import {
  binFor,
  binStart,
  cycleGaps,
  CYCLE_NORMAL,
  drawMarkers,
  flareSpans,
  painCells,
  periodBlocks,
  severityOpacity,
  SLEEP_GUIDE_HOURS,
  sleepBins,
  symptomGrid,
} from './journeyVisuals';

const ep = (over: Record<string, unknown>) => ({
  episode: {
    id: String(Math.random()), kinds: [], date: '2026-10-10', periodStart: null, periodEnd: null, flow: null, severity: null,
    symptoms: [], flareUpUserReported: null, allDay: true, start: null, end: null, ...over,
  },
  date: new Date(2026, 9, 10, 12),
  pain: false,
});

const day = (date: string, sleepHours: number | null): Day => ({
  date, sleepHours, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null, activeMinutes: null,
  workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null, caffeine: null, alcohol: null,
  foods: [], digestion: [],
});

test('each window is binned the way its marks are read', () => {
  assert.equal(binFor('day'), 'hour');
  assert.equal(binFor('week'), 'day');
  assert.equal(binFor('month'), 'day');
  assert.equal(binFor('year'), 'week');
  // Weeks start on a Monday.
  assert.deepEqual(binStart(new Date(2026, 9, 14, 15), 'week'), new Date(2026, 9, 12));
  assert.deepEqual(binStart(new Date(2026, 9, 14, 15, 40), 'hour'), new Date(2026, 9, 14, 15));
});

test('a period is a block as long as she bled, shaded by her flow', () => {
  const blocks = periodBlocks([
    ep({ kinds: ['Period'], periodStart: '2026-10-01', periodEnd: '2026-10-05', flow: 'Heavy' }),
    ep({ kinds: ['Period'], periodStart: '2026-09-03', periodEnd: null, flow: 'Not sure' }),
    ep({ kinds: ['Pain'], periodStart: null }),
  ]);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[1], { start: new Date(2026, 9, 1), end: new Date(2026, 9, 6), flow: 3 });
  // No end logged: the day it started, and no flow guessed.
  assert.deepEqual(blocks[0], { start: new Date(2026, 8, 3), end: new Date(2026, 8, 4), flow: null });
});

test('a cycle length outside 24 to 38 days is marked; the open cycle is not counted', () => {
  assert.deepEqual(CYCLE_NORMAL, { min: 24, max: 38 });
  const gaps = cycleGaps([
    { index: 0, start: new Date(2026, 6, 1), end: new Date(2026, 6, 21), length: 21 },
    { index: 1, start: new Date(2026, 6, 22), end: new Date(2026, 7, 19), length: 29 },
    { index: 2, start: new Date(2026, 7, 20), end: null, length: null },
  ]);
  assert.deepEqual(gaps.map((g) => [g.days, g.outside]), [[21, true], [29, false]]);
  assert.deepEqual(gaps[1].mid, new Date(2026, 7, 5, 12));
});

test('pain is her worst rating in each day, and a day with none is absent', () => {
  const cells = painCells(
    [
      { ...ep({ severity: 4 }), pain: true, date: new Date(2026, 9, 10, 9) },
      { ...ep({ severity: 7 }), pain: true, date: new Date(2026, 9, 10, 18) },
      { ...ep({ severity: 2 }), pain: true, date: new Date(2026, 9, 12, 8) },
      { ...ep({ severity: null }), pain: true, date: new Date(2026, 9, 13, 8) },
      { ...ep({ severity: 9 }), pain: false, date: new Date(2026, 9, 14, 8) },
    ],
    'day',
  );
  assert.deepEqual(cells.map((c) => [c.start.getDate(), c.severity]), [[10, 7], [12, 2]]);
  assert.deepEqual(cells[0].end, new Date(2026, 9, 11));
});

test('a flare up runs from its start to its end, or is a moment when it has no end', () => {
  const spans = flareSpans([
    { ...ep({ flareUpUserReported: true, allDay: false, start: 9, end: 15, date: '2026-10-10' }), date: new Date(2026, 9, 10, 12) },
    { ...ep({ flareUpUserReported: true, allDay: true }), date: new Date(2026, 9, 11, 12) },
    { ...ep({ flareUpUserReported: false }), date: new Date(2026, 9, 12, 12) },
  ]);
  assert.deepEqual(spans[0], { at: new Date(2026, 9, 10, 9), until: new Date(2026, 9, 10, 15) });
  assert.deepEqual(spans[1], { at: new Date(2026, 9, 11), until: new Date(2026, 9, 12) });
  assert.equal(spans.length, 2);
});

test('sleep is measured against seven hours, averaged into weeks over a year', () => {
  assert.equal(SLEEP_GUIDE_HOURS, 7);
  const days = [day('2026-10-12', 6), day('2026-10-13', 8), day('2026-10-14', null), day('2026-10-19', 7.5)];
  const nights = sleepBins(days, 'day');
  assert.deepEqual(nights.map((n) => [n.start.getDate(), n.hours]), [[12, 6], [13, 8], [19, 7.5]]);
  const weeks = sleepBins(days, 'week');
  assert.deepEqual(weeks.map((w) => [w.start.getDate(), w.hours]), [[12, 7], [19, 7.5]]);
  // A day window still shows last night, not an hour by hour split.
  assert.equal(sleepBins(days, 'hour').length, 3);
});

test('the symptom grid has a row for each of her most logged symptoms, shaded by severity', () => {
  const at = (d: number) => new Date(2026, 9, d, 12);
  const grid = symptomGrid(
    [
      { ...ep({ symptoms: ['Fatigue', 'Bloating'], severity: 6 }), date: at(10) },
      { ...ep({ symptoms: ['Fatigue'], severity: 3 }), date: at(10) },
      { ...ep({ symptoms: ['Fatigue', 'Headache'], severity: null }), date: at(12) },
      { ...ep({ symptoms: ['Nausea'] }), date: at(13) },
    ],
    'day',
    2,
  );
  assert.deepEqual(grid.map((r) => r.symptom), ['Fatigue', 'Bloating']);
  assert.deepEqual(grid[0].cells.map((c) => [c.start.getDate(), c.severity]), [[10, 6], [12, null]]);
});

test('a lab draw is marked by whether every result sat inside its range', () => {
  const marks = drawMarkers([
    { date: '12 Jun 2026', lab: 'Quest', results: [{ status: 'In' }, { status: 'Low' }] },
    { date: '3 Feb 2026', lab: 'Quest', results: [{ status: 'In' }] },
    { date: 'not a date', lab: 'Quest', results: [] },
  ]);
  assert.deepEqual(marks.map((m) => [m.at.getMonth(), m.outside, m.outsideCount]), [[5, true, 1], [1, false, 0]]);
});

test('severity is one colour, darker as it rises', () => {
  assert.ok(severityOpacity(1) < severityOpacity(5) && severityOpacity(5) < severityOpacity(10));
  assert.equal(severityOpacity(10), 1);
  assert.ok(severityOpacity(null) > 0, 'logged without a number still shows, lightly');
});

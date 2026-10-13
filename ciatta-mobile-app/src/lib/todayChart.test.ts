import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDay, chartKey, type DayChart, smooth, VIEW } from './todayChart';

const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m, 0);
const reading = (h: number, value: number) => ({ at: at(h), value });

// ── Ciatta does not draw a day it has not seen ───────────────────────

test('no readings means no chart, not an empty one', () => {
  assert.equal(buildDay({ readings: [], now: at(16) }), null);
});

test('one reading means no chart either', () => {
  // A line through a single point is a line Ciatta invented: it would have
  // to choose a direction, and it has no second reading to take one from.
  assert.equal(buildDay({ readings: [reading(9, 60)], now: at(16) }), null);
});

test('the curve stops at the last reading, not at now', () => {
  // The concept drew to now because its data went to now. Hers may not:
  // a watch taken off at lunch must not produce a line across the
  // afternoon she did not wear it.
  const d = buildDay({ readings: [reading(7, 50), reading(12, 60)], now: at(23) });
  assert.ok(d);
  const lastX = d.points[d.points.length - 1].x;
  assert.ok(lastX < d.nowX, 'the curve ran past the last reading');
  assert.ok(d.area.includes(`L${lastX.toFixed(2)},${VIEW.base}`), 'the wash closed somewhere other than the last reading');
});

test('every reading is on the curve, because the spline passes through them', () => {
  const d = buildDay({ readings: [reading(7, 40), reading(10, 70), reading(14, 55)], now: at(16) });
  assert.ok(d);
  for (const p of d.points) {
    assert.ok(d.line.includes(`${p.x.toFixed(2)},${p.y.toFixed(2)}`), 'a reading is not on the drawn line');
  }
});

// ── Scale ────────────────────────────────────────────────────────────

test('a flat day draws flat rather than dividing by zero', () => {
  const d = buildDay({ readings: [reading(8, 60), reading(12, 60), reading(16, 60)], now: at(17) });
  assert.ok(d);
  const ys = d.points.map((p) => p.y);
  assert.ok(ys.every((y) => Math.abs(y - ys[0]) < 0.01), 'a flat day was not drawn flat');
  assert.ok(ys.every((y) => Number.isFinite(y)));
});

test('her usual is pulled into the scale so the dashed line stays on the chart', () => {
  // Off the chart would read as her being off the scale rather than as the
  // chart being too small for the comparison it is making.
  const d = buildDay({ readings: [reading(8, 60), reading(12, 62)], usual: 40, now: at(13) });
  assert.ok(d?.usual);
  assert.ok(d.usual.y <= VIEW.base + 0.01 && d.usual.y >= VIEW.top - 0.01, 'the usual line left the chart');
  assert.equal(d.low, 40);
});

test('no usual means no dashed line, never a stand in', () => {
  // The line says "your usual". With no history to take one from there is
  // nothing honest to draw, and a population figure would be a different
  // claim wearing the same dashes.
  const d = buildDay({ readings: [reading(8, 60), reading(12, 62)], now: at(13) });
  assert.equal(d?.usual, null);
});

// ── Sleep and logs ───────────────────────────────────────────────────

test('the usual only spans the hours after she woke', () => {
  const d = buildDay({
    readings: [reading(8, 60), reading(12, 62)],
    asleep: [{ from: at(0), to: at(6, 30) }],
    usual: 61,
    now: at(13),
  });
  assert.ok(d?.usual);
  assert.ok(d.usual.from > 30, 'the usual was drawn across the night');
});

test('a sleep block crossing midnight is clipped to this day, not wrapped', () => {
  // Wrapped, it would draw sleep at both ends of one day.
  const d = buildDay({
    readings: [reading(8, 60), reading(12, 62)],
    asleep: [{ from: at(23), to: at(6) }],
    now: at(13),
  });
  assert.ok(d);
  assert.equal(d.asleep.length, 1);
  assert.ok(d.asleep[0].x >= 0 && d.asleep[0].x + d.asleep[0].width <= VIEW.w);
});

test('logged marks sit on the rail with severity as size, bounded', () => {
  const d = buildDay({
    readings: [reading(8, 60), reading(12, 62)],
    marks: [{ at: at(9), weight: 1 }, { at: at(15), weight: 99 }],
    now: at(16),
  });
  assert.ok(d);
  assert.equal(d.marks.length, 2);
  assert.ok(d.marks[0].r < d.marks[1].r, 'severity did not change the size');
  assert.ok(d.marks[1].r <= 4, 'a large severity swallowed the rail');
});

// ── The spline itself ────────────────────────────────────────────────

test('a spline of one point is nothing', () => {
  assert.equal(smooth([{ x: 1, y: 1 }]), '');
});

test('the path starts with a move and then only curves', () => {
  const d = smooth([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 2 }]);
  assert.ok(d.startsWith('M0.00,0.00'));
  assert.equal(d.match(/C/g)?.length, 2, 'one curve per gap between readings');
  assert.ok(!d.includes('L'), 'the smoothing fell back to straight lines');
});

const bare: DayChart = {
  line: '',
  area: '',
  points: [{ x: 0, y: 10 }],
  asleep: [],
  usual: null,
  nowX: 60,
  marks: [],
  low: 55,
  high: 80,
};

test('the key names only what is drawn', () => {
  assert.deepEqual(chartKey(bare), ['heartRate']);
  assert.deepEqual(
    chartKey({ ...bare, usual: { y: 12, from: 20, to: 60 }, asleep: [{ x: 0, width: 20 }], marks: [{ x: 40, r: 2 }] }),
    ['heartRate', 'usual', 'asleep', 'logged'],
  );
  // No history yet means no usual, so the key does not promise one.
  assert.deepEqual(chartKey({ ...bare, asleep: [{ x: 0, width: 20 }] }), ['heartRate', 'asleep']);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { closed, type Pt, smooth, smoothSegments } from './curve';

const pts = (...ys: number[]): Pt[] => ys.map((y, i) => ({ x: i * 10, y }));

// Every coordinate pair in a path, as numbers.
const coords = (d: string) => [...d.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])]);
// The points the curve is required to pass through are the ones ending
// each command: M's pair, and the last pair of each C.
const through = (d: string) => {
  const out: number[][] = [];
  for (const m of d.matchAll(/[MC]([^MCLZ]+)/g)) {
    const nums = m[1].trim().split(/[\s,]+/).map(Number);
    out.push([nums[nums.length - 2], nums[nums.length - 1]]);
  }
  return out;
};

// ── The curve passes through her readings ────────────────────────────

test('every point she recorded is on the curve', () => {
  // A curve that only approaches its points would draw a reading she
  // never had. That is inventing a number with geometry.
  const p = pts(10, 40, 20, 50);
  const got = through(smooth(p));
  assert.deepEqual(got, p.map((q) => [q.x, q.y]));
});

test('the path starts with a move and then only curves', () => {
  const d = smooth(pts(10, 40, 20));
  assert.ok(d.startsWith('M'));
  assert.ok(!d.includes('L'), 'a straight segment means a point was joined, not curved');
  assert.equal((d.match(/C/g) ?? []).length, 2);
});

test('fewer than two points is not a line', () => {
  assert.equal(smooth([]), '');
  assert.equal(smooth(pts(10)), '');
});

// ── It does not draw below what she recorded ─────────────────────────

test('a sharp drop does not overshoot past her lowest reading', () => {
  // At full tension the spline dips below the floor and draws a value
  // lower than anything she has.
  const p = pts(60, 60, 10, 10);
  const ys = coords(smooth(p)).map(([, y]) => y);
  const floor = Math.min(...p.map((q) => q.y));
  const ceiling = Math.max(...p.map((q) => q.y));
  // Control points may sit slightly outside, but not by a visible margin.
  assert.ok(Math.min(...ys) > floor - 3, `dipped to ${Math.min(...ys)} below ${floor}`);
  assert.ok(Math.max(...ys) < ceiling + 3, `rose to ${Math.max(...ys)} above ${ceiling}`);
});

// ── Gaps stay gaps ───────────────────────────────────────────────────

test('a hole in the series breaks the line rather than being curved across', () => {
  // A single spline across a missing week draws a confident line through
  // days with no reading, which is what the gap exists to say.
  const segs = smoothSegments([{ x: 0, y: 1 }, { x: 10, y: 2 }, null, { x: 30, y: 3 }, { x: 40, y: 4 }]);
  assert.equal(segs.length, 2);
  for (const d of segs) assert.ok(d.startsWith('M'));
});

test('a lone reading between two gaps draws no line', () => {
  // There is no line through one point, and a dot is the chart's job.
  assert.deepEqual(smoothSegments([null, { x: 10, y: 2 }, null]), []);
});

test('a series with no holes is one segment', () => {
  assert.equal(smoothSegments(pts(1, 2, 3)).length, 1);
});

test('an empty series draws nothing', () => {
  assert.deepEqual(smoothSegments([]), []);
  assert.deepEqual(smoothSegments([null, null]), []);
});

// ── The wash under the line ──────────────────────────────────────────

test('the closed path returns to the baseline and shuts', () => {
  const d = closed(pts(10, 20, 30), 100);
  assert.ok(d.endsWith('Z'));
  assert.ok(d.includes('100.00'), 'should reach the baseline');
  assert.ok(d.startsWith('M'));
});

test('a closed path needs a line to close', () => {
  assert.equal(closed(pts(10), 100), '');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trendOf } from './trend';

test('the line is her last seven readings, oldest first, skipping days with none', () => {
  const t = trendOf([40, null, 42, 44, 43, 45, 46, null, 47, 48], 'percent')!;
  assert.deepEqual(t.points, [42, 44, 43, 45, 46, 47, 48]);
});

test('the arrow compares the latest reading with the average of the ones before it', () => {
  // Earlier six average 50; 56 is 12% above.
  assert.equal(trendOf([48, 50, 52, 49, 51, 50, 56], 'percent')!.change, '↑ 12%');
  assert.equal(trendOf([80, 80, 80, 70], 'percent')!.change, '↓ 13%');
});

test('a change under two percent is level, not a direction', () => {
  assert.equal(trendOf([50, 50, 50, 50.5], 'percent')!.change, '→ 1%');
  assert.equal(trendOf([50, 50, 50, 50], 'percent')!.change, '→ 0%');
});

test('skin temperature changes in degrees, because a percent of a difference means nothing', () => {
  assert.equal(trendOf([0.1, 0.0, -0.1, 0.4], 'degrees')!.change, '↑ 0.4 °C');
  assert.equal(trendOf([0.2, 0.2, 0.2, 0.15], 'degrees')!.change, '→ 0.1 °C');
});

test('too few readings draw nothing rather than a line made of two points', () => {
  assert.equal(trendOf([50, 52], 'percent'), null);
  assert.equal(trendOf([null, null, 50, null, 52], 'percent'), null);
});

test('a change from a zero average says nothing rather than dividing by it', () => {
  const t = trendOf([0, 0, 0, 5], 'percent')!;
  assert.deepEqual(t.points, [0, 0, 0, 5]);
  assert.equal(t.change, null);
});

test('the spoken change says which way and from what', () => {
  assert.equal(trendOf([48, 50, 52, 49, 51, 50, 56], 'percent')!.spoken, 'up 12% from your recent average');
  assert.equal(trendOf([50, 50, 50, 50], 'percent')!.spoken, 'level with your recent average');
});

test('no change text carries a dash', () => {
  for (const t of [trendOf([3, 2, 1, 0.5], 'percent'), trendOf([0.3, 0.2, 0.1, -0.4], 'degrees')]) {
    assert.ok(!/[-–—]/.test(t!.change ?? ''), t!.change ?? '');
  }
});

test('with her usual known, the arrow measures against it, not the last few readings', () => {
  const t = trendOf([7, 7, 7, 6], 'percent', 8);
  assert.equal(t?.change, '↓ 25%');
  assert.equal(t?.spoken, 'down 25% from your usual');
  assert.deepEqual(t?.points, [7, 7, 7, 6]);
  assert.equal(trendOf([7, 7, 8.1], 'percent', 8)?.spoken, 'level with your usual');
});

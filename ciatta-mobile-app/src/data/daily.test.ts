import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, isoDay, sampleCycleStarts } from './cycleLog';
import { sampleDays } from './daily';

const NOW = new Date(2026, 8, 15);

test('every sample night has a temperature', () => {
  assert.ok(sampleDays(NOW).every((d) => typeof d.tempDeviation === 'number'));
});

test('temperature rises 12 days before each completed cycle ends', () => {
  const days = sampleDays(NOW);
  const byDate = new Map(days.map((d) => [d.date, d.tempDeviation!]));
  const starts = sampleCycleStarts(NOW);
  for (const next of starts.slice(1)) {
    const risen = byDate.get(isoDay(addDays(next, -12)))!;
    const before = [13, 14, 15, 16, 17, 18].map((n) => byDate.get(isoDay(addDays(next, -n)))!);
    const base = before.reduce((a, b) => a + b, 0) / before.length;
    assert.ok(risen >= base + 0.2, `rise before ${isoDay(next)}`);
  }
});

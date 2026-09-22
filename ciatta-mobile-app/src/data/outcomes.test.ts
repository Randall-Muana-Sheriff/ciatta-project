import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysFromRows } from './dailyRows';
import { walkOutcomes } from '../lib/engine';
import { measureOutcome, type ActionToMeasure, type MetricDayRow } from '../../supabase/functions/intelligence/outcomes';

const row = (day: string, steps: number | null, energy: number | null = null, extra: Partial<MetricDayRow> = {}): MetricDayRow => ({
  day,
  steps,
  sleep_hours: null,
  resting_hr: null,
  hrv: null,
  active_minutes: null,
  energy,
  ...extra,
});
const walk = (over: Partial<ActionToMeasure> = {}): ActionToMeasure => ({ id: 'a1', kind: 'walk', metric: 'steps', wanted: 'higher', started_on: '2026-09-10', ...over });

// Three low days, then three higher from the walk.
const DAYS = [
  row('2026-09-07', 3000, 2),
  row('2026-09-08', 3200, 2),
  row('2026-09-09', 2800, 1),
  row('2026-09-10', 4200, 3),
  row('2026-09-11', 4500, 3),
  row('2026-09-12', 4100, 2),
];

test('nothing is measured until the three days from the start have passed', () => {
  assert.equal(measureOutcome(walk(), DAYS, '2026-09-10'), null);
  assert.equal(measureOutcome(walk(), DAYS, '2026-09-12'), null);
  assert.notEqual(measureOutcome(walk(), DAYS, '2026-09-13'), null);
});

test('steps up by more than a tenth in the wanted direction is improved, with the windows and means as evidence', () => {
  const out = measureOutcome(walk(), DAYS, '2026-09-13')!;
  assert.equal(out.measured, 'improved');
  assert.deepEqual([out.evidence.before.from, out.evidence.before.to, out.evidence.before.n], ['2026-09-07', '2026-09-09', 3]);
  assert.deepEqual([out.evidence.after.from, out.evidence.after.to, out.evidence.after.n], ['2026-09-10', '2026-09-12', 3]);
  assert.equal(out.evidence.before.mean, 3000);
  assert.ok(Math.abs((out.evidence.ratio as number) - (4266.666 / 3000 - 1)) < 1e-3);
  assert.ok(Math.abs((out.evidence.energyDelta as number) - (8 / 3 - 5 / 3)) < 1e-9);
});

test('the same move against the wanted direction is worse, and a small move is unchanged', () => {
  assert.equal(measureOutcome(walk({ wanted: 'lower' }), DAYS, '2026-09-13')!.measured, 'worse');
  const flat = [row('2026-09-07', 3000), row('2026-09-08', 3100), row('2026-09-09', 2900), row('2026-09-10', 3050), row('2026-09-11', 3150), row('2026-09-12', 2950)];
  assert.equal(measureOutcome(walk(), flat, '2026-09-13')!.measured, 'unchanged');
});

test('resting heart rate wants lower by default when the action did not say', () => {
  const hr = [row('2026-09-07', null, null, { resting_hr: 66 }), row('2026-09-08', null, null, { resting_hr: 65 }), row('2026-09-09', null, null, { resting_hr: 67 }), row('2026-09-10', null, null, { resting_hr: 58 }), row('2026-09-11', null, null, { resting_hr: 57 }), row('2026-09-12', null, null, { resting_hr: 59 })];
  assert.equal(measureOutcome(walk({ kind: 'custom', metric: 'resting_hr', wanted: null }), hr, '2026-09-13')!.measured, 'improved');
});

test('a window with fewer than two readings is insufficient evidence, never a number', () => {
  const sparse = [row('2026-09-07', 3000), row('2026-09-10', 4200), row('2026-09-11', 4500), row('2026-09-12', 4100)];
  const out = measureOutcome(walk(), sparse, '2026-09-13')!;
  assert.equal(out.measured, 'insufficient_evidence');
  assert.equal(out.evidence.before.n, 1);
  assert.equal(out.evidence.ratio, null);
  assert.equal(measureOutcome(walk(), [], '2026-09-13')!.measured, 'insufficient_evidence');
});

test('an action with no measure named is unknown, and the energy delta is only for a walk with check ins on both sides', () => {
  const out = measureOutcome(walk({ metric: null, wanted: null }), DAYS, '2026-09-13')!;
  assert.equal(out.measured, 'unknown');
  assert.equal(out.evidence.metric, null);
  assert.ok(out.evidence.energyDelta != null, 'a walk keeps its energy delta even when nothing else is measured');
  const noEnergy = DAYS.map((d) => ({ ...d, energy: null }));
  assert.equal(measureOutcome(walk(), noEnergy, '2026-09-13')!.evidence.energyDelta, null);
  assert.equal(measureOutcome(walk({ kind: 'custom' }), DAYS, '2026-09-13')!.evidence.energyDelta, null);
});

test('cross check: the engine and the server agree on the steps ratio and the energy delta for one shared fixture', () => {
  const now = new Date(2026, 8, 13);
  const days = daysFromRows(
    DAYS.map((d) => ({ day: d.day, steps: d.steps, energy: d.energy })),
    now
  );
  const engine = walkOutcomes(days, [{ id: 'w', kind: 'walk', date: '2026-09-10' }]);
  assert.ok(engine, 'the engine found the walk');
  const supports = engine!.evidence.supports[0];
  const engineRatio = Number(/up (\d+)%/.exec(supports)![1]) / 100;
  const server = measureOutcome(walk(), DAYS, '2026-09-13')!;
  assert.equal(Math.round((server.evidence.ratio as number) * 100) / 100, Math.round(engineRatio * 100) / 100);
  const engineEnergy = Number(/energy up ([\d.]+)/.exec(supports)![1]);
  assert.equal(Math.round((server.evidence.energyDelta as number) * 10) / 10, engineEnergy);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { actionPlan, type PlanInput } from './actionPlan';

const NOW = new Date(2026, 9, 14, 9);
const day = (date: string, over: Partial<Day>): Day => ({
  date, sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});
const base: PlanInput = { days: [], usual: {}, cycle: null, loggedToday: false, visit: null, watchSuggested: false, walkSuggested: false, now: NOW };

test('nothing of hers yet: only the daily log, which is how a plan starts', () => {
  assert.deepEqual(actionPlan(base).map((i) => i.key), ['log']);
  assert.deepEqual(actionPlan({ ...base, loggedToday: true }), []);
});

test('short sleep against her own usual, with the reason in her numbers', () => {
  const plan = actionPlan({ ...base, days: [day('2026-10-14', { sleepHours: 6 })], usual: { sleep: 7.5 } });
  const item = plan.find((i) => i.key === 'sleep')!;
  assert.equal(item.title, 'Wind down earlier tonight');
  assert.equal(item.why, 'Last night 6h 00m, under your usual 7h 30m.');
  // Without her usual, nothing is said: a number alone is not a reason.
  assert.equal(actionPlan({ ...base, days: [day('2026-10-14', { sleepHours: 6 })] }).find((i) => i.key === 'sleep'), undefined);
});

test('HRV under her usual range, or resting heart rate over it, means a gentler day', () => {
  const low = actionPlan({ ...base, days: [day('2026-10-14', { hrv: 36 })], usual: { hrv: { low: 42, high: 55 } } });
  assert.equal(low.find((i) => i.key === 'recover')!.why, 'HRV 36 ms, under your usual range of 42 to 55 ms.');
  const high = actionPlan({ ...base, days: [day('2026-10-14', { restingHR: 70 })], usual: { rhr: { low: 56, high: 64 } } });
  assert.equal(high.find((i) => i.key === 'recover')!.why, 'Resting heart rate 70 bpm, over your usual range of 56 to 64 bpm.');
});

test('a quiet yesterday suggests a walk', () => {
  const plan = actionPlan({ ...base, days: [day('2026-10-13', { steps: 2100 })], usual: { steps: 7800 } });
  assert.equal(plan.find((i) => i.key === 'walk')!.why, 'Yesterday 2,100 steps, well under your usual 7,800.');
});

test('the cycle: products ready before a likely period, and logging during one', () => {
  const before = actionPlan({ ...base, cycle: { day: 27, usualLength: 29, bleeding: false } });
  assert.equal(before.find((i) => i.key === 'period')!.why, 'Your period is likely in about 2 days, from your usual 29 day cycle.');
  const during = actionPlan({ ...base, cycle: { day: 2, usualLength: 29, bleeding: true } });
  assert.equal(during.find((i) => i.key === 'flow')!.title, 'Log today’s flow and any pain');
  assert.equal(actionPlan({ ...base, cycle: { day: 12, usualLength: 29, bleeding: false } }).find((i) => i.key === 'period'), undefined);
});

test('a visit coming up comes first; at most four items; the log last', () => {
  const plan = actionPlan({
    ...base,
    days: [day('2026-10-14', { sleepHours: 5, hrv: 30 }), day('2026-10-13', { steps: 1000 })],
    usual: { sleep: 7.5, hrv: { low: 42, high: 55 }, steps: 8000 },
    cycle: { day: 27, usualLength: 29, bleeding: false },
    visit: { title: 'Dr Patel', when: 'Tomorrow, 9 am' },
  });
  assert.equal(plan[0].key, 'visit');
  assert.equal(plan[0].title, 'Prepare for Dr Patel');
  assert.equal(plan.length, 4);
  assert.ok(!plan.some((i) => i.key === 'log'), 'the log gives way when the plan is full');
});

test('nothing in the plan tells her to take, start or stop anything', () => {
  const plan = actionPlan({
    ...base,
    days: [day('2026-10-14', { sleepHours: 5, hrv: 30 }), day('2026-10-13', { steps: 1000 })],
    usual: { sleep: 7.5, hrv: { low: 42, high: 55 }, steps: 8000 },
    cycle: { day: 2, usualLength: 29, bleeding: true },
    watchSuggested: true,
  });
  for (const i of plan) assert.ok(!/\b(take|start|stop|supplement|medication|diagnos)/i.test(`${i.title} ${i.why}`), i.title);
});

test('preparing for an appointment only when the intelligence finds something worth raising', () => {
  assert.equal(actionPlan(base).find((i) => i.key === 'prepare'), undefined, 'not a fixture of every day');
  const plan = actionPlan({ ...base, raise: 'Pain lasting longer with shorter cycles' });
  const item = plan.find((i) => i.key === 'prepare')!;
  assert.equal(item.title, 'Prepare for your next appointment');
  assert.equal(item.why, 'Pain lasting longer with shorter cycles is worth raising. A brief gathers what your record shows.');
  // A visit already on her calendar is the better prompt; one, not two.
  const both = actionPlan({ ...base, raise: 'Pain lasting longer', visit: { title: 'Dr Patel', when: 'Tomorrow, 9 am' } });
  assert.deepEqual(both.filter((i) => i.key === 'visit' || i.key === 'prepare').map((i) => i.key), ['visit']);
});

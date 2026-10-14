import assert from 'node:assert/strict';
import { test } from 'node:test';

import { logNeeds } from './logNeeds';

const base = { symptomsToday: false, cycleToday: false, mealsToday: 0, cycle: null, frequent: [] as string[] };
const at = (h: number) => new Date(2026, 9, 15, h, 0);

test('asks only for what is missing today, most needed first', () => {
  const n = logNeeds({ ...base, cycle: { day: 2, usualLength: 29, bleeding: true }, frequent: ['Fatigue', 'Bloating', 'Headache'], now: at(11) });
  assert.deepEqual(n.map((x) => x.key), ['cycle', 'symptoms', 'nutrition']);
  assert.equal(n[0].prompt, 'Day 2 of your period. How is the flow today?');
  assert.deepEqual(n[0].chips, ['Light', 'Moderate', 'Heavy', 'Spotting']);
  assert.equal(n[1].prompt, 'How are you feeling today?');
  assert.deepEqual(n[1].chips, ['Fatigue', 'Bloating', 'Headache', 'Pain'], 'her own symptoms first');
  assert.equal(n[2].prompt, 'Nothing logged to eat yet today. What have you had?');
});

test('what she already logged today is not asked again', () => {
  const n = logNeeds({ ...base, symptomsToday: true, mealsToday: 1, cycle: { day: 12, usualLength: 29, bleeding: false }, now: at(11) });
  assert.deepEqual(n, [], 'mid cycle, symptoms logged, breakfast logged: nothing to ask at 11am');
});

test('the cycle is asked about only when it matters: during a period, or when one is due', () => {
  assert.equal(logNeeds({ ...base, symptomsToday: true, mealsToday: 3, cycle: { day: 12, usualLength: 29, bleeding: false }, now: at(20) }).length, 0);
  const due = logNeeds({ ...base, symptomsToday: true, mealsToday: 3, cycle: { day: 28, usualLength: 29, bleeding: false }, now: at(20) });
  assert.equal(due[0].prompt, 'Your period is due around now. Has it started?');
  assert.deepEqual(due[0].chips, ['Period', 'Spotting']);
  // Logged already today: not asked.
  assert.equal(logNeeds({ ...base, symptomsToday: true, mealsToday: 3, cycleToday: true, cycle: { day: 2, usualLength: 29, bleeding: true }, now: at(20) }).length, 0);
});

test('food follows the time of day', () => {
  const food = (meals: number, h: number) => logNeeds({ ...base, symptomsToday: true, mealsToday: meals, now: at(h) }).find((x) => x.key === 'nutrition')?.prompt ?? null;
  assert.equal(food(0, 8), null, 'too early to ask');
  assert.equal(food(1, 15), 'Anything since breakfast? Lunch, a snack, a coffee?');
  assert.equal(food(2, 20), 'What did you have this evening?');
  assert.equal(food(3, 20), null);
});

test('each quick chip saves as the record reads it: a flow as a period with that flow, a symptom under its own category', async () => {
  const { planSave } = await import('./quickLog');
  const heavy = planSave({ text: 'Period, heavy flow', selected: 'cycle', tapped: [], files: [] })!;
  assert.deepEqual(heavy.episode!.kinds, ['Period']);
  assert.equal(heavy.episode!.flow, 'Heavy');
  const spotting = planSave({ text: '', selected: 'cycle', tapped: ['Spotting'], files: [] })!;
  assert.deepEqual(spotting.episode!.kinds, ['Spotting']);
  const fatigue = planSave({ text: '', selected: 'symptoms', tapped: ['Fatigue'], files: [], byCategory: { body: ['Fatigue'] } })!;
  assert.deepEqual(fatigue.journal!.items, { body: ['Fatigue'] });
  const coffee = planSave({ text: '', selected: 'nutrition', tapped: ['Caffeine'], files: [] })!;
  assert.deepEqual(coffee.journal!.items, { nutrition: ['Caffeine'] });
});

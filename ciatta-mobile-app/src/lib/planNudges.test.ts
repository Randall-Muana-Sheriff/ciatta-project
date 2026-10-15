import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planNudges } from './planNudges';

const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);
const ev = (h1: number, h2: number) => ({ id: `e${h1}`, title: 'Busy', start: at(h1), end: at(h2), location: null, notes: null, allDay: false });
const item = (key: string, title: string) => ({ key, title, why: 'because' }) as never;

test('each plan item is timed into a free gap in her day, at most three, a couple of hours apart', () => {
  const out = planNudges([item('walk', 'Try a short walk today'), item('recover', 'Keep today gentle'), item('log', 'Tell Ciatta how today went'), item('sleep', 'Wind down earlier tonight')], [ev(9, 12), ev(13, 15)], at(8, 30));
  assert.equal(out.length, 3);
  for (const n of out) assert.ok(n.at >= at(8, 30) && n.at.getHours() < 21, n.at.toString());
  // Never during an event.
  for (const n of out) assert.ok(!(n.at >= at(9) && n.at < at(12)) && !(n.at >= at(13) && n.at < at(15)), n.at.toString());
  const times = out.map((n) => n.at.getTime()).sort();
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 2 * 3600000);
});

test('winding down is suggested in the evening', () => {
  const [n] = planNudges([item('sleep', 'Wind down earlier tonight')], [], at(10));
  assert.equal(n.at.getHours(), 20);
  assert.equal(n.at.getMinutes(), 30);
});

test('the lock screen shows only the plan, never her readings', () => {
  const [n] = planNudges([item('walk', 'Try a short walk today')], [], at(10));
  assert.equal(n.title, 'Ciatta');
  assert.equal(n.body, 'Try a short walk today');
  assert.match(n.id, /^plan:walk:/);
});

test('nothing is scheduled in the past, and a full day gets nothing', () => {
  assert.deepEqual(planNudges([item('walk', 'Walk')], [], at(21, 30)), []);
  assert.deepEqual(planNudges([item('walk', 'Walk')], [ev(9, 21)], at(8, 50)), []);
});

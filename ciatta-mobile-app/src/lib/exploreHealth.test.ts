import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXPLORE_TOPICS, exploreTopic } from './exploreHealth';

const lab = (name: string, value: number, unit: string, low: number, high: number, on: string) =>
  ({ id: name, name, value, valueText: null, unit, low, high, rangeText: null, flag: null, status: 'final', on }) as never;

const ctx = {
  labs: [lab('Ferritin', 12, 'ng/mL', 15, 150, '2026-10-03'), lab('LDL cholesterol', 90, 'mg/dL', 0, 100, '2026-09-01'), lab('AMH', 2.1, 'ng/mL', 1, 4, '2026-08-01')],
  symptoms: [{ name: 'Fatigue', group: 'Energy', days: 6, last: '2026-10-14', worst: null, versus: null }, { name: 'Pelvic pain', group: 'Pain', days: 1, last: '2026-10-10', worst: null, versus: null }],
  readings: [{ key: 'sleep_hours', label: 'Sleep', latest: '5.5 h', usual: '6.8 to 8.1 h', side: 'below' as const, daysOutside: 4 }],
  cycle: { day: 12, phase: 'Likely follicular' },
};

test('the topics, in the order the row shows them', () => {
  assert.deepEqual(EXPLORE_TOPICS.slice(0, 4).map((t) => t.label), ['Fertility', 'Cycle', 'Pregnancy & postpartum', 'Sleep & fatigue']);
  assert.equal(new Set(EXPLORE_TOPICS.map((t) => t.key)).size, EXPLORE_TOPICS.length);
});

test('sleep and fatigue gathers her sleep against her usual, fatigue she logged, and the labs behind tiredness', () => {
  const out = exploreTopic('sleep', ctx as never, []);
  assert.deepEqual(out.lines, [
    'Sleep has been below your usual of 6.8 to 8.1 h on 4 days, latest 5.5 h.',
    'Ferritin was low, 12 ng/mL on 3 Oct.',
    'You logged fatigue on 6 days in the last 90.',
  ]);
});

test('fertility reads her cycle and fertility labs', () => {
  const out = exploreTopic('fertility', ctx as never, []);
  assert.deepEqual(out.lines, ['Today is day 12 of your cycle, likely follicular.', 'AMH was within range, 2.1 ng/mL on 1 Aug.']);
});

test('a condition on her record is named under its topic', () => {
  const out = exploreTopic('cycle', ctx as never, ['Endometriosis']);
  assert.ok(out.lines.includes('Endometriosis is on your record.'));
});

test('a symptom logged once is not yet a pattern worth saying', () => {
  assert.ok(!exploreTopic('cycle', ctx as never, []).lines.some((l) => /pelvic pain/i.test(l)));
});

test('nothing on her record for a topic says so, never invents', () => {
  const out = exploreTopic('pregnancy', { labs: [], symptoms: [], readings: [], cycle: null } as never, []);
  assert.deepEqual(out.lines, []);
  assert.equal(out.empty, 'Nothing in your record speaks to pregnancy and postpartum yet. Ask Ciatta, or tell it what is going on.');
});

test('each topic says which pattern insights belong to it, and what to ask Ciatta', () => {
  const out = exploreTopic('sleep', ctx as never, []);
  assert.deepEqual(out.insightTopics, ['sleep', 'energy']);
  assert.equal(out.ask, 'Explore my sleep and fatigue: what in my record stands out?');
});

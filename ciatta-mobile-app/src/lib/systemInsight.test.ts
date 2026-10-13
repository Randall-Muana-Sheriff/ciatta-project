import assert from 'node:assert/strict';
import { test } from 'node:test';

import { systemInsight } from './systemInsight';

const NOW = new Date(2026, 9, 14, 12);
const sig = (daysAgo: number, locations: string[], phase: string | null, symptoms: string[] = []) => ({
  date: new Date(2026, 9, 14 - daysAgo),
  phase,
  pain: locations.length > 0,
  episode: { date: `d${daysAgo}`, locations, symptoms, kinds: locations.length ? ['Pain'] : ['Symptoms'] },
});

test('one sentence from her own logs: how often, against the month before, and when in her cycle', () => {
  const signals = [
    sig(2, ['Lower abdomen'], 'Before period'),
    sig(5, ['Lower abdomen'], 'Before period'),
    sig(9, ['Pelvis'], 'Before period'),
    sig(20, ['Lower abdomen'], 'During period'),
    sig(40, ['Lower abdomen'], 'Before period'),
  ];
  assert.equal(
    systemInsight({ regions: ['pelvis', 'lower_abdomen'], whole: false, points: [], signals, now: NOW }),
    'Logged on 4 days this month, up from 1 the month before, 3 of them in the days before your period.',
  );
});

test('the whole body counts symptoms without a place; too little says nothing new', () => {
  const signals = [sig(1, [], null, ['Night sweats']), sig(3, [], null, ['Night sweats'])];
  assert.equal(systemInsight({ regions: ['systemic'], whole: true, points: [], signals, now: NOW }), 'Logged on 2 days this month, up from none the month before.');
  assert.equal(systemInsight({ regions: ['systemic'], whole: true, points: [], signals: signals.slice(0, 1), now: NOW }), null);
});

test('without logs, the newest measured or lab point in a few words', () => {
  const points = [{ title: 'Thyroid result within range', detail: 'TSH was 2.1 on 12 Mar, against a range of 0.4 to 4.0.', source: 'Lab' }];
  assert.equal(systemInsight({ regions: ['neck'], whole: false, points: points as never, signals: [], now: NOW }), 'TSH was 2.1 on 12 Mar, against a range of 0.4 to 4.0.');
  assert.equal(systemInsight({ regions: ['neck'], whole: false, points: [], signals: [], now: NOW }), null);
});

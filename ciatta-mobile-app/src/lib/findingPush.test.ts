import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findingPush } from '../../supabase/functions/intelligence/push.ts';

const TOKENS = ['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]'];
const OCT = new Date(2026, 9, 13);

test('one push per device when something new or changed was found', () => {
  const msgs = findingPush(TOKENS, ['new', 'continuing'], true, OCT);
  assert.equal(msgs.length, 2);
  assert.deepEqual(msgs[0], {
    to: 'ExponentPushToken[aaa]',
    title: 'Ciatta',
    body: 'Something changed in October. Open Ciatta to see it.',
    data: { screen: 'evidence' },
    sound: 'default',
  });
});

test('nothing new or changed sends nothing', () => {
  assert.deepEqual(findingPush(TOKENS, ['continuing'], true, OCT), []);
});

test('she turned new findings off: nothing is sent', () => {
  assert.deepEqual(findingPush(TOKENS, ['new'], false, OCT), []);
});

test('the lock screen never shows anything about her health', () => {
  for (const m of findingPush(TOKENS, ['new', 'updated'], true, OCT)) {
    assert.ok(!/(sleep|heart|period|cycle|pain|symptom|bleed|hrv|weight|mood)/i.test(`${m.title} ${m.body}`), m.body);
    assert.ok(!/[-–—]/.test(m.body), m.body);
  }
});

test('only well formed Expo tokens are sent to', () => {
  assert.equal(findingPush(['not-a-token', 'ExponentPushToken[ok]'], ['new'], true, OCT).length, 1);
});

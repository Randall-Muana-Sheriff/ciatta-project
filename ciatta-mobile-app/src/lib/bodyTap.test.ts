import assert from 'node:assert/strict';
import { test } from 'node:test';

import { painItemFor, regionAt } from './bodyTap';

test('a tap on the front finds the nearest place on the body', () => {
  assert.equal(regionAt(50, 49, 0), 'pelvis');
  assert.equal(regionAt(50, 43, 0), 'lower_abdomen');
  assert.equal(regionAt(50, 8, 0), 'head');
  assert.equal(regionAt(32, 46, 0), 'hip_right');
});

test('a tap far from the body is not a place', () => {
  assert.equal(regionAt(5, 95, 0), null);
});

test('on the back, the middle of the body is the back', () => {
  assert.equal(regionAt(50, 25, 2), 'upper_back');
  assert.equal(regionAt(50, 42, 2), 'lower_back');
  assert.equal(regionAt(50, 8, 2), 'head');
});

test('on a side view, the height on the body decides', () => {
  assert.equal(regionAt(50, 48, 1), 'pelvis');
  assert.equal(regionAt(50, 72, 3), 'knee_left');
});

test('what a pain there is logged as', () => {
  assert.deepEqual(painItemFor('pelvis'), { items: ['Pain', 'Pelvic pain'], place: 'pelvis' });
  assert.deepEqual(painItemFor('lower_abdomen'), { items: ['Pain', 'Pelvic pain'], place: 'lower abdomen' });
  assert.deepEqual(painItemFor('lower_back'), { items: ['Pain', 'Lower back pain'], place: 'lower back' });
  assert.deepEqual(painItemFor('head'), { items: ['Headache'], place: 'head' });
  assert.deepEqual(painItemFor('knee_left'), { items: ['Pain', 'Joint pain'], place: 'left leg' });
});

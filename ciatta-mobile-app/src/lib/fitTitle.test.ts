import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitTitle } from './fitTitle';

test('a short greeting keeps the large title size', () => {
  assert.equal(fitTitle('Good morning, Maya', 361), 34);
});

test('a long greeting shrinks to fit one row on a narrow phone', () => {
  const size = fitTitle('Good afternoon, Alexandra', 343);
  assert.ok(size < 34 && size >= 20, String(size));
  // The row it needs at that size fits the width.
  assert.ok('Good afternoon, Alexandra'.length * size * 0.56 <= 343);
});

test('it never drops below a readable floor', () => {
  assert.equal(fitTitle('Good afternoon, Bartholomew-Alexandrina', 300), 20);
});

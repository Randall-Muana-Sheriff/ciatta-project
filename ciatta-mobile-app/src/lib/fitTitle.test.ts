import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitTitle, PER_CHAR } from './fitTitle';

test('a short greeting keeps the title size', () => {
  assert.equal(fitTitle('Good morning, Maya', 361), 28);
});

test('a long greeting shrinks so the whole name fits one row on a narrow phone', () => {
  const text = 'Good afternoon, Alexandra';
  for (const width of [288, 343, 361]) {
    const size = fitTitle(text, width);
    assert.ok(size <= 28 && size >= 16, String(size));
    assert.ok(text.length * size * PER_CHAR <= width, `${width}: ${size}`);
  }
});

test('it never drops below a readable floor', () => {
  assert.equal(fitTitle('Good afternoon, Bartholomew-Alexandrina', 260), 16);
});

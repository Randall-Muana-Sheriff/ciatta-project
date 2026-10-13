import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chooseLogCategory, chooseLogMode, takeLogCategory, takeLogMode } from './logHandoff';

test('a log opened from a button carries its category and its way in, read once', () => {
  chooseLogCategory('cycle');
  chooseLogMode('voice');
  assert.equal(takeLogCategory(), 'cycle');
  assert.equal(takeLogMode(), 'voice');
  // The next plain visit opens on symptoms, in the box, with nothing started.
  assert.equal(takeLogCategory(), null);
  assert.equal(takeLogMode(), null);
});

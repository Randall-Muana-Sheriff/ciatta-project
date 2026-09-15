import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avatarInitial } from './initial';

test('her initial comes from her own name', () => {
  assert.equal(avatarInitial('Ada'), 'A');
  assert.equal(avatarInitial('  maya '), 'M');
  assert.equal(avatarInitial('ástrid'), 'Á');
});

test('no name means no letter, so the circle shows a neutral glyph', () => {
  assert.equal(avatarInitial(null), null);
  assert.equal(avatarInitial(undefined), null);
  assert.equal(avatarInitial('   '), null);
  assert.equal(avatarInitial('. '), null);
});

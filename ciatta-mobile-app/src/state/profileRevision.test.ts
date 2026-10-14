import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bumpProfile, onProfileChange, profileRevision } from './profileRevision';

test('a change to her profile is announced to everything listening, once each', () => {
  const start = profileRevision();
  let heard = 0;
  const stop = onProfileChange(() => (heard += 1));
  bumpProfile();
  bumpProfile();
  assert.equal(heard, 2);
  assert.equal(profileRevision(), start + 2);
  stop();
  bumpProfile();
  assert.equal(heard, 2, 'no longer listening');
});

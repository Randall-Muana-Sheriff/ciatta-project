import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handPhoto, takePhoto } from './scanHandoff';

test('the scan screen takes the photo once, and a later screen finds nothing stale', () => {
  handPhoto('file:///a.jpg');
  assert.equal(takePhoto(), 'file:///a.jpg');
  assert.equal(takePhoto(), null);
});

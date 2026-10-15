import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isScannerAvailable, scanDocument } from '../../modules/document-scanner';

test('without the native scanner (Android, web, tests) the scan option is unavailable and scanning returns nothing', async () => {
  assert.equal(isScannerAvailable(), false);
  assert.equal(await scanDocument(), null);
});

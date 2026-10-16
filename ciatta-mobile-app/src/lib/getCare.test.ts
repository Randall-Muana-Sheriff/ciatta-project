import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GET_CARE } from './getCare';

test('Get care lists the five, in the order the row shows them', () => {
  assert.deepEqual(GET_CARE.map((g) => g.label), ['Report symptom', 'Get lab tests', 'Consult doctor', 'Request prescription', 'Get diagnosed']);
});

test('each opens the chat: Report symptom with Ciatta asking, the rest with her question asked', () => {
  const report = GET_CARE[0];
  assert.equal(report.ask, null);
  assert.match(report.opener!, /what you are feeling/i);
  for (const g of GET_CARE.slice(1)) {
    assert.ok(g.ask && g.ask.length > 10, g.label);
    assert.equal(g.opener, null, g.label);
  }
});

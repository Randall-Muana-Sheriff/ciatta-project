import assert from 'node:assert/strict';
import { test } from 'node:test';

import { askCare, onCareAsk, takeCareAsk } from './careHandoff';

test('a prompt handed to Care is delivered once, to a listener or to the next read', () => {
  askCare('Review my gut health: what stands out?');
  assert.equal(takeCareAsk(), 'Review my gut health: what stands out?');
  assert.equal(takeCareAsk(), null);
  const heard: string[] = [];
  const off = onCareAsk((p) => heard.push(p));
  askCare('Review my skin health');
  assert.deepEqual(heard, ['Review my skin health']);
  assert.equal(takeCareAsk(), null, 'a listener took it, so it is not delivered twice');
  off();
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { askCare, onCareAsk, takeCareAsk } from './careHandoff';

test('a prompt handed to Care is delivered once, to a listener or to the next read', () => {
  askCare('Review my gut health: what stands out?');
  assert.deepEqual(takeCareAsk(), { prompt: 'Review my gut health: what stands out?', files: [] });
  assert.equal(takeCareAsk(), null);
  const heard: string[] = [];
  const off = onCareAsk((p) => heard.push(p));
  askCare('Review my skin health');
  assert.deepEqual(heard, ['Review my skin health']);
  assert.equal(takeCareAsk(), null, 'a listener took it, so it is not delivered twice');
  off();
});

test('what she attached in the box on Today travels with the message she sent', () => {
  const photo = { id: 'a1', kind: 'image', name: 'Meal.jpg', uri: 'file:///meal.jpg' } as never;
  askCare('Lunch today', [photo]);
  assert.deepEqual(takeCareAsk(), { prompt: 'Lunch today', files: [photo] });
  assert.equal(takeCareAsk(), null);
});

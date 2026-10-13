import assert from 'node:assert/strict';
import { test } from 'node:test';

import { insuranceFact, insuranceFromInput, maskedMemberId } from './insurance';

test('an insurer is required; plan and member ID are optional and trimmed', () => {
  assert.deepEqual(insuranceFromInput({ provider: '  Anthem ', plan: ' PPO ', memberId: '' }), { provider: 'Anthem', plan: 'PPO' });
  assert.deepEqual(insuranceFromInput({ provider: 'Aetna', plan: '', memberId: ' W123456789 ' }), { provider: 'Aetna', member_id: 'W123456789' });
  assert.deepEqual(insuranceFromInput({ provider: '  ', plan: 'PPO', memberId: '' }), { error: 'Add the name of your insurer.' });
  assert.deepEqual(insuranceFromInput({ provider: 'x'.repeat(121), plan: '', memberId: '' }), { error: 'That name is too long.' });
});

test('the overview shows the insurer and plan, never the member ID', () => {
  assert.deepEqual(insuranceFact({ provider: 'Anthem', plan: 'PPO', member_id: 'XJ12345' }), { label: 'Insurance', value: 'Anthem', sub: 'PPO' });
  assert.deepEqual(insuranceFact({ provider: 'Anthem' }), { label: 'Insurance', value: 'Anthem' });
  assert.equal(insuranceFact(null), null);
});

test('a member ID is shown only by its last four', () => {
  assert.equal(maskedMemberId('XJ1234567'), 'Ending 4567');
  assert.equal(maskedMemberId('12'), 'Ending 12');
  assert.equal(maskedMemberId(undefined), null);
});

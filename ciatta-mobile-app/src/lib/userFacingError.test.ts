import assert from 'node:assert/strict';
import { test } from 'node:test';

import { userFacingError } from './userFacingError';

test('technical failures never reach the screen', () => {
  assert.equal(userFacingError(new Error('PGRST301 JWT expired'), 'That did not save.'), 'That did not save.');
  assert.equal(userFacingError({ message: 'new row violates row-level security policy' }, 'That did not save.'), 'That did not save.');
});

test('a lost connection says what to do', () => {
  assert.equal(userFacingError(new Error('Network request failed'), 'x'), 'Check your connection and try again.');
});

test('a cancel is not an error', () => {
  assert.equal(userFacingError(new Error('The user canceled the sign in'), 'x'), '');
});

test('fallback copy has no dashes', () => {
  assert.equal(userFacingError('', 'Sign in did not finish — try again.').includes('—'), false);
});

test('an unmapped backend message never reaches the screen', () => {
  assert.equal(
    userFacingError(
      new Error('duplicate key value violates unique constraint "episodes_user_id_client_id_key"'),
      'That did not save.'
    ),
    'That did not save.'
  );
});

test('an unmapped plain message still falls back', () => {
  assert.equal(userFacingError(new Error('Something odd happened'), 'That did not save.'), 'That did not save.');
});

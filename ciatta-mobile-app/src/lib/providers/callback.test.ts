import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appTarget } from '../../../supabase/functions/provider-callback/bounce.ts';

test('the code and state are handed to the app unchanged', () => {
  const out = appTarget('https://x.supabase.co/functions/v1/provider-callback?code=abc.def&state=s1');
  assert.equal(out, 'ciatta://provider-callback?code=abc.def&state=s1');
});

test('a refusal is passed on so the app can say so', () => {
  const out = appTarget('https://x.supabase.co/functions/v1/provider-callback?error=access_denied&error_description=No&state=s1');
  assert.equal(out, 'ciatta://provider-callback?error=access_denied&error_description=No&state=s1');
});

test('nothing but the OAuth answer is forwarded', () => {
  const out = appTarget('https://x.supabase.co/functions/v1/provider-callback?code=a&state=b&next=https%3A%2F%2Fevil.example');
  assert.equal(out, 'ciatta://provider-callback?code=a&state=b');
});

test('a visit with no answer still lands in the app, empty', () => {
  assert.equal(appTarget('https://x.supabase.co/functions/v1/provider-callback'), 'ciatta://provider-callback');
});

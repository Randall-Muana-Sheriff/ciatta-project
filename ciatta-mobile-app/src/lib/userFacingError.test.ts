import { assertEquals } from 'jsr:@std/assert@1';
import { userFacingError } from './userFacingError.ts';

const FALLBACK = 'Something went wrong. Try again.';

Deno.test('userFacingError never prints backend, oauth, or stack details', () => {
  assertEquals(
    userFacingError({ message: 'column understandings.seeing does not exist', code: '42703' }, FALLBACK),
    FALLBACK
  );
  assertEquals(userFacingError('PGRST303: JWT issued at future', FALLBACK), FALLBACK);
  assertEquals(
    userFacingError(new Error('redirect_uri_mismatch for com.ciatta.mobileapp'), FALLBACK),
    FALLBACK
  );
  assertEquals(
    userFacingError('Error: boom\n    at signInWithGoogle (socialAuth.ts:126:11)', FALLBACK),
    FALLBACK
  );
});

Deno.test('userFacingError maps common auth failures to short copy', () => {
  assertEquals(
    userFacingError('Invalid login credentials', FALLBACK),
    'That email or password did not match.'
  );
  assertEquals(
    userFacingError('User already registered', FALLBACK),
    'That account already exists. Sign in instead.'
  );
  assertEquals(userFacingError('Network request failed', FALLBACK), 'Check your connection and try again.');
});

Deno.test('userFacingError swallows a deliberate cancel', () => {
  assertEquals(userFacingError('The user cancelled the request', FALLBACK), '');
});

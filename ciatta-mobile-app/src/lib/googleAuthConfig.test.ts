import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GOOGLE_IOS_URL_SCHEME,
  googleIosClientIdFromScheme,
  isPlaceholderGoogleClientId,
  resolvedGoogleClientIds,
} from './googleAuthConfig';

test('ios URL scheme reverses to the iOS client id used by Google Sign In', () => {
  assert.equal(
    googleIosClientIdFromScheme(GOOGLE_IOS_URL_SCHEME),
    '326095655806-po3vgir44qdql8s6a6ibfg1frej4am64.apps.googleusercontent.com'
  );
});

test('placeholder env values fall back to the scheme client id', () => {
  const resolved = resolvedGoogleClientIds({
    webClientId: 'your-web-client-id.apps.googleusercontent.com',
    iosClientId: 'your-ios-client-id.apps.googleusercontent.com',
  });
  assert.equal(
    resolved?.iosClientId,
    '326095655806-po3vgir44qdql8s6a6ibfg1frej4am64.apps.googleusercontent.com'
  );
  assert.equal(resolved?.webClientId, resolved?.iosClientId);
});

test('configured client ids from the iOS scheme are not placeholders', () => {
  const ios = googleIosClientIdFromScheme(GOOGLE_IOS_URL_SCHEME);
  assert.equal(isPlaceholderGoogleClientId(ios ?? undefined), false);
  const resolved = resolvedGoogleClientIds({ webClientId: ios ?? undefined, iosClientId: ios ?? undefined });
  assert.equal(resolved?.webClientId, ios);
  assert.equal(resolved?.iosClientId, ios);
});

test('real env web client is preferred for the ID token audience', () => {
  const resolved = resolvedGoogleClientIds({
    webClientId: '123-abc.apps.googleusercontent.com',
    iosClientId: 'your-ios-client-id.apps.googleusercontent.com',
  });
  assert.equal(resolved?.webClientId, '123-abc.apps.googleusercontent.com');
  assert.equal(isPlaceholderGoogleClientId('123-abc.apps.googleusercontent.com'), false);
});

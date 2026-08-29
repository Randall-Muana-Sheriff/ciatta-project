import { assertEquals } from 'jsr:@std/assert@1';
import {
  GOOGLE_IOS_URL_SCHEME,
  googleIosClientIdFromScheme,
  isPlaceholderGoogleClientId,
  resolvedGoogleClientIds,
} from './googleAuthConfig.ts';

Deno.test('ios URL scheme reverses to the iOS client id used by Google Sign In', () => {
  assertEquals(
    googleIosClientIdFromScheme(GOOGLE_IOS_URL_SCHEME),
    '326095655806-po3vgir44qdql8s6a6ibfg1frej4am64.apps.googleusercontent.com'
  );
});

Deno.test('placeholder env values fall back to the scheme client id', () => {
  const resolved = resolvedGoogleClientIds({
    webClientId: 'your-web-client-id.apps.googleusercontent.com',
    iosClientId: 'your-ios-client-id.apps.googleusercontent.com',
  });
  assertEquals(
    resolved?.iosClientId,
    '326095655806-po3vgir44qdql8s6a6ibfg1frej4am64.apps.googleusercontent.com'
  );
  assertEquals(resolved?.webClientId, resolved?.iosClientId);
});

Deno.test('configured client ids from the iOS scheme are not placeholders', () => {
  const ios = googleIosClientIdFromScheme(GOOGLE_IOS_URL_SCHEME);
  assertEquals(isPlaceholderGoogleClientId(ios ?? undefined), false);
  const resolved = resolvedGoogleClientIds({ webClientId: ios ?? undefined, iosClientId: ios ?? undefined });
  assertEquals(resolved?.webClientId, ios);
  assertEquals(resolved?.iosClientId, ios);
});

Deno.test('real env web client is preferred for the ID token audience', () => {
  const resolved = resolvedGoogleClientIds({
    webClientId: '123-abc.apps.googleusercontent.com',
    iosClientId: 'your-ios-client-id.apps.googleusercontent.com',
  });
  assertEquals(resolved?.webClientId, '123-abc.apps.googleusercontent.com');
  assertEquals(isPlaceholderGoogleClientId('123-abc.apps.googleusercontent.com'), false);
});

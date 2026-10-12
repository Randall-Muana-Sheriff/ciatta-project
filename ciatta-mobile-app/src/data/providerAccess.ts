// The client id Ciatta presents to a provider, and where it comes from.
//
// It is public by design. SMART public clients prove themselves with
// PKCE, not a secret, so this value is readable by anyone who downloads
// the app and that is the intended arrangement. Nothing here is a
// credential, and nothing secret may ever be stored through this file.
//
// Two sources, in order:
//
//   The build, through EXPO_PUBLIC_SMART_CLIENT_ID, which is where a
//   shipped app gets it.
//
//   A value entered in the app, which is how this becomes usable the day
//   a registration is approved rather than the day someone rebuilds. It
//   is also how the Epic sandbox gets exercised without touching the
//   build at all.
//
// The entered value wins, so a tester can point a build at a different
// registration without waiting for anyone.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ciatta.smart.clientId';

const FROM_BUILD = process.env.EXPO_PUBLIC_SMART_CLIENT_ID ?? '';

export async function clientId(): Promise<string> {
  try {
    const stored = (await AsyncStorage.getItem(KEY))?.trim();
    if (stored) return stored;
  } catch {
    // Storage unavailable. The build value is still a real answer.
  }
  return FROM_BUILD.trim();
}

export async function setClientId(value: string): Promise<void> {
  const clean = value.trim();
  if (clean) await AsyncStorage.setItem(KEY, clean);
  else await AsyncStorage.removeItem(KEY);
}

// Whether a connection can be attempted at all. Asked before the button
// is drawn, so she is never sent to a login that cannot complete.
export async function canConnect(): Promise<boolean> {
  return (await clientId()).length > 0;
}

// The client id Ciatta presents to a provider, and where it comes from.
//
// It is public by design. SMART public clients prove themselves with
// PKCE, not a secret, so this value is readable by anyone who downloads
// the app and that is the intended arrangement. Nothing here is a
// credential, and nothing secret may ever be stored through this file.
//
// Two sources, in order:
//
//   The build, through EXPO_PUBLIC_SMART_CLIENT_ID (production) and
//   EXPO_PUBLIC_SMART_CLIENT_ID_NONPROD (the sandbox), which is where a
//   shipped app gets it.
//
//   A value entered in the app, which is how this becomes usable the day
//   a registration is approved rather than the day someone rebuilds. It
//   is also how the Epic sandbox gets exercised without touching the
//   build at all.
//
// The entered value replaces the non production id, so a tester can
// point a build at a different sandbox registration without waiting for
// anyone.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClientIds } from '../lib/providers/clientChoice';

const KEY = 'ciatta.smart.clientId';

const PRODUCTION = process.env.EXPO_PUBLIC_SMART_CLIENT_ID ?? '';
const NON_PRODUCTION = process.env.EXPO_PUBLIC_SMART_CLIENT_ID_NONPROD ?? '';

// Both ids. A value entered in the app replaces the non production id
// only: it is how a test build reaches the sandbox, and it can never point
// a real hospital at a different registration.
export async function clientIds(): Promise<ClientIds> {
  let entered = '';
  try {
    entered = (await AsyncStorage.getItem(KEY))?.trim() ?? '';
  } catch {
    // Storage unavailable. The build values are still a real answer.
  }
  return { production: PRODUCTION.trim(), nonProduction: entered || NON_PRODUCTION.trim() };
}

export async function setClientId(value: string): Promise<void> {
  const clean = value.trim();
  if (clean) await AsyncStorage.setItem(KEY, clean);
  else await AsyncStorage.removeItem(KEY);
}

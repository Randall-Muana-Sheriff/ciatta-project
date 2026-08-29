/** Must match app.json google-signin iosUrlScheme. Public identifier, not a secret. */
export const GOOGLE_IOS_URL_SCHEME =
  'com.googleusercontent.apps.326095655806-po3vgir44qdql8s6a6ibfg1frej4am64';

const GOOGLE_SCHEME_PREFIX = 'com.googleusercontent.apps.';
const GOOGLE_CLIENT_SUFFIX = '.apps.googleusercontent.com';

export function googleIosClientIdFromScheme(scheme: string): string | null {
  if (!scheme.startsWith(GOOGLE_SCHEME_PREFIX)) return null;
  const id = scheme.slice(GOOGLE_SCHEME_PREFIX.length).trim();
  if (!id) return null;
  return `${id}${GOOGLE_CLIENT_SUFFIX}`;
}

export function isPlaceholderGoogleClientId(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  return /your-|example|placeholder/i.test(value);
}

export function resolvedGoogleClientIds(env: {
  webClientId?: string;
  iosClientId?: string;
}): { webClientId: string; iosClientId: string } | null {
  const iosFromEnv = env.iosClientId?.trim();
  const iosClientId = !isPlaceholderGoogleClientId(iosFromEnv)
    ? iosFromEnv!
    : googleIosClientIdFromScheme(GOOGLE_IOS_URL_SCHEME);
  const webFromEnv = env.webClientId?.trim();
  const webClientId = !isPlaceholderGoogleClientId(webFromEnv) ? webFromEnv! : iosClientId;
  if (!iosClientId || !webClientId) return null;
  return { webClientId, iosClientId };
}

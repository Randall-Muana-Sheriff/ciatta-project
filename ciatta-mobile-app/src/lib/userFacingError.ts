import { displayCopy } from './displayCopy';

const TECHNICAL =
  /pgrst|postgres|42703|jwt|jwks|oauth|openid|stack trace|nsurl|cfnetwork|supabase|postgrest|invalid_grant|redirect_uri|url scheme|bundle id|com\.google|com\.ciatta|exception|undefined is not|null is not|network request failed|failed to fetch|econnrefused|enotfound|permission denied|rls|row.level|authapi|idtoken|identity token|developer_error|status code|http\/|sqlstate|column .* does not exist/i;

/**
 * Turns auth, network, and backend failures into short copy a person can act on.
 * Technical strings never reach the screen.
 */
export function userFacingError(error: unknown, fallback: string): string {
  const safeFallback = displayCopy(fallback);
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : '';
  const text = raw.trim();
  if (!text) return safeFallback;

  const lower = text.toLowerCase();
  if (/invalid login|invalid credentials|invalid email or password/.test(lower)) {
    return displayCopy('That email or password did not match.');
  }
  if (/email not confirmed|confirm your email/.test(lower)) {
    return displayCopy("Check your email to confirm this account, then try again.");
  }
  if (/user already registered|already been registered|already exists/.test(lower)) {
    return displayCopy('That account already exists. Sign in instead.');
  }
  if (/too many requests|rate limit/.test(lower)) {
    return displayCopy('Please wait a moment, then try again.');
  }
  if (/network request failed|failed to fetch|network error|internet/.test(lower)) {
    return displayCopy('Check your connection and try again.');
  }
  if (/play services|playservices/.test(lower)) {
    return displayCopy('Google sign in is not available on this device.');
  }
  if (/developer_error|code 10|iosurlscheme|client id|audience/.test(lower)) {
    return displayCopy('Google sign in is not available right now.');
  }
  if (/cancelled|canceled/.test(lower)) {
    return '';
  }
  if (TECHNICAL.test(text) || text.length > 140 || text.includes('{') || text.includes('  at ')) {
    return safeFallback;
  }
  return displayCopy(text);
}

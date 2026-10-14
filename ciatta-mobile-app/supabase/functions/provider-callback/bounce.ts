// Where her login comes back to, and the one thing it does: hand the answer
// to the app.
//
// Epic stores redirect URIs with https in front, so a registered
// "ciatta://provider-callback" became "https://ciatta://provider-callback",
// an address no phone can open. This https page is registered instead. Her
// hospital sends her here after she logs in, and this sends her straight on
// to ciatta://provider-callback with the same answer, where the app's
// browser session is waiting for it.
//
// Only the OAuth answer is forwarded, never anything else in the address,
// so this cannot be used to send her somewhere other than Ciatta. Nothing is
// stored and nothing is logged: the code is useless without the verifier,
// which never left her phone.

export const APP_CALLBACK = 'ciatta://provider-callback';

const FORWARDED = ['code', 'state', 'error', 'error_description'];

export function appTarget(requestUrl: string): string {
  const incoming = new URL(requestUrl).searchParams;
  const out = new URLSearchParams();
  // In the order the hospital sent them, each once.
  for (const [key, value] of incoming) {
    if (FORWARDED.includes(key) && !out.has(key)) out.set(key, value);
  }
  const query = out.toString();
  return query ? `${APP_CALLBACK}?${query}` : APP_CALLBACK;
}

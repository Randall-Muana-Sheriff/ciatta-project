/**
 * Cookie consent, and the analytics it gates.
 *
 * The rule this is built to: nothing that identifies a visitor loads until
 * she has said yes. Not the script, not a request to the vendor, not a
 * cookie. Declining is not "load it and pretend not to look"; it is never
 * fetching the thing at all.
 *
 * So analytics is injected here, by this file, after a yes — never dropped
 * into index.html where it would run on first paint and be doing its work
 * before the banner had finished rendering.
 *
 * Her answer is kept in localStorage rather than in a cookie, because a
 * cookie recording that she refused cookies is a joke told at her expense.
 * It is first-party, it leaves the browser never, and it is the one thing
 * stored without asking — which the Privacy Policy says outright.
 *
 * The banner does not appear at all when no analytics is configured. A
 * consent request for something that does not exist is a dark pattern with
 * good manners, and until VITE_GA_ID is set there is genuinely nothing to
 * consent to.
 */

const KEY = 'ciatta.consent';

/** Set VITE_GA_ID in the Pages environment to switch analytics on. */
const GA_ID: string | undefined = import.meta.env.VITE_GA_ID;

export type Choice = 'granted' | 'denied';

export const analyticsConfigured = Boolean(GA_ID);

export function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    // Private browsing, or storage disabled. Treat it as undecided and ask
    // again rather than assuming either answer.
    return null;
  }
}

function remember(choice: Choice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // If it cannot be remembered she will be asked again next visit, which
    // is the safe failure: the alternative is loading analytics she may
    // have declined.
  }
}

let loaded = false;

/** Inject the tag. Only ever called after an explicit yes. */
function loadAnalytics() {
  if (loaded || !GA_ID || typeof document === 'undefined') return;
  loaded = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);

  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) { w.dataLayer!.push(args); };
  w.gtag('js', new Date());
  // No advertising features, and the address is truncated before it is
  // stored. Neither is required of us; both are the version of this we are
  // willing to run.
  w.gtag('config', GA_ID, { anonymize_ip: true, allow_google_signals: false });
}

export function grant() {
  remember('granted');
  loadAnalytics();
}

export function deny() {
  remember('denied');
  // Nothing to unload: it was never fetched.
}

/** Called once on boot: honours a previous yes, and never assumes one. */
export function applyStoredChoice() {
  if (readChoice() === 'granted') loadAnalytics();
}

/** Re-opening the banner is how a choice is withdrawn. */
export function forget() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

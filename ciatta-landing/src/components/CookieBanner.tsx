import { useEffect, useState } from 'react';
import { analyticsConfigured, applyStoredChoice, deny, grant, readChoice } from '../lib/consent';

/**
 * The cookie banner.
 *
 * Accept and Decline are the same size, the same weight and the same
 * distance from her thumb. A banner where refusing is a grey word in the
 * corner is a banner designed to be accepted, and that is not consent.
 *
 * It does not block the page. The waitlist form still works behind it,
 * because holding a landing page hostage over analytics is a cost paid by
 * the visitor for something that benefits only us.
 *
 * It renders nothing at all when analytics is not configured, and nothing
 * once she has answered. "Cookie choices" in the footer brings it back,
 * which is how an answer is changed.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    applyStoredChoice();
    if (analyticsConfigured && readChoice() === null) setOpen(true);

    // The footer link re-opens it rather than routing anywhere.
    const reopen = () => setOpen(true);
    window.addEventListener('ciatta:cookies', reopen);
    return () => window.removeEventListener('ciatta:cookies', reopen);
  }, []);

  if (!open) return null;

  return (
    <div className="ck" role="dialog" aria-modal="false" aria-labelledby="ck-title">
      <div className="ck-in">
        <div>
          <p className="ck-title" id="ck-title">Analytics, only if you say so.</p>
          <p className="ck-body">
            We would like to set one cookie to count visits and see which
            pages are read. It tells us nothing about who you are, and your
            health data is never part of it. Decline and nothing is set.{' '}
            <a href="/privacy/">Privacy Policy</a>
          </p>
        </div>
        <div className="ck-acts">
          <button type="button" className="ck-btn" onClick={() => { deny(); setOpen(false); }}>
            Decline
          </button>
          <button type="button" className="ck-btn is-on" onClick={() => { grant(); setOpen(false); }}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** The footer's way back to the choice. */
export function CookieChoicesLink() {
  if (!analyticsConfigured) return null;
  return (
    <button
      type="button"
      className="ck-link"
      onClick={() => window.dispatchEvent(new Event('ciatta:cookies'))}
    >
      Cookie choices
    </button>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Wordmark } from './components/Wordmark';
import { confirmSubscription, unsubscribe, type Result } from './lib/newsletter';

/**
 * Where the links in our emails land.
 *
 *   confirm      runs as soon as the page loads. The confirmation is a POST
 *                made by this page, not the GET that opened it, so a mail
 *                scanner that pre-opens links (and does not run scripts) cannot
 *                confirm on someone's behalf.
 *   unsubscribe  asks first, then acts on the button. Unsubscribing is the one
 *                thing a stray pre-fetch must never do.
 */
type Mode = 'confirm' | 'unsubscribe';
type View = { kind: 'working' } | { kind: 'ask' } | { kind: 'done'; result: Result };

const COPY = {
  confirm: {
    working: ['Confirming…', 'One moment.'],
    confirmed: ['You are subscribed.', 'A welcome email is on its way now, with what to expect and when.'],
    already_confirmed: ['You were already subscribed.', 'Nothing has changed, and nothing more needs doing.'],
  },
  unsubscribe: {
    ask: ['Unsubscribe from Ciatta emails?', 'You will stop receiving Ciatta Briefs and launch news at this address.'],
    working: ['Unsubscribing…', 'One moment.'],
    unsubscribed: ['You are unsubscribed.', 'No more emails will arrive from us at this address. If you change your mind, you can sign up again on the home page.'],
  },
} as const;

export default function Newsletter({ mode }: { mode: Mode }) {
  // Read once: the effect below strips it from the address bar, and a re-read
  // after that would find nothing.
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [view, setView] = useState<View>(mode === 'confirm' ? { kind: 'working' } : { kind: 'ask' });
  const started = useRef(false);

  useEffect(() => {
    if (mode !== 'confirm' || started.current) return;
    started.current = true; // StrictMode runs effects twice in development.
    confirmSubscription(token).then((result) => setView({ kind: 'done', result }));
  }, [mode, token]);

  // The token is a credential for this one address. Once read, take it out of
  // the address bar so it is not left in history or shared by copying the URL.
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);

  async function onUnsubscribe() {
    setView({ kind: 'working' });
    setView({ kind: 'done', result: await unsubscribe(token) });
  }

  let title: string;
  let body: string;
  if (view.kind === 'done') {
    if (view.result.ok) {
      const table = COPY[mode] as Record<string, readonly [string, string]>;
      [title, body] = table[view.result.status] ?? ['Done.', ''];
    } else {
      title = view.result.status === 'expired_link' ? 'This link has expired.' : 'That did not work.';
      body = view.result.message;
    }
  } else if (view.kind === 'ask') {
    [title, body] = COPY.unsubscribe.ask;
  } else {
    [title, body] = COPY[mode].working;
  }

  const failed = view.kind === 'done' && !view.result.ok;

  return (
    <>
      <header className="header is-scrolled">
        <a href="/" className="header-brand" aria-label="Ciatta, home">
          <Wordmark size="sm" />
        </a>
      </header>
      <main className="nl-main">
        <div className="shell">
          <div className="nl-card" role="status" aria-live="polite" aria-busy={view.kind === 'working'}>
            <h1>{title}</h1>
            {body && <p>{body}</p>}
            <div className="nl-actions">
              {view.kind === 'ask' && (
                <>
                  <button className="btn-primary" type="button" onClick={onUnsubscribe} disabled={!token}>
                    Unsubscribe
                  </button>
                  <a className="nl-link" href="/">Keep me subscribed</a>
                </>
              )}
              {view.kind === 'done' && (
                <>
                  <a className="btn-primary" href={failed ? '/#join' : '/briefs/'}>
                    {failed ? 'Sign up again' : 'Read Briefs'}
                  </a>
                  <a className="nl-link" href="/">Home</a>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

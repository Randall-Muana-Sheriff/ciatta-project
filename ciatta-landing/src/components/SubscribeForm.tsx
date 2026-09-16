import { useRef, useState } from 'react';
import { subscribe, type Source, type Topic } from '../lib/newsletter';
import { joinWaitlist } from '../lib/waitlist';

/**
 * The email form, used everywhere the page asks for an address.
 *
 * Two kinds, because they ask for different consent:
 *
 *   newsletter  Ciatta Briefs twice a week, plus a note when Ciatta opens.
 *               The note under the field says exactly that, because what she
 *               reads there is what she is agreeing to.
 *   waitlist    Reserve a place: news when Ciatta opens. The newsletter is a
 *               separate, unticked choice. Consent to one is not consent to
 *               the other.
 *
 * Either way the address is not added until she clicks the link we email
 * (double opt-in). So the success state asks her to check her inbox; it never
 * claims she is subscribed before she is.
 */
type FormState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

export function SubscribeForm({
  id,
  source,
  kind = 'newsletter',
  cta,
  note,
}: {
  id: string;
  source: Source;
  kind?: 'newsletter' | 'waitlist';
  /** The button's label. */
  cta?: string;
  /** The line under the field. Defaults to what she is signing up for. */
  note?: string;
}) {
  const [email, setEmail] = useState('');
  const [alsoBriefs, setAlsoBriefs] = useState(false);
  const [company, setCompany] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const mountedAt = useRef(Date.now());

  const label = cta ?? (kind === 'newsletter' ? 'Subscribe' : 'Join the waitlist');
  const line =
    note ??
    (kind === 'newsletter'
      ? 'Ciatta Briefs every Tuesday and Friday, and a note when Ciatta opens. Unsubscribe anytime.'
      : 'One email when Ciatta opens. Unsubscribe anytime.');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'saving') return;
    setState({ kind: 'saving' });

    const topics: Topic[] = kind === 'newsletter' ? ['briefs', 'launch'] : alsoBriefs ? ['launch', 'briefs'] : ['launch'];
    const submitted = email.trim();

    // The waitlist table predates the newsletter and still holds the member
    // page's reservations. Keep writing it; never let it block the email.
    if (kind === 'waitlist') void joinWaitlist(submitted, source).catch(() => undefined);

    const result = await subscribe({
      email: submitted,
      source,
      topics,
      company,
      elapsedMs: Date.now() - mountedAt.current,
    });
    if (result.ok) {
      setState({ kind: 'sent', email: submitted });
      setEmail('');
    } else {
      setState({ kind: 'error', message: result.message });
    }
  }

  if (state.kind === 'sent') {
    return (
      <div className="joined" role="status" aria-live="polite">
        <span className="joined-mark" aria-hidden="true" />
        <div>
          <p className="joined-title">Check your inbox to confirm.</p>
          <p className="joined-sub">
            We sent a link to {state.email}. Nothing arrives until you click it. If it is not there in a
            few minutes, look in spam or promotions.
          </p>
          <button
            type="button"
            className="joined-reset"
            onClick={() => {
              mountedAt.current = Date.now();
              setState({ kind: 'idle' });
            }}
          >
            Use a different address
          </button>
        </div>
      </div>
    );
  }

  const noteId = `${id}-note`;
  return (
    <form className="waitlist" onSubmit={onSubmit} noValidate={false}>
      <div className="waitlist-row">
        <div className="waitlist-field">
          <label htmlFor={id}>Email</label>
          <input
            id={id}
            name="email"
            type="email"
            inputMode="email"
            required
            maxLength={254}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state.kind === 'error') setState({ kind: 'idle' });
            }}
            aria-describedby={noteId}
            aria-invalid={state.kind === 'error' ? true : undefined}
          />
        </div>
        <button className="btn-primary" type="submit" disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Sending…' : label}
        </button>
      </div>

      {/* Honeypot. Hidden from people and from assistive tech; bots fill it. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${id}-company`}>Company</label>
        <input
          id={`${id}-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      {kind === 'waitlist' && (
        <label className="waitlist-opt" htmlFor={`${id}-briefs`}>
          <input
            id={`${id}-briefs`}
            type="checkbox"
            checked={alsoBriefs}
            onChange={(e) => setAlsoBriefs(e.target.checked)}
          />
          <span>Also send me Ciatta Briefs, every Tuesday and Friday</span>
        </label>
      )}

      <p
        id={noteId}
        className={state.kind === 'error' ? 'waitlist-note is-error' : 'waitlist-note'}
        role={state.kind === 'error' ? 'alert' : undefined}
      >
        {state.kind === 'error' ? (
          state.message
        ) : (
          <>
            {line}
            {line ? ' ' : ''}
            <a href="/privacy/">Privacy</a>
          </>
        )}
      </p>
    </form>
  );
}

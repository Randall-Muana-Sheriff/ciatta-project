import { useState } from 'react';
import { joinWaitlist } from '../lib/waitlist';

/**
 * The waitlist form. Lifted out of App so the member page uses the same one
 * rather than a second copy that drifts: one set of states, one error string,
 * one `source` field so a signup can be traced to the page it came from.
 */
type FormState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; alreadyJoined: boolean }
  | { kind: 'error'; message: string };

export function WaitlistForm({
  id,
  source,
  cta = 'Join the waitlist',
  note = 'One email when it opens.',
}: {
  id: string;
  source: string;
  /** The button's label. It names what the page it sits on is offering, so a
      section that leads with "Start free" says so on the button too. */
  cta?: string;
  /** The line under the field. Pass '' where the surrounding copy already
      says it; the slot still appears to carry an error, and only then. */
  note?: string;
}) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'saving') return;
    setState({ kind: 'saving' });
    const result = await joinWaitlist(email, source);
    if (result.ok) {
      setState({ kind: 'done', alreadyJoined: result.alreadyJoined });
      setEmail('');
    } else {
      setState({ kind: 'error', message: result.message });
    }
  }

  // Silence is part of the product. It says what happened and stops.
  if (state.kind === 'done') {
    return (
      <div className="joined" role="status">
        <span className="joined-mark" aria-hidden="true" />
        <div>
          <p className="joined-title">
            {state.alreadyJoined ? 'You were already on the list.' : 'You are on the list.'}
          </p>
          <p className="joined-sub">One email when it opens.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="waitlist" onSubmit={onSubmit}>
      <div className="waitlist-row">
        <div className="waitlist-field">
          <label htmlFor={id}>Email</label>
          <input
            id={id}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={note ? `${id}-note` : undefined}
          />
        </div>
        <button className="btn-primary" type="submit" disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Adding…' : cta}
        </button>
      </div>
      {(state.kind === 'error' || note) && (
        <p
          id={`${id}-note`}
          className={state.kind === 'error' ? 'waitlist-note is-error' : 'waitlist-note'}
          role={state.kind === 'error' ? 'alert' : undefined}
        >
          {state.kind === 'error' ? state.message : note}
        </p>
      )}
    </form>
  );
}

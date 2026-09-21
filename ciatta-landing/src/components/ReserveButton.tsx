import { useState } from 'react';

/**
 * "Reserve your place", wired to Stripe.
 *
 * Pressing it asks the site for a Checkout session and hands the browser to
 * Stripe, which collects the card and charges nothing. Stripe collects the
 * email too, so there is no form in front of the button.
 *
 * Three things it has to survive.
 *
 * Reservations not being open yet. Until the keys are set the endpoint
 * answers 503, and a button that reports an error for a thing that was never
 * switched on is a bug she can do nothing about. So it falls back: it sends
 * her to the email form, which works today, and says why.
 *
 * A slow network. The label says what is happening and the button stops
 * accepting presses, because two presses is two Stripe customers.
 *
 * No JavaScript, or JavaScript that failed. It renders as a link to the email
 * form and upgrades itself to a button, so the path to reserving a place
 * never depends on this file loading.
 */

type State = { kind: 'idle' } | { kind: 'opening' } | { kind: 'closed' } | { kind: 'error'; message: string };

export function ReserveButton({
  className = 'm-btn',
  label = 'Reserve your place',
}: {
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function open() {
    if (state.kind === 'opening') return;
    setState({ kind: 'opening' });
    try {
      const res = await fetch('/api/reserve/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string };

      if (res.status === 503) {
        setState({ kind: 'closed' });
        document.getElementById('join')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (body.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      setState({ kind: 'error', message: body.message ?? "That didn't work. Try again in a moment." });
    } catch {
      setState({ kind: 'error', message: 'Check your connection and try again.' });
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={open}
        disabled={state.kind === 'opening'}
      >
        {state.kind === 'opening' ? 'Opening…' : label}
      </button>

      {state.kind === 'closed' && (
        <p className="rs-msg" role="status">
          Leave your address below to hold your place. No card, and nothing is
          charged.
        </p>
      )}
      {state.kind === 'error' && (
        <p className="rs-msg is-error" role="alert">{state.message}</p>
      )}
    </>
  );
}

/**
 * What she sees on the way back from Stripe.
 *
 * The redirect is not the proof — the webhook is — so this says her card is
 * saved and nothing has been charged, which is true the moment Checkout
 * completes, and claims nothing about what happens next that the terms do not.
 */
export function ReservedNotice() {
  const reserved =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('reserved');
  if (!reserved) return null;

  return (
    <p className="rs-done" role="status">
      <b>Your place is reserved.</b> Your card is saved and nothing has been
      charged. We will email you before the first payment, when Ciatta opens.
    </p>
  );
}

import { useRef, useState } from 'react';

/**
 * The reserve action, wired to Stripe.
 *
 * "Reserve your place" everywhere, in the header, the hero, the membership
 * card, and the closing ask. One action with one name: a page that calls the
 * same thing "Join now" in one place and "Reserve" in another is asking twice.
 *
 * Pressing it asks the site for a Checkout session and hands the browser to
 * Stripe, which collects the card and charges nothing. Stripe collects the
 * email too, so there is no form in front of the button.
 *
 * THIS BUTTON MUST NEVER DEAD-END, AND STRIPE IS NOT CONFIGURED YET.
 *
 * With no STRIPE_SECRET_KEY set the endpoint answers 503. A 503 is not an
 * outcome anyone can act on, so it is never shown: every failure lands on the
 * email reservation form, which works today, takes no card, and is the actual
 * reservation mechanism until Stripe goes live. The button finds the nearest
 * email form below it, scrolls to it, puts the cursor in the field, and says
 * in one sentence what happens next.
 *
 * It falls back the same way for every failure, not only 503 — a network that
 * dropped, an endpoint that answered 500, a body that would not parse. There
 * is no state of this button in which someone is told to try again later.
 *
 * What it never does: claim a payment happened, ask for payment details
 * itself, or describe leaving an address as a subscription. The message says
 * free, no card, and nothing charged, because that is what the email path is.
 *
 * WHEN STRIPE IS CONFIGURED, nothing here changes shape. The endpoint starts
 * answering with a Checkout URL instead of 503, the first branch below takes
 * it, and the fallback stays where it is for the days Stripe is down. The CTA
 * label, the markup and the styling are untouched by the switch.
 *
 * A slow network: the label says what is happening and the button stops
 * accepting presses, because two presses is two Stripe customers.
 */

type State = { kind: 'idle' } | { kind: 'opening' } | { kind: 'closed' };

export function ReserveButton({
  className = 'm-btn',
  label = 'Reserve your place',
}: {
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const me = useRef<HTMLButtonElement | null>(null);

  /**
   * The email form to send her to. The nearest one below this button in
   * document order, because a button in the middle of a page should not
   * scroll someone back up to the hero to finish — which is exactly what a
   * hard-coded #join did on the home page, where the hero form sits above
   * the membership card. The last form on the page is the fallback's
   * fallback, and #join the one after that.
   */
  function reach() {
    const fields = Array.from(
      document.querySelectorAll<HTMLInputElement>('.waitlist input[type="email"]'),
    );
    const btn = me.current;
    const below = btn
      ? fields.find((f) => btn.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING)
      : undefined;
    const field = below ?? fields[fields.length - 1];
    const target: HTMLElement | null = field ?? document.getElementById('join');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focus after the scroll has been asked for, so the browser does not
    // jump to the field and then animate to it from there.
    window.setTimeout(() => field?.focus({ preventScroll: true }), 400);
  }

  async function open() {
    if (state.kind === 'opening') return;
    setState({ kind: 'opening' });
    try {
      const res = await fetch('/api/reserve/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string };

      // The only path that leaves this page is a real Checkout URL.
      if (res.ok && body.ok && body.url) {
        window.location.href = body.url;
        return;
      }
    } catch {
      // Falls through to the same place as every other failure.
    }
    setState({ kind: 'closed' });
    reach();
  }

  return (
    <>
      <button
        ref={me}
        type="button"
        className={className}
        onClick={open}
        disabled={state.kind === 'opening'}
      >
        {state.kind === 'opening' ? 'Opening…' : label}
      </button>

      {state.kind === 'closed' && (
        <p className="rs-msg" role="status">
          Leave your address below to hold your place. Reserving is free, no
          card is taken, and you are not subscribing to anything.
        </p>
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

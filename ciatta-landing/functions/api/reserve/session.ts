/**
 * Reserve a place: create a Stripe Checkout Session that saves a card and
 * charges nothing.
 *
 * The page promises "nothing is charged until Ciatta opens and you choose to
 * begin", so this runs Checkout in `setup` mode rather than `subscription`
 * mode. Setup mode collects and stores a payment method against a Customer
 * and creates no subscription and no invoice, which means there is no launch
 * date to commit to and nothing to refund if the date moves. When Ciatta
 * opens, a subscription is created against the saved method.
 *
 * Stripe is called over its REST API with fetch rather than through the SDK:
 * the SDK needs shimming to run on Workers, and this endpoint needs two form
 * posts. The webhook verifies signatures with WebCrypto for the same reason.
 *
 * No key is ever in this file. STRIPE_SECRET_KEY is a Cloudflare secret, set
 * with `npx wrangler pages secret put STRIPE_SECRET_KEY`, and it is read at
 * request time.
 */

type Env = {
  STRIPE_SECRET_KEY?: string;
  /** e.g. price_1AbCdEf… — the $99/year recurring price, billed annually */
  STRIPE_PRICE_ID?: string;
  /** e.g. https://ciatta.io */
  SITE_ORIGIN?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Stripe's API is form-encoded, including its nested keys. */
function form(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return json({ ok: false, message: 'Reservations are not open yet.' }, 503);

  // The address is optional: Checkout collects one itself when we do not
  // supply it, so the card can be reserved from a button without a form in
  // front of it. When the page does know the address, passing it means she
  // does not type it twice.
  let email = '';
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    email = (body.email ?? '').trim().toLowerCase();
  } catch {
    email = '';
  }
  if (email && (!EMAIL.test(email) || email.length > 254)) {
    return json({ ok: false, message: 'Enter a valid email address.' }, 400);
  }

  const origin = env.SITE_ORIGIN ?? new URL(request.url).origin;

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
      // Stripe retries are safe to repeat: the same email within the same
      // minute produces the same session rather than a second customer.
      'idempotency-key': `reserve:${email || 'anon'}:${Math.floor(Date.now() / 60000)}`,
    },
    body: form({
      mode: 'setup',
      currency: 'usd',
      success_url: `${origin}/member/?reserved=1`,
      cancel_url: `${origin}/member/#membership`,
      'metadata[intent]': 'reserve',
      ...(email ? { customer_email: email, 'metadata[email]': email } : {}),
      ...(env.STRIPE_PRICE_ID ? { 'metadata[price_id]': env.STRIPE_PRICE_ID } : {}),
    }),
  });

  if (!res.ok) {
    // Never return Stripe's message to the browser: it can name internal
    // configuration. Log it, and tell her something she can act on.
    console.error('stripe session failed', res.status, await res.text());
    return json({ ok: false, message: "That didn't work. Try again in a moment." }, 502);
  }

  const session = (await res.json()) as { url?: string };
  if (!session.url) return json({ ok: false, message: "That didn't work. Try again in a moment." }, 502);

  return json({ ok: true, url: session.url });
};

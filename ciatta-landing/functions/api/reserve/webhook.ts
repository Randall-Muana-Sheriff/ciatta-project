/**
 * Stripe's webhook: the only place a reservation is recorded.
 *
 * The browser being redirected to the success page is not proof of anything —
 * it can be forged, and it can be missed if she closes the tab. Stripe's
 * webhook is the fact. So the success page says what happened and this
 * records it.
 *
 * Signature verification is done here rather than trusted: an unsigned POST
 * to this URL is an attacker claiming a reservation. Stripe signs with
 * HMAC-SHA256 over "<timestamp>.<raw body>", so the raw body is read as text
 * before anything parses it, and the comparison is constant-time.
 *
 * Secrets are Cloudflare secrets, never in the repo:
 *   npx wrangler pages secret put STRIPE_WEBHOOK_SECRET
 *   npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
 */

type Env = {
  STRIPE_WEBHOOK_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

/** Stripe tolerates 5 minutes of clock skew; so do we, and no more. */
const TOLERANCE_SECONDS = 300;

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signatureIsValid(raw: string, header: string, secret: string) {
  // t=1700000000,v1=abc…,v1=def…  (more than one v1 during a secret rotation)
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  ) as Record<string, string>;

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`));
  const expected = hex(mac);

  return header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .some((p) => timingSafeEqual(p.slice(3), expected));
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  const header = request.headers.get('stripe-signature');
  if (!secret || !header) return new Response('missing signature', { status: 400 });

  const raw = await request.text();
  if (!(await signatureIsValid(raw, header, secret))) {
    return new Response('bad signature', { status: 400 });
  }

  const event = JSON.parse(raw) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  // Setup mode completes as checkout.session.completed with a setup_intent.
  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object as {
    id?: string;
    customer?: string;
    customer_email?: string;
    setup_intent?: string;
    metadata?: { email?: string };
  };
  const email = (session.metadata?.email ?? session.customer_email ?? '').toLowerCase();
  if (!email) return new Response('no email', { status: 200 });

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Tell Stripe we failed so it retries: losing a reservation silently is
    // worse than a webhook sitting in the retry queue until this is fixed.
    console.error('reservation store not configured');
    return new Response('store unavailable', { status: 500 });
  }

  const res = await fetch(`${url}/rest/v1/reservations`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      // One row per email: a second reservation updates the first rather than
      // leaving two cards against one person.
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      email,
      stripe_customer_id: session.customer ?? null,
      stripe_setup_intent_id: session.setup_intent ?? null,
      stripe_session_id: session.id ?? null,
      reserved_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    console.error('reservation insert failed', res.status, await res.text());
    return new Response('store failed', { status: 500 });
  }

  return new Response('ok', { status: 200 });
};

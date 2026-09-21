# Taking reservations with Stripe

What is built, what you need to supply, and what is deliberately not done yet.

## The shape of it

The page says **"Nothing is charged until Ciatta opens and you choose to
begin."** That sentence decides the architecture.

So a reservation runs Stripe Checkout in **`setup` mode**, not `subscription`
mode. Setup mode collects a card and stores it against a Stripe Customer. It
creates no subscription, raises no invoice, and charges nothing. There is
therefore no launch date to commit to, and nothing to refund if the date
moves. When Ciatta opens you create subscriptions against the saved cards.

The alternative — a subscription with a long trial — bills automatically at
trial end, which is less work later but requires naming a date now and
re-dating every customer if it slips.

## What you need to supply

1. **A Stripe account**, with business details verified and a bank account
   connected for payouts. Live keys do not work until this is done.
2. **A Product and Price.** Create a product "Ciatta Core" with a recurring
   price of **$99 / year**, billing interval **yearly** (one payment a year,
   not twelve monthly instalments). Copy the price ID (`price_…`).
3. **Three secrets**, set as Cloudflare Pages secrets. Do not put them in the
   repo, in `.env`, or in a message to anyone:

   ```
   npx wrangler pages secret put STRIPE_SECRET_KEY      # sk_test_… then sk_live_…
   npx wrangler pages secret put STRIPE_WEBHOOK_SECRET  # whsec_…
   npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
   ```

4. **Two plain variables**, which can be set in the Pages dashboard:

   ```
   STRIPE_PRICE_ID = price_…
   SITE_ORIGIN     = https://ciatta.io
   SUPABASE_URL    = https://<project>.supabase.co
   ```

5. **A webhook endpoint** in Stripe, pointing at
   `https://ciatta.io/api/reserve/webhook`, subscribed to
   **`checkout.session.completed`**. Stripe shows the signing secret once —
   that is `STRIPE_WEBHOOK_SECRET`.

6. **The table.** Run this in Supabase:

   ```sql
   create table if not exists reservations (
     id                     bigserial primary key,
     email                  text not null unique,
     stripe_customer_id     text,
     stripe_setup_intent_id text,
     stripe_session_id      text,
     reserved_at            timestamptz not null default now(),
     converted_at           timestamptz
   );

   -- The webhook writes with the service role key. Nothing else may read it.
   alter table reservations enable row level security;
   ```

   No policy is added on purpose: with RLS on and no policy, the anon key the
   browser holds cannot read or write this table at all. Only the service role
   key, which lives in a Cloudflare secret, can.

## What is built

- `functions/api/reserve/session.ts` — takes an email, returns a Checkout URL.
  Validates the address, never echoes Stripe's error to the browser, and is
  idempotent per email per minute.
- `functions/api/reserve/webhook.ts` — verifies Stripe's signature with
  WebCrypto before parsing anything, rejects replays older than five minutes,
  and records the reservation. Returns 500 when the store is unconfigured so
  Stripe retries rather than dropping the reservation silently.

Neither file contains a key. Stripe is called over its REST API with `fetch`
rather than through the SDK, which needs shimming on Workers.

## What is not built, and why

- **The button.** Nothing on the site calls this yet. A reservation button
  that 503s because the keys are not set looks broken, so wiring it is the
  last step, after a test-mode reservation succeeds end to end.
- **Charging at launch.** A script that walks `reservations` and creates
  subscriptions against the saved payment methods. It is a small job and it
  should be written when there is a date.
- **The receipt email.** Resend is already wired for the newsletter; a
  "your place is reserved" email belongs in the webhook once the copy exists.

## Testing it

Use test keys and card `4242 4242 4242 4242`, any future expiry, any CVC.

```bash
stripe listen --forward-to localhost:8788/api/reserve/webhook
npx wrangler pages dev dist
```

`stripe listen` prints its own `whsec_…` for local use. Check that a row lands
in `reservations` and that Stripe shows a saved payment method against the
customer with no charge.

## Before taking live cards

- The terms need a billing clause: what is stored, when the first charge
  happens, how to cancel, and what happens if the launch date moves. Storing a
  card against a future charge is a commitment, and in several jurisdictions
  it has to be disclosed before the card is collected.
- Decide what happens to a saved card if Ciatta does not open. The honest
  answer is that it is deleted, and saying so on the page costs nothing.

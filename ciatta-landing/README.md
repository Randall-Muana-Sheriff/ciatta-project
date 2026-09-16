# Ciatta — waitlist landing page

A single-page pre-launch site for Ciatta. React + Vite + TypeScript, no UI
framework. Adapted from the Figma Make file
`Jfpz1Bii9CpmnxuyiaQv4l` (*Landing page for Ciatte*).

## What changed from the Figma source

The Figma version was a working prototype, not a shippable page. Three things
were wrong for this product and are fixed here:

| Figma source | Here | Why |
|---|---|---|
| Brand spelled **ciatte** | **Ciatta** | Everything else — App Store listing, bundle id `com.ciatta.mobileapp`, the logo — says Ciatta |
| Green `#22c55e` accent | Living Coral `#F27D72` | The app's accent, straight from `ciatta-mobile-app/src/theme/tokens.ts`. Canvas, surface and the three inks match that file exactly too |
| Sleep / Movement / **Nutrition** / Mood | Sleep / Recovery / **Cycle** / Energy / Mood | The real five domains. Ciatta has no nutrition logging, and cycle — the reason it's a women's health app — was missing entirely |

Copy was rewritten to describe what the app does (observes and reports
patterns) rather than habit tracking, which it isn't.

The Figma form threw the email away (`setSubmitted(true)` and nothing else).
Here it writes to Supabase.

## Setup

```bash
npm install
cp .env.example .env      # fill in from the Supabase dashboard
npm run dev
```

`npm run build` typechecks and bundles to `dist/`. `npm run preview` serves
that build.

## The waitlist needs one migration applied

`ciatta-mobile-app/supabase/migrations/20260838000000_waitlist.sql` creates the
table. **It has not been applied yet** — until it is, submitting shows an
honest error and saves nothing:

```
PGRST205: Could not find the table 'public.waitlist' in the schema cache
```

Apply it with `supabase db push` from `ciatta-mobile-app/`, or paste the file
into the SQL editor.

### Why the browser key is safe here

The page ships the publishable key, so RLS is the only boundary. The policy set
is deliberately lopsided: `anon` may **INSERT** and nothing else. There is no
`SELECT` policy, so the same key that writes cannot enumerate the list — a
signup form must never double as an email scraper.

Read signups from the dashboard or with the service role:

```sql
select email, source, created_at from public.waitlist order by created_at desc;
```

Uniqueness is case-insensitive on `lower(email)`. A repeat signup comes back as
`23505` and the page says "you're already on the list" rather than reporting a
failure.

## Things left deliberately open

- **The bundled Söhne files are subsetted.** `Sohne-Buch`, `-Halbfett` and
  `-Kraftig` have no `'`, `%`, `·`, `✓` or `×`. Those characters silently render
  in the fallback face next to Söhne text. The list markers and the caption
  separator are drawn in CSS to avoid it, but the `%` in every confidence figure
  still falls back — that one needs complete font files.
- **`public/` ships 2.4 MB nothing references.** `splash-ciatta.png` (1.8 MB) and
  `silhouette-full.png` (534 kB) are copied into `dist/` and are 77% of the build.
  Delete them or move them to the app repo.
- **No analytics.** Nothing is tracked beyond the signup row.
- **`/privacy` and `/terms` are dead links.** The footer points at routes that
  don't exist yet — worth closing before launch, since the page makes specific
  promises about data handling.
- **No confirmation email.** Joining writes a row; nobody is emailed. Wiring
  that up needs an edge function and a sending domain.

## Newsletter: Ciatta Briefs

Every email form on the site signs people up through `functions/api/newsletter/*`
(Cloudflare Pages Functions) into Resend. The flow is double opt-in:

1. **Subscribe** (`POST /api/newsletter/subscribe`): validates the address, rejects
   other origins, traps bots (honeypot field plus a minimum fill time),
   rate-limits by IP and address, and emails a signed confirmation link. Nothing
   is stored yet, and the answer is the same whether or not the address is
   already on the list.
2. **Confirm** (`/newsletter/confirm/`): the page POSTs the token, so mail
   scanners that pre-open links cannot confirm for someone. Confirming adds the
   contact to the *Newsletter subscribers* segment, opts them in to their topics,
   records the consent (source, wording, time), and sends one welcome email.
3. **Unsubscribe** (`/newsletter/unsubscribe/`, plus RFC 8058 one-click from the
   mail client): the page asks first. Broadcasts also carry Resend's own
   preference link, where a subscriber can drop one topic and keep the other.

| Form | Topics |
| --- | --- |
| Home hero, home closing, Briefs page | Ciatta Briefs + Launch news |
| Member page | Launch news, plus Briefs only if the unticked box is ticked |

Resource IDs live in `server/config.ts`. Secrets are Pages secrets:

```bash
npx wrangler pages secret put RESEND_API_KEY --project-name ciatta
npx wrangler pages secret put NEWSLETTER_SIGNING_SECRET --project-name ciatta   # openssl rand -base64 48
```

Optional: `NEWSLETTER_REPLY_TO`, `NEWSLETTER_POSTAL_ADDRESS`, and a KV namespace bound
as `NEWSLETTER_KV` (without it, rate limiting is off; the other guards still apply).

`npm test` runs the flow against an in-memory Resend.

### Sending twice a week

Issues are Markdown files in `content/briefs/issues/` (start from `_template.md`).

```bash
npm run newsletter -- new "What changes first in perimenopause"
npm run newsletter -- preview content/briefs/issues/<file>.md     # writes .newsletter-preview/
npm run newsletter -- test content/briefs/issues/<file>.md you@example.com
# set `status: ready` in the file, then:
npm run newsletter -- schedule --dry-run
npm run newsletter -- schedule
npm run newsletter -- status        # warns when a Tuesday or Friday in the next two weeks is empty
```

`schedule` books each ready issue into the next free Tuesday or Friday slot at
13:00 UTC as a Resend scheduled broadcast to the Briefs topic, then writes the
broadcast id back into the file. Commit the file after scheduling.

### Deploying

The site is the Cloudflare Pages project `ciatta` (direct upload, not Git-connected):

```bash
npm run deploy
```

import type { Env } from '../../../server/config';
import { json, logFailure, readJson, sameOrigin } from '../../../server/http';
import { newsletterService } from '../../../server/newsletter';

// POST /api/newsletter/confirm  { token }
//
// POST, called by the /newsletter/confirm/ page, never GET. Mail security
// scanners (Outlook Safe Links, Mimecast, corporate gateways) open every link
// in an email before the person does; if a GET confirmed, those scanners would
// confirm subscriptions nobody clicked, which defeats double opt-in.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ ok: false, status: 'invalid_request' });
  if (!env.RESEND_API_KEY || !env.NEWSLETTER_SIGNING_SECRET) return json({ ok: false, status: 'unavailable' });

  const body = await readJson(request);
  if (!body) return json({ ok: false, status: 'invalid_request' });

  try {
    return json(await newsletterService(env).confirm(body.token));
  } catch (error) {
    logFailure('confirm', error);
    return json({ ok: false, status: 'unavailable' });
  }
};

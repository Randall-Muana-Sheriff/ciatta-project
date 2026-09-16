import type { Env } from '../../../server/config';
import { json, logFailure, readJson, sameOrigin } from '../../../server/http';
import { newsletterService } from '../../../server/newsletter';

// POST /api/newsletter/unsubscribe
//
// Two callers:
//   · the /newsletter/unsubscribe/ page, same origin, JSON { token }
//   · a mail client's one-click unsubscribe (RFC 8058): the List-Unsubscribe
//     header points here with ?token=, and Gmail or Apple Mail POSTs
//     "List-Unsubscribe=One-Click" as a form body, from no origin at all.
// Both end in the same place, so both are accepted.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RESEND_API_KEY || !env.NEWSLETTER_SIGNING_SECRET) return json({ ok: false, status: 'unavailable' });

  let token: unknown = new URL(request.url).searchParams.get('token');
  const contentType = request.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    if (!sameOrigin(request)) return json({ ok: false, status: 'invalid_request' });
    token = (await readJson(request))?.token;
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    if (form.get('List-Unsubscribe') !== 'One-Click') return json({ ok: false, status: 'invalid_request' });
  } else {
    return json({ ok: false, status: 'invalid_request' });
  }

  try {
    return json(await newsletterService(env).unsubscribe(token));
  } catch (error) {
    logFailure('unsubscribe', error);
    return json({ ok: false, status: 'unavailable' });
  }
};

// A person who pastes the header link into a browser gets the page, which asks
// before acting. A GET never unsubscribes, for the same scanner reason as confirm.
export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  return Response.redirect(`${new URL(request.url).origin}/newsletter/unsubscribe/?token=${encodeURIComponent(token)}`, 303);
};

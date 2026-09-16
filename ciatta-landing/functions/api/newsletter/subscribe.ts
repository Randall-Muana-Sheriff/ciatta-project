import type { Env } from '../../../server/config';
import { json, logFailure, readJson, sameOrigin } from '../../../server/http';
import { newsletterService } from '../../../server/newsletter';

// POST /api/newsletter/subscribe
// { email, source, topics: ['briefs' | 'launch'], company, elapsedMs }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ ok: false, status: 'invalid_request' });
  if (!env.RESEND_API_KEY || !env.NEWSLETTER_SIGNING_SECRET) return json({ ok: false, status: 'unavailable' });

  const body = await readJson(request);
  if (!body) return json({ ok: false, status: 'invalid_request' });

  try {
    const outcome = await newsletterService(env).subscribe(
      {
        email: body.email,
        source: body.source,
        topics: body.topics,
        company: body.company,
        elapsedMs: body.elapsedMs,
      },
      request.headers.get('CF-Connecting-IP'),
    );
    return json(outcome);
  } catch (error) {
    logFailure('subscribe', error);
    return json({ ok: false, status: 'unavailable' });
  }
};

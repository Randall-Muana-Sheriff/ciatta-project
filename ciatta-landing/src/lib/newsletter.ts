// The browser side of the newsletter. The server does the real work in
// functions/api/newsletter; this only shapes the request and turns each
// outcome into one sentence she can act on.

export type Topic = 'briefs' | 'launch';
export type Source = 'hero' | 'closing' | 'member' | 'briefs';

type ApiStatus =
  | 'pending'
  | 'confirmed'
  | 'already_confirmed'
  | 'unsubscribed'
  | 'invalid_email'
  | 'invalid_request'
  | 'rate_limited'
  | 'invalid_link'
  | 'expired_link'
  | 'unavailable';

export type Result = { ok: true; status: ApiStatus } | { ok: false; status: ApiStatus; message: string };

const MESSAGES: Partial<Record<ApiStatus, string>> = {
  invalid_email: 'That does not look like a full email address.',
  invalid_request: 'Something about that request did not go through. Reload the page and try again.',
  rate_limited: 'Too many tries from this connection. Try again in an hour.',
  invalid_link: 'This link is not valid. Use the newest email we sent, or sign up again.',
  expired_link: 'This link has expired. Sign up again and we will send a fresh one.',
  unavailable: 'That did not go through on our side. Try again in a moment.',
};

async function post(path: string, body: unknown): Promise<Result> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 'unavailable', message: 'You seem to be offline. Check your connection and try again.' };
  }
  let data: { ok?: boolean; status?: ApiStatus } = {};
  try {
    data = await res.json();
  } catch {
    // A non-JSON answer is a platform error page, not our API.
  }
  const status = data.status ?? 'unavailable';
  if (data.ok) return { ok: true, status };
  return { ok: false, status, message: MESSAGES[status] ?? MESSAGES.unavailable! };
}

export function subscribe(input: {
  email: string;
  source: Source;
  topics: Topic[];
  company: string;
  elapsedMs: number;
}): Promise<Result> {
  return post('/api/newsletter/subscribe', input);
}

export function confirmSubscription(token: string): Promise<Result> {
  return post('/api/newsletter/confirm', { token });
}

export function unsubscribe(token: string): Promise<Result> {
  return post('/api/newsletter/unsubscribe', { token });
}

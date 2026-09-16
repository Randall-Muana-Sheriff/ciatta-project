import type { Outcome } from './newsletter';

const STATUS: Record<Outcome['status'], number> = {
  pending: 202,
  confirmed: 200,
  already_confirmed: 200,
  unsubscribed: 200,
  invalid_email: 422,
  invalid_request: 400,
  rate_limited: 429,
  invalid_link: 400,
  expired_link: 410,
  unavailable: 503,
};

export function json(outcome: Outcome): Response {
  return new Response(JSON.stringify(outcome), {
    status: STATUS[outcome.status],
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(outcome.status === 'rate_limited' ? { 'Retry-After': '3600' } : {}),
    },
  });
}

/** Only accept writes from the site itself. Browsers always send Origin on POST. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  const host = new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) return null;
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > 4096) return null;
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Log enough to debug a failure without writing an address into the logs. */
export function logFailure(route: string, error: unknown) {
  const detail = error instanceof Error ? { message: error.message, ...('body' in error ? { body: (error as { body: string }).body } : {}) } : { error: String(error) };
  console.error(JSON.stringify({ route, ...detail }));
}

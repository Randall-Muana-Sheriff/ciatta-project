// A small, typed client for the parts of the Resend API the newsletter uses.
// fetch directly rather than the SDK: the Functions bundle stays small and there
// is no Node compatibility flag to carry.

const API = 'https://api.resend.com';

export class ResendError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    public path: string,
  ) {
    super(`Resend ${ResendError.redact(path)} answered ${status}`);
    this.path = ResendError.redact(path);
  }

  /** Contact paths carry the address; logs must not. */
  static redact(path: string): string {
    return path.replace(/\/contacts\/[^/]*%40[^/]*/g, '/contacts/<email>');
  }
}

type Contact = {
  id: string;
  email: string;
  unsubscribed: boolean;
  properties?: Record<string, { value: string | number | null } | undefined>;
};

export type TopicSubscription = { id: string; subscription: 'opt_in' | 'opt_out' };

export function resend(apiKey: string) {
  async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ciatta-landing-newsletter',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new ResendError(res.status, text.slice(0, 500), path);
    return (text ? JSON.parse(text) : {}) as T;
  }

  const contactPath = (email: string) => `/contacts/${encodeURIComponent(email)}`;

  return {
    /** null when there is no contact with that address. */
    async getContact(email: string): Promise<Contact | null> {
      try {
        return await call<Contact>('GET', contactPath(email));
      } catch (e) {
        if (e instanceof ResendError && e.status === 404) return null;
        throw e;
      }
    },

    createContact(input: {
      email: string;
      unsubscribed: boolean;
      properties: Record<string, string>;
      segments: string[];
      topics: TopicSubscription[];
    }) {
      return call<{ id: string }>('POST', '/contacts', {
        email: input.email,
        unsubscribed: input.unsubscribed,
        properties: input.properties,
        segments: input.segments.map((id) => ({ id })),
        topics: input.topics,
      });
    },

    updateContact(email: string, input: { unsubscribed?: boolean; properties?: Record<string, string> }) {
      return call<{ id: string }>('PATCH', contactPath(email), input);
    },

    addToSegment(email: string, segmentId: string) {
      return call<{ id: string }>('POST', `${contactPath(email)}/segments/${segmentId}`);
    },

    updateTopics(email: string, topics: TopicSubscription[]) {
      return call<unknown>('PATCH', `${contactPath(email)}/topics`, { topics });
    },

    sendEmail(
      input: {
        from: string;
        to: string;
        subject: string;
        html: string;
        text: string;
        replyTo?: string;
        headers?: Record<string, string>;
        tags?: { name: string; value: string }[];
      },
      idempotencyKey?: string,
    ) {
      return call<{ id: string }>(
        'POST',
        '/emails',
        {
          from: input.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo,
          headers: input.headers,
          tags: input.tags,
        },
        idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      );
    },
  };
}

export type ResendClient = ReturnType<typeof resend>;

// Subscribe, confirm, unsubscribe. The three things the site does with an
// address, written against Env and a Resend client so they can be exercised
// without a running Pages deployment.
//
// The flow is double opt-in, which is the industry standard for a newsletter:
//
//   1. subscribe   validate, throttle, email a signed confirmation link.
//                  Nothing is stored. The response is identical whether the
//                  address is new, pending, or already subscribed, so the form
//                  cannot be used to find out who is on the list.
//   2. confirm     verify the link, then create or update the Resend contact:
//                  global subscription on, added to the segment, opted in to the
//                  chosen topics, with the consent record (source, wording,
//                  time) on the contact. First confirmation sends a welcome.
//   3. unsubscribe verify the link and turn the contact's global subscription
//                  off. Broadcasts carry Resend's own unsubscribe link too,
//                  which lets a subscriber drop one topic and keep the other.

import { consentText, newsletter, senderFor, SOURCES, TOPIC_KEYS, type Env, type Source, type TopicKey } from './config';
import { confirmationEmail, welcomeEmail } from './email/messages';
import { resend, type ResendClient } from './resend';
import { emailHash, signToken, verifyToken } from './tokens';

export type Outcome =
  | { ok: true; status: 'pending' | 'confirmed' | 'already_confirmed' | 'unsubscribed' }
  | { ok: false; status: 'invalid_email' | 'invalid_request' | 'rate_limited' | 'invalid_link' | 'expired_link' | 'unavailable' };

// ── input ──────────────────────────────────────────────────────

// Deliberately practical rather than RFC 5322 complete: a local part, an @, and
// a domain with a dot and a real TLD. Addresses this rejects are, in practice,
// typos. Real deliverability is proven by the confirmation click, not a regex.
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/;

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return null;
  const [local] = email.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  return email;
}

export type SubscribeInput = {
  email: unknown;
  source: unknown;
  topics: unknown;
  /** honeypot: a field people cannot see, so only bots fill it */
  company?: unknown;
  /** ms since the form rendered; a human needs more than a moment */
  elapsedMs?: unknown;
};

function parseTopics(raw: unknown): TopicKey[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const set = new Set<TopicKey>();
  for (const t of raw) {
    if (typeof t !== 'string' || !(TOPIC_KEYS as string[]).includes(t)) return null;
    set.add(t as TopicKey);
  }
  return TOPIC_KEYS.filter((k) => set.has(k));
}

// ── throttling ─────────────────────────────────────────────────

// KV is eventually consistent and its minimum TTL is 60s, so these are coarse
// limits, which is what they need to be: enough to stop the form being used to
// mail-bomb a stranger's inbox or burn the sending reputation.
const LIMITS = {
  perIpPerHour: 10,
  perEmailPerDay: 3,
};

async function overLimit(kv: KVNamespace | undefined, key: string, max: number, ttl: number): Promise<boolean> {
  if (!kv) return false;
  const current = Number((await kv.get(key)) ?? '0');
  if (current >= max) return true;
  await kv.put(key, String(current + 1), { expirationTtl: ttl });
  return false;
}

// ── service ────────────────────────────────────────────────────

export function newsletterService(env: Env, client: ResendClient = resend(env.RESEND_API_KEY)) {
  const secret = env.NEWSLETTER_SIGNING_SECRET;

  function link(path: string, token: string) {
    return `${newsletter.siteUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  async function unsubscribeUrl(email: string) {
    return link('/newsletter/unsubscribe/', await signToken({ p: 'unsubscribe', e: email }, secret));
  }

  return {
    async subscribe(input: SubscribeInput, ip: string | null): Promise<Outcome> {
      const email = normaliseEmail(input.email);
      if (!email) return { ok: false, status: 'invalid_email' };
      const topics = parseTopics(input.topics);
      const source = typeof input.source === 'string' && (SOURCES as readonly string[]).includes(input.source)
        ? (input.source as Source)
        : null;
      if (!topics || !source) return { ok: false, status: 'invalid_request' };

      // A bot gets the same answer a person does, and nothing is sent. Telling
      // it that it was caught only teaches it what to change.
      const elapsed = Number(input.elapsedMs);
      if ((typeof input.company === 'string' && input.company.trim() !== '') || (Number.isFinite(elapsed) && elapsed < 1500)) {
        return { ok: true, status: 'pending' };
      }

      const hash = await emailHash(email, secret);
      if (ip && (await overLimit(env.NEWSLETTER_KV, `ip:${await emailHash(ip, secret)}`, LIMITS.perIpPerHour, 3600))) {
        return { ok: false, status: 'rate_limited' };
      }
      if (await overLimit(env.NEWSLETTER_KV, `email:${hash}`, LIMITS.perEmailPerDay, 86400)) {
        // Quietly: the address owner has already been sent a link today.
        return { ok: true, status: 'pending' };
      }

      // Already confirmed for everything asked for: no need to mail them again.
      const existing = await client.getContact(email);
      if (existing && !existing.unsubscribed && existing.properties?.confirmed_at?.value) {
        const current = String(existing.properties?.signup_topics?.value ?? '');
        if (topics.every((t) => current.split(',').includes(t))) return { ok: true, status: 'pending' };
      }

      const token = await signToken({ p: 'confirm', e: email, t: topics, s: source }, secret);
      const message = confirmationEmail(link('/newsletter/confirm/', token), topics, env.NEWSLETTER_POSTAL_ADDRESS);
      const sender = senderFor(topics);
      await client.sendEmail(
        {
          from: sender.from,
          to: email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: sender.replyTo,
          tags: [
            { name: 'category', value: 'newsletter_confirmation' },
            { name: 'source', value: source },
          ],
        },
        // Same address, same minute: a double-clicked submit sends one email.
        `confirm-${hash}-${Math.floor(Date.now() / 60000)}`,
      );
      return { ok: true, status: 'pending' };
    },

    async confirm(token: unknown): Promise<Outcome> {
      if (typeof token !== 'string') return { ok: false, status: 'invalid_link' };
      const verified = await verifyToken(token, secret, 'confirm', newsletter.confirmTtlSeconds);
      if (!verified.ok) return { ok: false, status: verified.reason === 'expired' ? 'expired_link' : 'invalid_link' };

      const { e: email, t, s } = verified.claims;
      const topics = parseTopics(t) ?? ['briefs'];
      const now = new Date().toISOString();
      const topicSubs = topics.map((k) => ({ id: newsletter.topics[k], subscription: 'opt_in' as const }));

      const existing = await client.getContact(email);
      const wasConfirmed = Boolean(existing && !existing.unsubscribed && existing.properties?.confirmed_at?.value);
      const previousTopics = String(existing?.properties?.signup_topics?.value ?? '').split(',').filter(Boolean);
      const allTopics = TOPIC_KEYS.filter((k) => topics.includes(k) || previousTopics.includes(k));

      const properties = {
        signup_source: s ?? 'unknown',
        confirmed_at: now,
        consent_text: consentText(allTopics, s),
        signup_topics: allTopics.join(','),
      };

      if (!existing) {
        await client.createContact({
          email,
          unsubscribed: false,
          properties,
          segments: [newsletter.segmentId],
          topics: topicSubs,
        });
      } else {
        await client.updateContact(email, { unsubscribed: false, properties });
        await client.addToSegment(email, newsletter.segmentId).catch((e) => {
          // Already a member answers with a conflict, which is the state we want.
          if (!(e instanceof Error && 'status' in e && (e as { status: number }).status === 409)) throw e;
        });
        await client.updateTopics(email, topicSubs);
      }

      const newTopics = topics.filter((k) => !previousTopics.includes(k));
      if (!wasConfirmed || newTopics.length > 0) {
        const unsub = await unsubscribeUrl(email);
        const message = welcomeEmail(unsub, allTopics, env.NEWSLETTER_POSTAL_ADDRESS);
        await client.sendEmail(
          {
            from: senderFor(topics).from,
            to: email,
            subject: message.subject,
            html: message.html,
            text: message.text,
            replyTo: senderFor(topics).replyTo,
            headers: {
              'List-Unsubscribe': `<${unsub.replace('/newsletter/unsubscribe/', '/api/newsletter/unsubscribe')}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            tags: [{ name: 'category', value: 'newsletter_welcome' }],
          },
          `welcome-${await emailHash(email, secret)}-${allTopics.join('_')}`,
        );
      }
      return { ok: true, status: wasConfirmed && newTopics.length === 0 ? 'already_confirmed' : 'confirmed' };
    },

    async unsubscribe(token: unknown): Promise<Outcome> {
      if (typeof token !== 'string') return { ok: false, status: 'invalid_link' };
      // No expiry: an unsubscribe link in a two-year-old email must still work.
      const verified = await verifyToken(token, secret, 'unsubscribe', null);
      if (!verified.ok) return { ok: false, status: 'invalid_link' };
      const email = verified.claims.e;
      if (await client.getContact(email)) {
        await client.updateContact(email, { unsubscribed: true });
      }
      return { ok: true, status: 'unsubscribed' };
    },
  };
}

// Newsletter wiring. The IDs below name resources in Ciatta's Resend account;
// they are not secrets (nothing can be done with them without the API key),
// so they live in the repo where a change to them is reviewed like code.

export const newsletter = {
  /** Every confirmed subscriber, whichever topics they chose. Broadcasts target this. */
  segmentId: 'b7384901-def0-400f-a167-faaf462f9e42',
  topics: {
    /** Ciatta Briefs, the twice-weekly newsletter. Opt-out by default: a contact
        only receives it after confirming a subscription that included it. */
    briefs: 'd32021a0-fb82-44a7-86e0-0eb1274ef59d',
    /** Launch news: when Ciatta opens and changes to membership. A few a year. */
    launch: 'bdd4b7d7-8283-4308-a0ac-eab3086f64ed',
  },
  from: 'Ciatta Briefs <briefs@ciatta.io>',
  /** Where replies go. Cloudflare Email Routing forwards it to the team inbox.
      NEWSLETTER_REPLY_TO overrides it. */
  replyTo: 'briefs@ciatta.io',
  siteUrl: 'https://ciatta.io',
  /** How long a confirmation link stays valid. */
  confirmTtlSeconds: 7 * 24 * 60 * 60,
} as const;

export type TopicKey = keyof typeof newsletter.topics;
export const TOPIC_KEYS = Object.keys(newsletter.topics) as TopicKey[];

/** Where each form on the site is allowed to say a signup came from. */
export const SOURCES = ['hero', 'closing', 'member', 'briefs'] as const;
export type Source = (typeof SOURCES)[number];

/** The sentence each subscriber agreed to, stored on their contact as the consent record. */
export function consentText(topics: TopicKey[]): string {
  const parts = [];
  if (topics.includes('briefs')) parts.push('Ciatta Briefs by email twice a week (Tuesday and Friday)');
  if (topics.includes('launch')) parts.push('occasional news about Ciatta opening and membership');
  return `Agreed to receive ${parts.join(' and ')}. Can unsubscribe at any time.`;
}

export interface Env {
  RESEND_API_KEY: string;
  /** HMAC key for confirmation and unsubscribe links. 32+ random bytes. */
  NEWSLETTER_SIGNING_SECRET: string;
  /** Optional. A monitored inbox for replies; omitted from mail when unset. */
  NEWSLETTER_REPLY_TO?: string;
  /** Optional. The postal address CAN-SPAM requires in commercial email. */
  NEWSLETTER_POSTAL_ADDRESS?: string;
  /** Rate-limit counters. Optional so local runs work without it. */
  NEWSLETTER_KV?: KVNamespace;
}

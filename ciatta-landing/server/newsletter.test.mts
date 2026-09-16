// Flow tests for the newsletter against an in-memory stand-in for Resend.
// Run with `npm test`. No network, no API key.
import assert from 'node:assert/strict';
import { newsletterService, normaliseEmail } from './newsletter.ts';
import { signToken, verifyToken } from './tokens.ts';
import { newsletter } from './config.ts';

const SECRET = 'test-secret-0123456789abcdef0123456789';
type C = { id: string; email: string; unsubscribed: boolean; properties: Record<string, { value: string }>; segments: Set<string>; topics: Map<string, string> };
function fake() {
  const contacts = new Map<string, C>(); const sent: any[] = []; const calls: string[] = [];
  const client: any = {
    async getContact(e: string) { calls.push('get'); const c = contacts.get(e); return c ? { ...c } : null; },
    async createContact(i: any) { calls.push('create'); contacts.set(i.email, { id: 'c1', email: i.email, unsubscribed: i.unsubscribed, properties: Object.fromEntries(Object.entries(i.properties).map(([k, v]) => [k, { value: v as string }])), segments: new Set(i.segments), topics: new Map(i.topics.map((t: any) => [t.id, t.subscription])) }); return { id: 'c1' }; },
    async updateContact(e: string, i: any) { calls.push('update'); const c = contacts.get(e)!; if (i.unsubscribed !== undefined) c.unsubscribed = i.unsubscribed; for (const [k, v] of Object.entries(i.properties ?? {})) c.properties[k] = { value: v as string }; return { id: c.id }; },
    async addToSegment(e: string, s: string) { calls.push('segment'); contacts.get(e)!.segments.add(s); return { id: s }; },
    async updateTopics(e: string, t: any[]) { calls.push('topics'); for (const x of t) contacts.get(e)!.topics.set(x.id, x.subscription); return {}; },
    async sendEmail(m: any, key?: string) { sent.push({ ...m, key }); return { id: 'm' + sent.length }; },
  };
  return { client, contacts, sent, calls };
}
const env: any = { RESEND_API_KEY: 'x', NEWSLETTER_SIGNING_SECRET: SECRET };
const ok = (x: any) => console.log('  ✓', x);

// validation
assert.equal(normaliseEmail('  Maya@Example.COM '), 'maya@example.com');
for (const bad of ['maya', 'maya@', '@x.com', 'maya@x', 'ma..ya@x.com', 'a@b.c', 'x'.repeat(65) + '@x.com', 12]) assert.equal(normaliseEmail(bad), null, String(bad));
ok('email validation');

// tokens
const t = await signToken({ p: 'confirm', e: 'a@b.co', t: ['briefs'], s: 'hero' }, SECRET);
assert.equal((await verifyToken(t, SECRET, 'confirm', 60)).ok, true);
assert.deepEqual(await verifyToken(t, 'other-secret', 'confirm', 60), { ok: false, reason: 'invalid' });
assert.deepEqual(await verifyToken(t, SECRET, 'unsubscribe', null), { ok: false, reason: 'invalid' });
const [body, sig] = t.split('.'); const tampered = body.slice(0, -2) + (body.endsWith('A') ? 'B' : 'A') + body.slice(-1) + '.' + sig;
assert.equal((await verifyToken(tampered, SECRET, 'confirm', 60)).ok, false);
const old = await signToken({ p: 'confirm', e: 'a@b.co' }, SECRET, Date.now() - 8 * 86400e3);
assert.deepEqual(await verifyToken(old, SECRET, 'confirm', newsletter.confirmTtlSeconds), { ok: false, reason: 'expired' });
ok('tokens: sign, verify, wrong secret, wrong purpose, tampered, expired');

// subscribe guards
{ const f = fake(); const s = newsletterService(env, f.client);
  assert.equal((await s.subscribe({ email: 'nope', source: 'hero', topics: ['briefs'], elapsedMs: 5000 }, '1.1.1.1')).status, 'invalid_email');
  assert.equal((await s.subscribe({ email: 'a@b.co', source: 'evil', topics: ['briefs'], elapsedMs: 5000 }, null)).status, 'invalid_request');
  assert.equal((await s.subscribe({ email: 'a@b.co', source: 'hero', topics: ['spam'], elapsedMs: 5000 }, null)).status, 'invalid_request');
  assert.equal((await s.subscribe({ email: 'a@b.co', source: 'hero', topics: [], elapsedMs: 5000 }, null)).status, 'invalid_request');
  const bot1 = await s.subscribe({ email: 'a@b.co', source: 'hero', topics: ['briefs'], company: 'ACME', elapsedMs: 5000 }, null);
  const bot2 = await s.subscribe({ email: 'a@b.co', source: 'hero', topics: ['briefs'], elapsedMs: 300 }, null);
  assert.deepEqual([bot1.status, bot2.status], ['pending', 'pending']); assert.equal(f.sent.length, 0);
  ok('subscribe rejects bad input; honeypot and too-fast bots get "pending" and no email'); }

// full flow
{ const f = fake(); const s = newsletterService(env, f.client);
  const r = await s.subscribe({ email: 'Maya@Example.com', source: 'hero', topics: ['briefs', 'launch'], elapsedMs: 4000 }, '1.1.1.1');
  assert.equal(r.status, 'pending'); assert.equal(f.contacts.size, 0, 'nothing stored before confirmation'); assert.equal(f.sent.length, 1);
  const m = f.sent[0]; assert.equal(m.to, 'maya@example.com'); assert.match(m.subject, /Confirm/); assert.ok(m.text.length > 50);
  const link = m.html.match(/https:\/\/ciatta\.io\/newsletter\/confirm\/\?token=([^"&]+)/); assert.ok(link, 'confirm link present');
  ok('subscribe sends one confirmation with a /newsletter/confirm/ link, stores nothing');

  const token = decodeURIComponent(link[1]);
  const c1 = await s.confirm(token); assert.equal(c1.status, 'confirmed');
  const c = f.contacts.get('maya@example.com')!;
  assert.equal(c.unsubscribed, false); assert.ok(c.segments.has(newsletter.segmentId));
  assert.equal(c.topics.get(newsletter.topics.briefs), 'opt_in'); assert.equal(c.topics.get(newsletter.topics.launch), 'opt_in');
  assert.equal(c.properties.signup_source.value, 'hero'); assert.ok(c.properties.confirmed_at.value); assert.match(c.properties.consent_text.value, /twice a week/);
  const welcome = f.sent[1]; assert.match(welcome.subject, /subscribed/); assert.ok(welcome.headers['List-Unsubscribe'].includes('/api/newsletter/unsubscribe?token='));
  assert.equal(welcome.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  ok('confirm creates contact: segment, both topics opted in, consent record; sends welcome with one-click unsubscribe headers');

  const c2 = await s.confirm(token); assert.equal(c2.status, 'already_confirmed'); assert.equal(f.sent.length, 2, 'no second welcome');
  ok('clicking the confirm link again is harmless: no duplicate welcome');

  const again = await s.subscribe({ email: 'maya@example.com', source: 'closing', topics: ['briefs'], elapsedMs: 4000 }, '1.1.1.1');
  assert.equal(again.status, 'pending'); assert.equal(f.sent.length, 2);
  ok('already-subscribed address gets the same "pending" answer and no email (no list enumeration)');

  const unsubToken = decodeURIComponent(welcome.headers['List-Unsubscribe'].match(/token=([^>]+)/)[1]);
  assert.equal((await s.unsubscribe(unsubToken)).status, 'unsubscribed'); assert.equal(c.unsubscribed, true);
  assert.equal((await s.unsubscribe('garbage')).status, 'invalid_link');
  ok('unsubscribe link turns off the global subscription; garbage token rejected');

  const resub = await s.subscribe({ email: 'maya@example.com', source: 'briefs', topics: ['briefs'], elapsedMs: 4000 }, null);
  assert.equal(resub.status, 'pending'); assert.equal(f.sent.length, 3);
  const tok2 = decodeURIComponent(f.sent[2].html.match(/token=([^"&]+)/)[1]);
  assert.equal((await s.confirm(tok2)).status, 'confirmed'); assert.equal(c.unsubscribed, false);
  ok('someone who unsubscribed can sign up again and confirm'); }

// waitlist-only
{ const f = fake(); const s = newsletterService(env, f.client);
  await s.subscribe({ email: 'w@x.io', source: 'member', topics: ['launch'], elapsedMs: 4000 }, null);
  const tok = decodeURIComponent(f.sent[0].html.match(/token=([^"&]+)/)[1]); await s.confirm(tok);
  const c = f.contacts.get('w@x.io')!; assert.equal(c.topics.get(newsletter.topics.launch), 'opt_in'); assert.equal(c.topics.has(newsletter.topics.briefs), false);
  assert.match(f.sent[1].subject, /on the Ciatta waitlist/);
  ok('member-page waitlist signup opts in to launch news only, never Briefs'); }
console.log('all passed');

#!/usr/bin/env node
// Ciatta Briefs: write in Markdown, preview, and schedule twice a week.
//
//   npm run newsletter -- new "What changes first in perimenopause"
//   npm run newsletter -- preview content/briefs/issues/<file>.md
//   npm run newsletter -- schedule [--dry-run]
//   npm run newsletter -- status
//   npm run newsletter -- test content/briefs/issues/<file>.md you@example.com
//
// Each issue is one Markdown file in content/briefs/issues with a small header:
//
//   ---
//   subject: What changes first in perimenopause
//   preheader: Cycle length usually moves before anything else.
//   status: draft            # draft | ready
//   ---
//
// `schedule` takes every `ready` issue that has no broadcast yet, in filename
// order, and books it into the next free slot, Tuesday and Friday at
// NEWSLETTER_SEND_HOUR_UTC (13:00 UTC by default: 9am New York, 2pm London).
// Resend holds the scheduled send, so nothing on this machine has to be
// running when it goes out. The broadcast id and send time are written back
// into the file, which is what stops an issue being booked twice.
//
// Needs RESEND_API_KEY in the environment or in ciatta-landing/.env.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { brand, escapeHtml, renderEmail, toPlainText } from '../server/email/layout.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ISSUES = join(root, 'content/briefs/issues');
const PREVIEWS = join(root, '.newsletter-preview');

// Mirrors server/config.ts. Kept literal here so this script runs on plain Node.
const CONFIG = {
  segmentId: 'b7384901-def0-400f-a167-faaf462f9e42',
  briefsTopicId: 'd32021a0-fb82-44a7-86e0-0eb1274ef59d',
  from: 'Ciatta Briefs <briefs@ciatta.io>',
  replyTo: 'briefs@ciatta.io',
  siteUrl: 'https://ciatta.io',
  sendDays: [2, 5], // Tuesday, Friday (Date#getUTCDay)
};

loadDotEnv();
const SEND_HOUR = Number(process.env.NEWSLETTER_SEND_HOUR_UTC ?? 13);

// ── issue files ────────────────────────────────────────────────

function parseIssue(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${basename(file)}: missing the --- header block`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*?)\s*(#.*)?$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { file, meta, body: m[2].trim() };
}

function writeMeta(issue, updates) {
  const raw = readFileSync(issue.file, 'utf8');
  const [, header, body] = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let lines = header.split('\n');
  for (const [k, v] of Object.entries(updates)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}:`));
    if (i >= 0) lines[i] = `${k}: ${v}`;
    else lines.push(`${k}: ${v}`);
  }
  writeFileSync(issue.file, `---\n${lines.join('\n')}\n---\n${body}`);
}

function issues() {
  if (!existsSync(ISSUES)) return [];
  return readdirSync(ISSUES)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((f) => parseIssue(join(ISSUES, f)));
}

function validate(issue) {
  const problems = [];
  if (!issue.meta.subject) problems.push('no subject');
  else if (issue.meta.subject.length > 70) problems.push(`subject is ${issue.meta.subject.length} characters; inboxes cut off around 60`);
  if (!issue.meta.preheader) problems.push('no preheader (the grey preview line in the inbox)');
  if (issue.body.length < 200) problems.push('body is under 200 characters');
  if (/\bTODO\b|\bTK\b|lorem ipsum/i.test(issue.body)) problems.push('body still has TODO, TK or placeholder text');
  return problems;
}

// ── rendering ──────────────────────────────────────────────────

/** Markdown to email-safe HTML: every element gets its styles inline. */
function renderBody(markdown) {
  const html = marked.parse(markdown, { async: false, gfm: true });
  const s = (css) => ` style="${css}"`;
  const text = `font-family:${brand.font};color:${brand.body};`;
  return html
    .replace(/<h1>/g, `<h1${s(`margin:0 0 16px 0;font-family:${brand.font};font-size:26px;font-weight:500;line-height:32px;color:${brand.ink};`)}>`)
    .replace(/<h2>/g, `<h2${s(`margin:28px 0 12px 0;font-family:${brand.font};font-size:20px;font-weight:500;line-height:26px;color:${brand.ink};`)}>`)
    .replace(/<h3>/g, `<h3${s(`margin:24px 0 8px 0;font-family:${brand.font};font-size:17px;font-weight:500;line-height:24px;color:${brand.ink};`)}>`)
    .replace(/<p>/g, `<p${s(`margin:0 0 16px 0;${text}font-size:16px;line-height:26px;`)}>`)
    .replace(/<ul>/g, `<ul${s(`margin:0 0 16px 0;padding-left:20px;${text}font-size:16px;line-height:26px;`)}>`)
    .replace(/<ol>/g, `<ol${s(`margin:0 0 16px 0;padding-left:20px;${text}font-size:16px;line-height:26px;`)}>`)
    .replace(/<li>/g, `<li${s('margin:0 0 6px 0;')}>`)
    .replace(/<blockquote>/g, `<blockquote${s(`margin:0 0 16px 0;padding:4px 0 4px 16px;border-left:3px solid ${brand.change};`)}>`)
    .replace(/<strong>/g, `<strong${s(`color:${brand.ink};font-weight:500;`)}>`)
    .replace(/<hr>/g, `<hr${s(`border:0;border-top:1px solid ${brand.rule};margin:28px 0;`)}>`)
    .replace(/<a href="([^"]+)"/g, (_, href) => `<a href="${href}"${s(`color:${brand.ink};text-decoration:underline;`)} target="_blank"`);
}

function footer() {
  const address = process.env.NEWSLETTER_POSTAL_ADDRESS;
  return [
    'You are receiving Ciatta Briefs because you subscribed at ciatta.io. Nothing in it is medical advice, and none of it is about you in particular.',
    `<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${brand.meta};">Unsubscribe or choose what you receive</a> · <a href="${CONFIG.siteUrl}/briefs/" style="color:${brand.meta};">Read past Briefs</a> · <a href="${CONFIG.siteUrl}/privacy/" style="color:${brand.meta};">Privacy</a>`,
    address ? `Ciatta · ${escapeHtml(address)}` : 'Ciatta',
  ].join('<br><br>');
}

function build(issue) {
  const bodyHtml = renderBody(issue.body);
  const footerHtml = footer();
  const html = renderEmail({
    title: issue.meta.subject,
    preheader: issue.meta.preheader ?? '',
    bodyHtml,
    footerHtml,
    siteUrl: CONFIG.siteUrl,
  });
  return { html, text: toPlainText(bodyHtml + '\n\n' + footerHtml) };
}

// ── Resend ─────────────────────────────────────────────────────

async function api(method, path, body) {
  const key = process.env.RESEND_API_KEY;
  if (!key) fail('RESEND_API_KEY is not set. Add it to ciatta-landing/.env (never commit that file).');
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Resend ${method} ${path} answered ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// ── slots ──────────────────────────────────────────────────────

function* slotsFrom(start) {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), SEND_HOUR));
  for (let i = 0; i < 400; i++) {
    if (CONFIG.sendDays.includes(d.getUTCDay()) && d > start) yield new Date(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

const dayKey = (date) => date.toISOString().slice(0, 10);
const human = (date) =>
  date.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

async function bookedDays() {
  const taken = new Set();
  for (const issue of issues()) if (issue.meta.scheduled_at) taken.add(dayKey(new Date(issue.meta.scheduled_at)));
  if (process.env.RESEND_API_KEY) {
    const { data = [] } = await api('GET', '/broadcasts');
    for (const b of data) if (b.scheduled_at && b.status !== 'sent') taken.add(dayKey(new Date(b.scheduled_at)));
  }
  return taken;
}

// ── commands ───────────────────────────────────────────────────

const commands = {
  new(title) {
    if (!title) fail('Usage: npm run newsletter -- new "Title of the issue"');
    mkdirSync(ISSUES, { recursive: true });
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const file = join(ISSUES, `${new Date().toISOString().slice(0, 10)}-${slug}.md`);
    if (existsSync(file)) fail(`${basename(file)} already exists`);
    const template = readFileSync(join(ISSUES, '_template.md'), 'utf8').replace('subject: ', `subject: ${title}`);
    writeFileSync(file, template);
    console.log(`Created ${file.replace(root + '/', '')}. Set status: ready when it is done.`);
  },

  preview(path) {
    if (!path) fail('Usage: npm run newsletter -- preview <issue.md>');
    const issue = parseIssue(resolve(path));
    const problems = validate(issue);
    const { html, text } = build(issue);
    mkdirSync(PREVIEWS, { recursive: true });
    const out = join(PREVIEWS, basename(issue.file, '.md'));
    writeFileSync(`${out}.html`, html);
    writeFileSync(`${out}.txt`, text);
    console.log(`Preview written to ${out}.html and .txt`);
    if (problems.length) console.log(`Needs attention:\n  · ${problems.join('\n  · ')}`);
  },

  async test(path, to) {
    if (!path || !to) fail('Usage: npm run newsletter -- test <issue.md> you@example.com');
    const issue = parseIssue(resolve(path));
    const { html, text } = build(issue);
    const sent = await api('POST', '/emails', {
      from: CONFIG.from,
      to: [to],
      subject: `[Test] ${issue.meta.subject}`,
      html: html.replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', `${CONFIG.siteUrl}/newsletter/unsubscribe/`),
      text: text.replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', `${CONFIG.siteUrl}/newsletter/unsubscribe/`),
      reply_to: CONFIG.replyTo,
    });
    console.log(`Test sent to ${to} (${sent.id}).`);
  },

  async schedule(...flags) {
    const dryRun = flags.includes('--dry-run');
    const queue = issues().filter((i) => i.meta.status === 'ready' && !i.meta.broadcast_id);
    if (queue.length === 0) {
      console.log('Nothing to schedule: no issue has status: ready without a broadcast.');
      return commands.status();
    }

    const blocked = queue.map((i) => [i, validate(i)]).filter(([, p]) => p.length);
    if (blocked.length) {
      for (const [i, p] of blocked) console.error(`${basename(i.file)}:\n  · ${p.join('\n  · ')}`);
      fail('Fix those before scheduling. Nothing was booked.');
    }

    const taken = await bookedDays();
    // Leave at least two hours to catch a mistake before it goes out.
    const slots = slotsFrom(new Date(Date.now() + 2 * 3600 * 1000));
    for (const issue of queue) {
      let slot = slots.next().value;
      while (slot && taken.has(dayKey(slot))) slot = slots.next().value;
      taken.add(dayKey(slot));
      const { html, text } = build(issue);
      if (dryRun) {
        console.log(`would book  ${human(slot)}  ${issue.meta.subject}`);
        continue;
      }
      const created = await api('POST', '/broadcasts', {
        name: `Briefs · ${dayKey(slot)} · ${issue.meta.subject}`.slice(0, 100),
        segment_id: CONFIG.segmentId,
        topic_id: CONFIG.briefsTopicId,
        from: CONFIG.from,
        reply_to: CONFIG.replyTo,
        subject: issue.meta.subject,
        html,
        text,
        send: true,
        scheduled_at: slot.toISOString(),
      });
      writeMeta(issue, { broadcast_id: created.id, scheduled_at: slot.toISOString() });
      console.log(`booked      ${human(slot)}  ${issue.meta.subject}`);
    }
    if (!dryRun) await commands.status();
  },

  async status() {
    const all = issues();
    const now = Date.now();
    const upcoming = all
      .filter((i) => i.meta.scheduled_at && new Date(i.meta.scheduled_at).getTime() > now)
      .sort((a, b) => a.meta.scheduled_at.localeCompare(b.meta.scheduled_at));
    const ready = all.filter((i) => i.meta.status === 'ready' && !i.meta.broadcast_id);
    const drafts = all.filter((i) => i.meta.status !== 'ready');

    console.log('\nScheduled');
    if (upcoming.length === 0) console.log('  (none)');
    for (const i of upcoming) console.log(`  ${human(new Date(i.meta.scheduled_at))}  ${i.meta.subject}`);
    console.log(`\nReady to book: ${ready.length}    Drafts: ${drafts.length}`);

    // Two a week is the promise on the form. Say so plainly when it is at risk.
    const fortnight = [...slotsFrom(new Date(now))].filter((d) => d.getTime() < now + 14 * 86400 * 1000);
    const booked = new Set(upcoming.map((i) => dayKey(new Date(i.meta.scheduled_at))));
    const gaps = fortnight.filter((d) => !booked.has(dayKey(d)));
    if (gaps.length) {
      console.log(`\nWarning: ${gaps.length} of the next ${fortnight.length} send days have nothing booked:`);
      for (const d of gaps) console.log(`  ${human(d)}`);
    } else {
      console.log('\nThe next two weeks are fully booked.');
    }
  },
};

// ── plumbing ───────────────────────────────────────────────────

function loadDotEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (!commands[cmd]) {
  fail('Commands: new "<title>" · preview <file> · test <file> <email> · schedule [--dry-run] · status');
}
await commands[cmd](...args);

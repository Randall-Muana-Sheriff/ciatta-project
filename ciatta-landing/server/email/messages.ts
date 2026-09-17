// The two messages the site sends on its own. Everything else is a broadcast.

import { newsletter, type TopicKey } from '../config';
import { button, escapeHtml, heading, paragraph, renderEmail, toPlainText } from './layout.js';

type Built = { subject: string; html: string; text: string };

function describe(topics: TopicKey[]): string {
  if (topics.includes('briefs') && topics.includes('launch')) {
    return 'Ciatta Briefs every Tuesday, and a note when Ciatta opens';
  }
  if (topics.includes('briefs')) return 'Ciatta Briefs, every Tuesday';
  return 'a note when Ciatta opens, and news about membership';
}

/** Sent the moment someone submits the form. Nothing is subscribed until they click. */
export function confirmationEmail(confirmUrl: string, topics: TopicKey[], postalAddress?: string): Built {
  const briefs = topics.includes('briefs');
  const subject = briefs ? 'Confirm your subscription to Ciatta Briefs' : 'Confirm your place on the Ciatta waitlist';
  const bodyHtml = [
    heading(briefs ? 'One click to confirm' : 'Confirm your place'),
    paragraph(`Someone, hopefully you, entered this address on ciatta.io to receive ${escapeHtml(describe(topics))}.`),
    paragraph('Confirm and you are on the list. If you did not ask, ignore this and nothing more will arrive.'),
    button(confirmUrl, 'Confirm subscription'),
    paragraph(
      `<span style="font-size:14px;line-height:22px;">The link works for 7 days. If the button does not open, paste this into your browser:<br><a href="${escapeHtml(confirmUrl)}" style="color:#494C4F;word-break:break-all;">${escapeHtml(confirmUrl)}</a></span>`,
    ),
  ].join('\n');

  const footerHtml = footer('You received this because this address was entered on ciatta.io.', postalAddress);
  const html = renderEmail({
    title: subject,
    preheader: briefs
      ? 'Confirm to start receiving Ciatta Briefs. The link works for 7 days.'
      : 'Confirm to hear from us when Ciatta opens. The link works for 7 days.',
    bodyHtml,
    footerHtml,
    siteUrl: newsletter.siteUrl,
  });
  return { subject, html, text: toPlainText(bodyHtml + '\n' + footerHtml) };
}

/** Sent once, when a subscription is confirmed for the first time. */
export function welcomeEmail(unsubscribeUrl: string, topics: TopicKey[], postalAddress?: string): Built {
  const briefs = topics.includes('briefs');
  const subject = briefs ? 'You are subscribed to Ciatta Briefs' : 'You are on the Ciatta waitlist';
  const bodyHtml = [
    heading(briefs ? 'You are subscribed' : 'You are on the list'),
    briefs
      ? paragraph(
          'Ciatta Briefs arrives every <strong style="color:#18191B;font-weight:500;">Tuesday</strong>. Each one is short and about one thing: what tends to change first in perimenopause, what a lab result can and cannot say, what is worth bringing to an appointment.',
        )
      : paragraph('We will write when Ciatta opens, and when anything about membership changes. That is all.'),
    briefs
      ? paragraph('Nothing in it is about you in particular, and none of it is medical advice. It is there to help you notice, and to ask better questions.')
      : '',
    topics.includes('launch') && briefs ? paragraph('You will also hear from us the day Ciatta opens.') : '',
    paragraph(`While you wait, the reading list is at <a href="${newsletter.siteUrl}/briefs/" style="color:#18191B;">ciatta.io/briefs</a>.`),
  ]
    .filter(Boolean)
    .join('\n');

  const footerHtml = footer(
    `You are receiving this because you confirmed a subscription at ciatta.io. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#585B5E;">Unsubscribe</a>.`,
    postalAddress,
  );
  const html = renderEmail({
    title: subject,
    preheader: briefs ? 'The first issue arrives on Tuesday.' : 'You are on the waitlist. We will write when Ciatta opens.',
    bodyHtml,
    footerHtml,
    siteUrl: newsletter.siteUrl,
  });
  return { subject, html, text: toPlainText(bodyHtml + '\n' + footerHtml) };
}

function footer(reason: string, postalAddress?: string): string {
  const lines = [reason, `<a href="${newsletter.siteUrl}/privacy/" style="color:#585B5E;">Privacy</a> · Ciatta`];
  if (postalAddress) lines.push(escapeHtml(postalAddress));
  return lines.join('<br>');
}

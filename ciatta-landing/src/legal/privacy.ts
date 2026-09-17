import { LEGAL } from './config';
import type { LegalDoc } from './types';

// Written from what the site does today, which was checked in the code:
//   · forms: email, which form, chosen topics, consent wording and time
//     (functions/api/newsletter, server/newsletter.ts)
//   · waitlist reservations from the home hero and member page, stored in Supabase
//     (src/lib/waitlist.ts)
//   · email sent through Resend, with open and click tracking switched off
//     on the ciatta.io sending domain
//   · hosting and security by Cloudflare Pages; rate-limit counters keyed by a
//     one-way hash of the IP address or email, kept for at most 24 hours
//   · fonts loaded from Google Fonts
//   · no cookies, no analytics, no advertising pixels, no local storage
// If any of that changes, this document has to change with it.

export const privacy: LegalDoc = {
  title: 'Privacy notice',
  summary: `How ${LEGAL.operator} handles the little personal information this website and our emails use.`,
  plainly: [
    'This notice covers ciatta.io, the Ciatta Briefs newsletter and the waitlist. The Ciatta app is not open yet and will have its own notice before it is.',
    'We ask for one thing: your email address. We do not ask for health information on this website.',
    'The site sets no cookies and runs no analytics or advertising trackers. We do not track whether you open our emails or click their links.',
    'We never sell your information, and we do not use it for advertising.',
    'You can unsubscribe from any email in one click, and ask us to delete your address at any time.',
  ],
  sections: [
    {
      id: 'who',
      title: 'Who we are',
      blocks: [
        {
          p: `ciatta.io is operated by ${LEGAL.operator} ("Ciatta", "we", "us"). We decide how and why the information described here is used, which makes us the controller of it under data protection laws such as the GDPR and UK GDPR.`,
        },
        { p: `Questions and requests about your information: ${LEGAL.privacyEmail}.` },
      ],
    },
    {
      id: 'collect',
      title: 'What we collect and why',
      blocks: [
        {
          table: {
            head: ['What', 'When', 'Why', 'Legal basis'],
            rows: [
              [
                'Your email address',
                'You enter it in a form on the site',
                'To send the confirmation email, then what you asked for',
                'Your consent',
              ],
              [
                'Which form you used, which emails you chose, the wording you agreed to, and when you confirmed',
                'You confirm your subscription',
                'To keep a record that you asked for these emails, and to send only those',
                'Legal obligation and legitimate interests (proving consent)',
              ],
              [
                'Your waitlist reservation (email address and the page you joined from)',
                'You join the waitlist on the home page or the member page',
                'To tell you when Ciatta opens',
                'Your consent',
              ],
              [
                'IP address, browser type and request details',
                'Any visit, processed by our host',
                'To deliver the site, and to protect it and the forms from abuse',
                'Legitimate interests (security)',
              ],
            ],
          },
        },
        {
          p: 'To stop the forms being used to flood someone else’s inbox, we count recent attempts per IP address and per email address. Those counters are stored under a one-way cryptographic hash rather than the address itself, and are deleted automatically within 24 hours.',
        },
        {
          p: 'We do not collect health information, payment details, precise location, or information from social networks on this website.',
        },
      ],
    },
    {
      id: 'emails',
      title: 'Our emails',
      blocks: [
        {
          p: 'We use double opt-in: nothing is sent to you, beyond one confirmation email, until you click the link in it. If you did not ask for it, ignore it and your address is not added.',
        },
        {
          list: [
            'The waitlist form in the home page hero, the one at its foot, and the member page, send launch news only: when Ciatta opens and when membership changes. That is occasional. On the home page you tick a box agreeing to emails about early access and product updates before either form will send.',
            'The newsletter form on the Briefs page sends Ciatta Briefs every Tuesday.',
            'Signing up for one is not signing up for the other. The member page offers Briefs as a separate box you can tick.',
            'Every email has an unsubscribe link, and supports one-click unsubscribe in mail apps that offer it. The preference page lets you stop one kind and keep the other.',
            'We have switched off open and click tracking, so we do not know whether you read an email or which links you follow.',
          ],
        },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies and tracking',
      blocks: [
        {
          p: 'The site sets no cookies and stores nothing in your browser. It runs no analytics, advertising, session recording or social media pixels, so there is no cookie banner because there is nothing to consent to.',
        },
        {
          p: 'Our fonts are loaded from Google Fonts. To send them, Google receives your IP address and browser details, as with any request to its servers. Google states that it does not use this to profile visitors or set cookies.',
        },
      ],
    },
    {
      id: 'share',
      title: 'Who we share it with',
      blocks: [
        {
          p: 'We use a small number of service providers who process information only on our instructions, under contracts that require them to protect it:',
        },
        {
          table: {
            head: ['Provider', 'What they do for us', 'Where'],
            rows: [
              ['Resend', 'Sends our emails and keeps the subscriber list', 'United States'],
              ['Cloudflare', 'Hosts the website and runs the signup forms; security', 'Global network'],
              ['Supabase', 'Stores waitlist reservations', 'Cloud hosting'],
              ['Google Fonts', 'Serves the typefaces on the site', 'Global network'],
            ],
          },
        },
        {
          p: 'We never sell personal information, and we do not share it for cross-context behavioural advertising. We would disclose it only if the law required us to, to protect someone’s safety, or as part of a merger or acquisition, in which case this notice would continue to apply to it.',
        },
      ],
    },
    {
      id: 'transfers',
      title: 'International transfers',
      blocks: [
        {
          p: 'Some of our providers process information in the United States and other countries. Where information about people in the European Economic Area, the United Kingdom or Switzerland is transferred, we rely on the safeguards the law provides, such as the European Commission’s Standard Contractual Clauses or the EU-US Data Privacy Framework where a provider is certified under it.',
        },
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      blocks: [
        {
          list: [
            'Unconfirmed newsletter signups: nothing is added to our mailing list, and the confirmation link stops working after 7 days. A waitlist reservation is recorded when you submit the form, and we email you only once you confirm.',
            'Subscribers: for as long as you stay subscribed.',
            'After you unsubscribe: we keep your address marked as unsubscribed, so that we never email you again by mistake. Ask us to delete it entirely and we will.',
            'Waitlist reservations: until Ciatta opens and we have told you, then for no more than 12 months unless you become a member.',
            'Rate-limit counters: at most 24 hours.',
            'Server and security logs held by our host: for the short periods set by Cloudflare.',
          ],
        },
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      blocks: [
        { p: 'Depending on where you live, you have the right to:' },
        {
          list: [
            'find out whether we hold information about you, and get a copy',
            'have it corrected',
            'have it deleted',
            'withdraw consent at any time, which does not affect what happened before',
            'object to, or ask us to restrict, how we use it',
            'receive it in a portable format',
            'not be treated differently for using any of these rights',
          ],
        },
        {
          p: `The quickest way to stop emails is the unsubscribe link in any of them. For everything else, write to ${LEGAL.privacyEmail} from the address concerned. We will answer within one month, or within the shorter time your local law sets, and it costs nothing.`,
        },
        {
          p: 'If you are in the EEA or the UK, you can also complain to your data protection authority. We would appreciate the chance to put things right first.',
        },
        {
          p: 'Residents of California and other US states with privacy laws have the rights above. We do not sell or share personal information as those laws define it, and we do not use sensitive personal information.',
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      blocks: [
        {
          p: 'The site is served only over HTTPS. Links in our emails are signed so they cannot be forged or altered, and the signup forms accept requests only from ciatta.io. Access to subscriber information is limited to the people who need it. No system is perfectly secure, and if a breach affecting you occurred we would tell you and the authorities as the law requires.',
        },
      ],
    },
    {
      id: 'children',
      title: 'Children',
      blocks: [
        {
          p: `The site and our emails are for adults. We do not knowingly collect information from anyone under 18. If you believe a child has given us their address, write to ${LEGAL.privacyEmail} and we will delete it.`,
        },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this notice',
      blocks: [
        {
          p: 'If we change how we use your information, we will update this page and the date at the top. If a change is significant, we will tell subscribers by email before it takes effect.',
        },
      ],
    },
  ],
};

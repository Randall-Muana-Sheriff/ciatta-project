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
//   · no cookies and no analytics unless she accepts; no advertising pixels
//
// The app section was written from the app's code and from the answers in
// Ciatta's Epic on FHIR Data Use Questionnaire (app 62277), which patients
// see when they connect a hospital. The two must say the same thing:
//   · for-profit; funded by memberships, other business ventures and
//     investment; no business associate agreements with hospitals
//   · stored on her phone and on servers in the United States (Supabase,
//     us-east-1)
//   · seen by Ciatta staff as needed, people she shares with, and
//     infrastructure providers under contract (Supabase, OpenAI)
//   · consent by accepting this policy; no notice of each access
//   · used to provide and improve Ciatta; research only de-identified and
//     only if she opts in separately
//   · complete export, delete everything, nothing kept after deletion; no
//     record of who accessed her data
// If any of that changes, this document, and the questionnaire, have to
// change with it.

export const privacy: LegalDoc = {
  title: 'Privacy Policy',
  summary: `How ${LEGAL.operator} handles your information in the Ciatta app, on this website and in our emails.`,
  plainly: [
    'This policy covers the Ciatta app, ciatta.io, the Ciatta Briefs newsletter and the waitlist.',
    'In the app, your health information is used to give you Ciatta and to improve it. It is kept on your phone and on servers in the United States, and you can export it or delete all of it at any time.',
    'Records from a hospital you connect are only ever read. Ciatta cannot change anything in your chart, and you can disconnect at any time.',
    'On this website we ask for one thing: your email address. We do not ask for health information here.',
    'The site sets no cookies unless you accept analytics, and you are asked before anything is set. We do not track whether you open our emails or click their links.',
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
      id: 'app',
      title: 'The Ciatta app',
      blocks: [
        {
          p: `${LEGAL.operator} is a for-profit company. The app is funded by memberships, by our other business ventures, and by investment. It is never funded by advertising or by selling or giving access to your information.`,
        },
        { p: 'What the app holds about you, and where it comes from:' },
        {
          list: [
            'What you tell it: what you log, your cycle, symptoms, conditions, medications, notes and your profile.',
            'What you connect: health data you allow it to read from Apple Health on your phone, and records from a hospital, clinic, lab or insurance plan you connect through its patient portal, such as MyChart, either directly or through Fasten Health.',
            'Documents you add, such as lab reports, visit summaries, imaging and pathology reports, prescriptions, referral letters and insurance cards: what was read from them and filed into your record with your check, and the original file, so you can check anything against it.',
          ],
        },
        {
          p: 'Records from a hospital you connect are read only. Ciatta asks for read access and nothing else, so it cannot add to or change anything in your chart. You log in on your provider’s own page, and Ciatta never sees your portal password. When you connect through Fasten Health, Fasten holds the connection to your portal and passes your records to Ciatta at your request.',
        },
        {
          p: 'Ciatta does not have business associate agreements with the hospitals and clinics you connect. Once your records are in Ciatta, they are protected by this policy and by the laws that apply to us, rather than by the HIPAA rules that apply to your provider.',
        },
      ],
    },
    {
      id: 'app-use',
      title: 'How the app uses your information',
      blocks: [
        {
          list: [
            'To give you Ciatta: your record, its patterns and insights, your care tools, and the analysis of lab reports you add.',
            'To improve Ciatta.',
            'For research, only if you choose to take part, separately from agreeing to this policy, and only with information that no longer identifies you. Ciatta does not do this today, and will ask you before it ever does.',
          ],
        },
        {
          p: 'The clinical AI analysis of a lab report is written by an AI model from your results and your record, and checked against your record before you see it. It is not a diagnosis. Discuss it with your clinician.',
        },
        {
          p: 'You agree to this use by accepting this policy. You are not notified each time your information is accessed, and the app does not give you a record of who has accessed it.',
        },
      ],
    },
    {
      id: 'app-share',
      title: 'Who else can see what is in the app',
      blocks: [
        {
          list: [
            'Ciatta staff, only where they need to, to run and support the service.',
            'People you choose to share with, such as a clinician you send a summary to. Ciatta does not send your information to your care team on its own.',
            'Infrastructure providers that host and run the service for Ciatta under contract, listed below. They process it only on our instructions.',
          ],
        },
        {
          table: {
            head: ['Provider', 'What they do for the app', 'Where'],
            rows: [
              ['Supabase', 'Stores your account and your record, and runs the server side of the app', 'United States'],
              ['OpenAI', 'Reads lab reports, medical documents and meal photos you add, and writes the clinical AI analyses of lab reports and documents', 'United States'],
              ['Fasten Health', 'Connects to the hospitals, clinics, labs and insurance plans you choose through it, and passes their records to Ciatta', 'United States'],
              ['Apple', 'Apple Health data stays on your phone, and the app reads only what you allow', 'On your phone'],
            ],
          },
        },
        {
          p: 'Researchers, advertisers, data brokers, insurers, our partners or affiliates, and government agencies do not receive your information from the app, except where the law requires us to disclose it.',
        },
      ],
    },
    {
      id: 'app-control',
      title: 'Where it is kept, for how long, and your control',
      blocks: [
        {
          list: [
            'Your information is stored on your phone and on servers in the United States.',
            'It is kept for as long as your account is open.',
            'You can download a complete copy of what Ciatta holds about you at any time, from Privacy and Data in the app.',
            'You can delete all of it. When you delete your account, everything is deleted, and nothing is kept afterwards.',
            'You can disconnect a hospital or clinic at any time, and the records it sent are removed from Ciatta. Nothing changes in your chart at your provider.',
            'You can remove a lab report or document you added, with what was filed from it, its original file and its analysis.',
          ],
        },
      ],
    },
    {
      id: 'collect',
      title: 'What the website collects and why',
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
          p: 'We use one analytics tool, Google Analytics, to count visits and see which pages are read. It sets cookies, so it does not run until you accept it. Decline and nothing is set and nothing is sent. Your answer is remembered in your browser rather than in a cookie, and you can change it at any time from Cookie choices in the footer.',
        },
        {
          p: 'We run no advertising pixels, no session recording and no social media trackers. Analytics is configured to truncate your address before it is stored and to send nothing to Google\u2019s advertising products. Nothing in your health record is ever part of it.',
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
          p: 'We never sell personal information, and we do not share it for cross-context behavioural advertising. We would disclose it only if the law required us to, to protect someone’s safety, or as part of a merger or acquisition, in which case this policy would continue to apply to it.',
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
          p: 'Health data is the most sensitive data you have, and it is held accordingly. Data is encrypted with TLS 1.3 in transit and AES-256 at rest, and sensitive fields are wrapped in per-user encryption envelopes. The cloud architecture is encrypted at rest, access patterns are audited, and the principle of least privilege applies across every service.',
        },
        {
          p: 'The site is served only over HTTPS. Links in our emails are signed so they cannot be forged or altered, and the signup forms accept requests only from ciatta.io. Access to subscriber information is limited to the people who need it. No system is perfectly secure, and if a breach affecting you occurred we would tell you and the authorities as the law requires.',
        },
      ],
    },
    {
      id: 'never-sold',
      title: 'What we will never do with your data',
      blocks: [
        {
          p: 'We will never sell, rent, or share your data with advertisers, data brokers, or insurers. There is no exception to this and no arrangement under which it changes. Ciatta is built for your health outcomes rather than for ad targeting, and what Ciatta tells you is grounded in medical evidence rather than in anything a third party has paid for.',
        },
      ],
    },
    {
      id: 'your-control',
      title: 'Export, deletion, and connected sources',
      blocks: [
        {
          p: 'Your record is yours. You can export everything at any time. If you delete your account we delete every byte of your data, and we do not keep shadow copies of it.',
        },
        {
          p: 'Where you connect another source, such as Google Health or Apple Health, you can revoke that connection in one click, and the data that came from it goes with it.',
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
      title: 'Changes to this policy',
      blocks: [
        {
          p: 'If we change how we use your information, we will update this page and the date at the top. If a change is significant, we will tell subscribers by email before it takes effect.',
        },
      ],
    },
  ],
};

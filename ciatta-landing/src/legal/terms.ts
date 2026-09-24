import { LEGAL } from './config';
import type { LegalDoc } from './types';

// Terms for the website, Ciatta Briefs and the waitlist. The Ciatta app is not
// open yet; membership will come with its own terms, and section 5 says so
// rather than promising anything about them here.

export const terms: LegalDoc = {
  title: 'Terms of Use',
  summary: 'The terms for using ciatta.io, reading Ciatta Briefs and joining the waitlist.',
  plainly: [
    'Nothing on this site or in our emails is medical advice. It cannot tell you what is happening in your own body. Talk to a clinician about that.',
    'In an emergency, call your local emergency number now.',
    'Joining the waitlist is free and commits you to nothing. It does not guarantee a place, a date or a price.',
    'Our writing is ours. Share links to it freely; do not republish it as your own.',
  ],
  sections: [
    {
      id: 'agreement',
      title: '1. These terms',
      blocks: [
        {
          p: `These terms apply to ciatta.io, the Ciatta Briefs newsletter, and the Ciatta waitlist (together, "the site"), provided by ${LEGAL.operator} ("Ciatta", "we", "us"). By using the site you agree to them. If you do not agree, please do not use it.`,
        },
        { p: 'Our Privacy Policy explains how we handle personal information, and forms part of these terms.' },
      ],
    },
    {
      id: 'medical',
      title: '2. Not medical advice',
      blocks: [
        {
          p: 'Everything on the site, including Ciatta Briefs, is general information written to help you notice changes and ask better questions. It is not medical advice, diagnosis or treatment, and it is not a substitute for a qualified clinician who knows you.',
        },
        {
          list: [
            'Using the site does not create a clinician and patient relationship with anyone.',
            'Do not start, stop or change any medication or treatment because of something you read here.',
            'Do not delay seeking care because of anything you read here.',
            'Research changes. We work to keep our writing accurate and current, and say how certain the evidence is, but we cannot promise that everything is complete or up to date.',
          ],
        },
        {
          p: 'If you think you may have a medical emergency, call your local emergency number or go to the nearest emergency department immediately.',
        },
      ],
    },
    {
      id: 'eligibility',
      title: '3. Who can use the site',
      blocks: [
        {
          p: 'You must be at least 18 to join the waitlist or subscribe to our emails. You may only sign up with an email address that is yours to use.',
        },
      ],
    },
    {
      id: 'emails',
      title: '4. Ciatta Briefs and other emails',
      blocks: [
        {
          p: 'Ciatta Briefs is free. We aim to send it every Tuesday, but we may change its schedule or content, or stop it. You can unsubscribe at any time using the link in any email.',
        },
      ],
    },
    {
      id: 'waitlist',
      title: '5. The waitlist and membership',
      blocks: [
        {
          p: 'Joining the waitlist reserves a place in the queue to hear from us when Ciatta opens. It is free, no payment details are taken, and it does not oblige you to become a member.',
        },
        {
          p: 'It also does not guarantee access, a launch date, particular features, availability in your country or a particular price. Membership, including its price and what it includes, will be offered under separate terms that you will see and accept before you pay anything.',
        },
      ],
    },
    {
      id: 'billing',
      title: '6. Reserving a place, and what you are charged',
      blocks: [
        {
          p: 'You can reserve a place without giving us a card. If you do choose to reserve with a card, this section says exactly what happens to it. Nothing here applies unless you have given us card details.',
        },
        {
          p: 'When you reserve with a card, we do not charge it. Your card is stored with our payment processor, Stripe, against a customer record in your name. No subscription is created, no invoice is raised, and no money moves. We never see or store your full card number ourselves.',
        },
        {
          p: 'The first charge happens when Ciatta opens and you confirm that you want to begin, and not before. We are building towards Q3 of 2027. That is a plan and not a promise, and if it moves we will tell you. We will email you before anything is charged, and you will be able to decline. If you do nothing, you are not charged.',
        },
        {
          p: 'Membership is $119 for a year, charged once at the start of the year. Places reserved before Ciatta opens are held at the founding price of $89 for the year, for as long as the membership runs without a break, unless we tell you a different price before you confirm. There is no monthly instalment and no separate joining fee. It renews once a year until you cancel. If the price changes for existing members we will tell you at least 30 days before the renewal it would apply to, and you can cancel before it takes effect.',
        },
        {
          p: 'You can cancel at any time, from your account or by writing to us. Cancelling stops the next annual payment; it does not end your access that day. You keep access until the end of the year you have paid for, and you can export your whole record before you go or delete it outright. We will email you before each renewal, so a year never turns over without your being told first.',
        },
        {
          p: 'You can remove a stored card at any time before the first charge, by writing to us, and we will delete it from Stripe. Because the first charge is a long way off, a card stored today may well have expired by then; if it has, we will ask you for current details rather than charging anything else you have given us. If Ciatta does not open, or we decide not to launch, we will delete every stored card and tell you that we have. We will not hold a card indefinitely against a product that does not exist.',
        },
        {
          p: 'If the date Ciatta opens moves, nothing about this changes: your card stays uncharged, you are told before the first payment, and you can withdraw at any point in between. Reserving a place does not guarantee a launch date, availability in your country, or any particular feature.',
        },
        {
          p: 'Where the law gives you a right to cancel a distance contract within a cooling-off period, that right applies in addition to everything above, and nothing here removes it. If you believe you have been charged in error, write to us and we will look at it and refund anything charged wrongly.',
        },
      ],
    },
    {
      id: 'use',
      title: '7. Using the site properly',
      blocks: [
        { p: 'You agree not to:' },
        {
          list: [
            'sign anyone else up for our emails or the waitlist',
            'submit forms automatically, in bulk, or to test stolen or generated addresses',
            'try to break, overload, probe or get around the security of the site',
            'scrape or copy the site in bulk, including to train machine learning models, without our written permission',
            'use the site for anything unlawful, or to mislead anyone',
          ],
        },
        { p: 'We may block access, or remove a subscription, where we reasonably believe these terms are being broken.' },
      ],
    },
    {
      id: 'ip',
      title: '8. Our content',
      blocks: [
        {
          p: 'The writing, design, photography, video, the Ciatta name and wordmark on the site belong to Ciatta or the people who licensed them to us, and are protected by intellectual property law.',
        },
        {
          p: 'You may read, print and share links to our content for your own non-commercial use. You may quote short passages with credit and a link. You may not republish, sell or adapt it, or use our name or wordmark in a way that suggests we endorse you, without our written permission.',
        },
      ],
    },
    {
      id: 'links',
      title: '9. Other websites',
      blocks: [
        {
          p: 'Our writing may link to studies, guidelines and other sites we do not control. We link to them because we think they are useful, not because we endorse everything on them, and we are not responsible for their content.',
        },
      ],
    },
    {
      id: 'availability',
      title: '10. Availability and changes',
      blocks: [
        {
          p: 'We work to keep the site available and accurate, but we provide it as it is and as available. We may change, pause or withdraw any part of it at any time.',
        },
      ],
    },
    {
      id: 'liability',
      title: '11. Liability',
      blocks: [
        {
          p: 'Nothing in these terms limits liability that cannot legally be limited, including for death or personal injury caused by negligence, for fraud, or your rights as a consumer under the law where you live.',
        },
        {
          p: 'Subject to that, and because the site is free, to the extent the law allows: Ciatta is not liable for any decision you make based on the site, or for indirect or consequential loss, and our total liability to you in connection with the site is limited to 100 US dollars.',
        },
      ],
    },
    {
      id: 'law',
      title: '12. Law and disputes',
      blocks: [
        {
          p: LEGAL.governingLaw
            ? `These terms are governed by the laws of ${LEGAL.governingLaw}, and disputes will be heard by its courts. If you live in a country or state whose law gives you the right to bring a claim where you live, or under its law, you keep that right.`
            : 'These terms are governed by the laws of the place where Ciatta is established. If you live in a country or state whose law gives you the right to bring a claim where you live, or under its law, you keep that right.',
        },
        {
          p: `Before bringing any claim, please write to us at ${LEGAL.contactEmail} so we can try to resolve it.`,
        },
      ],
    },
    {
      id: 'data',
      title: '13. Your data, and what we will not do with it',
      blocks: [
        {
          p: 'Health data is the most sensitive data you have. Data is encrypted with TLS 1.3 in transit and AES-256 at rest, sensitive fields are wrapped in per-user encryption envelopes, access patterns are audited, and the principle of least privilege applies across every service.',
        },
        {
          p: 'Your record is yours. You can export everything at any time, and if you delete your account we delete every byte of it, keeping no shadow copies. Where you have connected another source, such as Google Health or Apple Health, you can revoke that connection in one click and the data that came from it goes with it.',
        },
        {
          p: 'We will never sell, rent, or share your data with advertisers, data brokers, or insurers. Ciatta is built for your health outcomes rather than for ad targeting, and what it tells you is grounded in medical evidence rather than in anything a third party has paid for. How your information is handled in full is set out in the Privacy Policy.',
        },
      ],
    },
    {
      id: 'changes',
      title: '14. Changes to these terms',
      blocks: [
        {
          p: 'We may update these terms. The date at the top shows when they last changed. If a change is significant, we will tell subscribers by email before it applies. Continuing to use the site after that means you accept the updated terms.',
        },
        {
          p: 'If any part of these terms cannot be enforced, the rest still applies.',
        },
      ],
    },
  ],
};

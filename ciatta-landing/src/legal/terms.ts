import { LEGAL } from './config';
import type { LegalDoc } from './types';

// Terms for the website, Ciatta Briefs and the waitlist. The Ciatta app is not
// open yet; membership will come with its own terms, and section 5 says so
// rather than promising anything about them here.

export const terms: LegalDoc = {
  title: 'Terms of use',
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
        { p: 'Our privacy notice explains how we handle personal information, and forms part of these terms.' },
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
          p: 'Ciatta Briefs is free. We aim to send it every Tuesday and Friday, but we may change its schedule or content, or stop it. You can unsubscribe at any time using the link in any email.',
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
      id: 'use',
      title: '6. Using the site properly',
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
      title: '7. Our content',
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
      title: '8. Other websites',
      blocks: [
        {
          p: 'Our writing may link to studies, guidelines and other sites we do not control. We link to them because we think they are useful, not because we endorse everything on them, and we are not responsible for their content.',
        },
      ],
    },
    {
      id: 'availability',
      title: '9. Availability and changes',
      blocks: [
        {
          p: 'We work to keep the site available and accurate, but we provide it as it is and as available. We may change, pause or withdraw any part of it at any time.',
        },
      ],
    },
    {
      id: 'liability',
      title: '10. Liability',
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
      title: '11. Law and disputes',
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
      id: 'changes',
      title: '12. Changes to these terms',
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

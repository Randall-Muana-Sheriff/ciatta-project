import { Module, type Item } from './Module';

/**
 * Safety and privacy.
 *
 * It sits where the question actually arrives: after the page has asked her
 * to hand over her cycle, her labs, her medication and her own words, and
 * before it asks for her address. A promise about her data is worth most
 * immediately after she has understood how much of it Ciatta wants.
 *
 * Set in the same shape as "Your day, read in five stages" on the how-it-works
 * page: six numbered commitments she opens one at a time. The accordion, and
 * nothing else — these are sentences, not screens, and a device beside them
 * showed her a phone repeating the paragraph she was already reading.
 *
 * No padlocks, no shields, no badges either. A security section that looks
 * like a security section is decoration, and this one has to be read.
 *
 * Every line here is also in the Privacy Policy and the Terms of Use, because
 * a claim that lives only on a landing page is marketing. These are the short
 * forms; the documents are the binding ones. The section used to say so in a
 * line underneath itself; both documents are linked from the footer of every
 * page, so the sentence was paying for itself twice.
 */

const PROMISES: Item[] = [
  { n: '01', title: 'Encrypted end-to-end',
    body: 'TLS 1.3 in transit. AES-256 at rest. Sensitive fields wrapped in per-user encryption envelopes.' },
  { n: '02', title: 'Access is locked down',
    body: 'Encrypted-at-rest cloud architecture, audited access patterns, and the principle of least privilege across every service.' },
  { n: '03', title: 'You own your data',
    body: 'Export everything at any time. Delete your account and we delete every byte, with no retained shadow copies.' },
  { n: '04', title: 'Never sold. Never shared.',
    body: 'We will never sell, rent, or share your data with advertisers, brokers, or insurers. Period.' },
  { n: '05', title: 'You hold the keys',
    body: 'Revoke any integration in one click. Disconnect Google Health, Apple Health, or any other source, and the data goes with it.' },
  { n: '06', title: 'Clinical, not commercial',
    body: 'Built for your health outcomes, not for ad targeting. What Ciatta tells you is grounded in medical evidence.' },
];

export function SafetySection() {
  return (
    <Module
      id="safety-heading"
      title="Your health data, protected end-to-end."
      lede="Health data is the most sensitive data you have. Ciatta is built on infrastructure, policies, and a privacy-first posture that treat it that way, and that keep you in control."
      items={PROMISES}
    />
  );
}

import { Finding, Module, Rows, type Item } from './Module';

/**
 * Safety and privacy.
 *
 * It sits where the question actually arrives: after the page has asked her
 * to hand over her cycle, her labs, her medication and her own words, and
 * before it asks for her address. A promise about her data is worth most
 * immediately after she has understood how much of it Ciatta wants.
 *
 * Set in the same shape as "Your day, read in five stages" on the how-it-works
 * page: six numbered commitments she opens one at a time, each beside the
 * screen it is about. That shape earns its place here for a reason the grid
 * of six paragraphs did not — a promise about data is only worth as much as
 * the control behind it, and half of these have a control. "You own your
 * data" is a screen with Export and Delete on it. "You hold the keys" is the
 * list of sources with Disconnect beside each one. Showing those makes the
 * claim checkable rather than reassuring.
 *
 * The three with no control — encryption, access, what we will not sell —
 * are shown as what they are: a statement, with where it is binding written
 * underneath. No padlocks, no shields, no badges. A security section that
 * looks like a security section is decoration, and this one has to be read.
 *
 * Every line here is also in the Privacy Policy and the Terms of Use, because
 * a claim that lives only on a landing page is marketing. These are the short
 * forms; the documents are the binding ones.
 */

/* -- the screens ----------------------------------------------------------- *
 * Each one restates its own promise and adds nothing to it. Where a screen
 * would have to invent a feature to illustrate a sentence, the sentence is
 * shown plainly instead.
 */

const EncryptedScreen = () => (
  <Rows title="Security" head={['Your data, encrypted', 'Always on']} rows={[
    ['In transit', 'Between your phone and Ciatta', 'TLS 1.3'],
    ['At rest', 'Every store, every backup', 'AES-256'],
    ['Sensitive fields', 'Wrapped per user', 'Envelope'],
  ]} />
);

const AccessScreen = () => (
  <Rows title="Access" head={['Who can reach your record', 'Least privilege']} rows={[
    ['You', 'Every field, any time', 'Full'],
    ['Ciatta', 'Only what a service needs', 'Audited'],
    ['Advertisers, brokers, insurers', 'No path to it', 'None'],
  ]} />
);

const OwnScreen = () => (
  <Rows title="Your data" head={['Export or delete', 'Any time']} caret rows={[
    ['Export everything', 'Every measurement, note and document', ''],
    ['Delete your account', 'Every byte, no shadow copies', ''],
    ['Download a copy first', 'Before anything is removed', ''],
  ]} />
);

const NeverScreen = () => (
  <Finding title="Privacy" tag="Never"
           finding="Your data is never sold, rented or shared with advertisers, brokers or insurers."
           basis="Written into the Privacy Policy, not only onto this page." />
);

const KeysScreen = () => (
  <Rows title="Sources" head={['Connected', 'Revoke any of these']} rows={[
    ['Oura', 'Sleep, HRV, temperature', 'Disconnect'],
    ['Apple Health', 'Steps, workouts, weight', 'Disconnect'],
    ['Your portal', 'Lab results, medications', 'Disconnect'],
  ]} />
);

const ClinicalScreen = () => (
  <Finding title="Insights" tag="What this rests on"
           finding="Your afternoon pain has been higher following nights under 7 hours."
           basis="Your own record, read against medical evidence. Seen on 3 days this month. A connection is not a cause." />
);

const PROMISES: Item[] = [
  { n: '01', title: 'Encrypted end-to-end',
    body: 'TLS 1.3 in transit. AES-256 at rest. Sensitive fields wrapped in per-user encryption envelopes.',
    Screen: EncryptedScreen },
  { n: '02', title: 'Access is locked down',
    body: 'Encrypted-at-rest cloud architecture, audited access patterns, and the principle of least privilege across every service.',
    Screen: AccessScreen },
  { n: '03', title: 'You own your data',
    body: 'Export everything at any time. Delete your account and we delete every byte, with no retained shadow copies.',
    Screen: OwnScreen },
  { n: '04', title: 'Never sold. Never shared.',
    body: 'We will never sell, rent, or share your data with advertisers, brokers, or insurers. Period.',
    Screen: NeverScreen },
  { n: '05', title: 'You hold the keys',
    body: 'Revoke any integration in one click. Disconnect Google Health, Apple Health, or any other source, and the data goes with it.',
    Screen: KeysScreen },
  { n: '06', title: 'Clinical, not commercial',
    body: 'Built for your health outcomes, not for ad targeting. What Ciatta tells you is grounded in medical evidence.',
    Screen: ClinicalScreen },
];

export function SafetySection() {
  return (
    <Module
      id="safety-heading"
      kind="Safety & Privacy"
      title="Your health data, protected end-to-end."
      lede="Health data is the most sensitive data you have. Ciatta is built on infrastructure, policies, and a privacy-first posture that treat it that way, and that keep you in control."
      items={PROMISES}
      foot={
        <>
          The binding versions are in the{' '}
          <a href="/privacy/">Privacy Policy</a> and the{' '}
          <a href="/terms/">Terms of Use</a>.
        </>
      }
    />
  );
}

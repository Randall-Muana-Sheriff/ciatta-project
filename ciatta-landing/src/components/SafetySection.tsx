/**
 * Safety and privacy.
 *
 * It sits where the question actually arrives: after the page has asked her
 * to hand over her cycle, her labs, her medication and her own words, and
 * before it asks for her address. A promise about her data is worth most
 * immediately after she has understood how much of it Ciatta wants.
 *
 * Six commitments, set as type on paper with a rule over each. No padlocks,
 * no shields, no badges: a security section that looks like a security
 * section is decoration, and this one has to be read.
 *
 * Every line here is also in the privacy notice and the terms, because a
 * claim that lives only on a landing page is marketing. These are the
 * short forms; the documents are the binding ones.
 */

const PROMISES: [string, string][] = [
  ['Encrypted end-to-end',
   'TLS 1.3 in transit. AES-256 at rest. Sensitive fields wrapped in per-user encryption envelopes.'],
  ['Access is locked down',
   'Encrypted-at-rest cloud architecture, audited access patterns, and the principle of least privilege across every service.'],
  ['You own your data',
   'Export everything at any time. Delete your account and we delete every byte, with no retained shadow copies.'],
  ['Never sold. Never shared.',
   'We will never sell, rent, or share your data with advertisers, brokers, or insurers. Period.'],
  ['You hold the keys',
   'Revoke any integration in one click. Disconnect Google Health, Apple Health, or any other source, and the data goes with it.'],
  ['Clinical, not commercial',
   'Built for your health outcomes, not for ad targeting. What Ciatta tells you is grounded in medical evidence.'],
];

export function SafetySection() {
  return (
    <section className="section safety" aria-labelledby="safety-heading">
      <div className="shell">
        <div className="band-head">
          <span className="m-eyebrow is-ink">Safety &amp; Privacy</span>
          <h2 id="safety-heading" className="band-title">
            Your health data, protected end-to-end.
          </h2>
          <p className="band-sub">
            Health data is the most sensitive data you have. Ciatta is built on
            infrastructure, policies, and a privacy-first posture that treat it
            that way, and that keep you in control.
          </p>
        </div>

        <ul className="sf-grid">
          {PROMISES.map(([title, body]) => (
            <li className="sf-item" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>

        <p className="sf-foot">
          The binding versions are in the{' '}
          <a href="/privacy/">privacy notice</a> and the{' '}
          <a href="/terms/">terms of use</a>.
        </p>
      </div>
    </section>
  );
}

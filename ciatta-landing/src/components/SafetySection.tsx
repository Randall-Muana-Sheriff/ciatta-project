/**
 * Safety and privacy.
 *
 * It sits where the question actually arrives: after the page has asked her
 * to hand over her cycle, her labs, her medication and her own words, and
 * before it asks for her address. A promise about her data is worth most
 * immediately after she has understood how much of it Ciatta wants.
 *
 * One paragraph, not six rows. It was a numbered accordion, and the argument
 * for that was that six promises read better one at a time. The argument
 * against is that someone deciding whether to trust a health company with
 * her record should not have to open six drawers to find out what the
 * company promises. Every claim the six made is here, in the order that
 * matters: how it is held, that it is hers, what will never happen to it,
 * and who the product is built for.
 *
 * No padlocks, no shields, no badges. A security section that looks like a
 * security section is decoration, and this one has to be read.
 *
 * Every claim is also in the Privacy Policy and the Terms of Use, because a
 * claim that lives only on a landing page is marketing. This is the short
 * form; the documents are the binding ones, and both are linked from the
 * footer of every page.
 */
export function SafetySection() {
  return (
    <section className="section safety" aria-labelledby="safety-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="safety-heading" className="band-title">
            Your health data, protected end-to-end.
          </h2>
          <p className="band-sub safety-copy">
            Health data is the most sensitive data you have. Yours is
            encrypted in transit and at rest, with sensitive fields wrapped in
            per-user encryption envelopes, and access inside Ciatta is audited
            and held to the principle of least privilege. It stays yours:
            export everything at any time, disconnect any source and its data
            goes with it, delete your account and every byte goes too, with no
            shadow copies retained. We will never sell, rent or share your
            health data with advertisers, brokers or insurers. And Ciatta is
            built for your health outcomes rather than for ad targeting, so
            what it tells you is grounded in medical evidence.
          </p>
        </div>
      </div>
    </section>
  );
}

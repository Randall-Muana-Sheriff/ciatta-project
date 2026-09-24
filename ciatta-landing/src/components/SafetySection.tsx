/**
 * Safety and privacy.
 *
 * It sits where the question actually arrives: after the page has asked her
 * to hand over her cycle, her labs, her medication and her own words, and
 * before it asks for her address. A promise about her data is worth most
 * immediately after she has understood how much of it Ciatta wants.
 *
 * One sentence. It was six accordion rows, then one paragraph carrying all
 * twelve claims; both were the whole privacy argument made in the middle of
 * a landing page. The argument now lives in the Questions below, under
 * "Where does my health data live, and who can reach it?", which is where
 * someone goes when they actually want it. What is left here is the promise
 * itself, said once, at the point she has just understood how much of her
 * record Ciatta wants.
 *
 * No padlocks, no shields, no badges. A security section that looks like a
 * security section is decoration, and this one has to be read.
 *
 * Every claim is also in the Privacy Policy and the Terms of Use, because a
 * claim that lives only on a landing page is marketing. This is the shortest
 * form of it; the Questions carry the full one and the documents are the
 * binding ones, and both are linked from the footer of every page.
 *
 * It stays out of the scroll reveal. Its whole content is .band-head
 * children, so a reveal that fails to fire here leaves no section at all —
 * which is exactly what happened once already.
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
            Encrypted in transit and at rest, audited inside Ciatta, never
            sold or shared, and yours to export or delete at any time.
          </p>
        </div>
      </div>
    </section>
  );
}

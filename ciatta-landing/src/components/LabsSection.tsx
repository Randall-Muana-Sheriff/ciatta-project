import { LabScreen } from './ProductShowcase';

/**
 * "Your lab results shouldn't live in a PDF."
 *
 * The document she uploaded, the values read out of it, and the same value
 * across every panel she has, all on the screen that holds them. The page
 * says what the screen is for and then gets out of the way. Ferritin 32, 24,
 * 18 agrees with the 14 Mar Quest panel the rest of the site documents.
 */

export function LabsSection() {
  return (
    <section className="section labs" aria-labelledby="labs-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="labs-heading" className="band-title">
            Your lab results shouldn’t live in a PDF.
          </h2>
          <p className="band-sub">
            Upload the document your provider sent. Ciatta reads the values out
            of it and keeps each one beside every other time it was measured.
          </p>
        </div>

        <div className="sec-phone is-alone">
          <div className="product sec-phone-device">
            <LabScreen />
          </div>
        </div>
      </div>
    </section>
  );
}

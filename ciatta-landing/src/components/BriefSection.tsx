import { BriefScreen } from './ProductShowcase';

/**
 * "Bring the story with you."
 *
 * The health brief: six months of her record as one page, in the registers
 * the product already uses, on the screen she creates it from.
 */

export function BriefSection() {
  return (
    <section className="section brief" aria-labelledby="brief-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="brief-heading" className="band-title">Bring the story with you.</h2>
          <p className="band-sub">
            You shouldn’t have to reconstruct six months of your health from
            memory before an appointment.
          </p>
        </div>

        <div className="sec-phone is-alone">
          <div className="product sec-phone-device">
            <BriefScreen />
          </div>
        </div>

        <p className="bf-note">
          Yours to take or to ignore. Ciatta does not diagnose or replace
          medical care.
        </p>
      </div>
    </section>
  );
}

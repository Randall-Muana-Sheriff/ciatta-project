import { ChangeScreen } from './ProductShowcase';

/**
 * "What changed?" — the signature product moment, shown in the app.
 *
 * The loop is read on a phone rather than described beside one: the figure
 * that moved, what was happening around it, what may be connected, what she
 * could try, and what happened after she did. The page says none of it twice:
 * the heading asks the question and the screen answers it.
 *
 * Every figure agrees with the record the rest of the site documents: sleep
 * averaging 7h 18m, the weeks of 26 Jan and 23 Feb lowest, cycle 29/28/27/26
 * days, levothyroxine changed 3 Mar, the 14 Mar Quest panel. Today is 1 Apr
 * 2026.
 */

export function ChangeSection() {
  return (
    <section className="section change" aria-labelledby="change-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="change-heading" className="band-title">What changed?</h2>
          <p className="band-sub">
            One measurement that moved, and everything your record can say about
            the weeks around it. This is the screen, as it is in the app.
          </p>
        </div>

        <div className="sec-phone is-alone">
          <div className="product sec-phone-device">
            <ChangeScreen />
          </div>
        </div>

      </div>
    </section>
  );
}

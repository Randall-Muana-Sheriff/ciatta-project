import { ChangeScreen } from './ProductShowcase';

/**
 * "What changed?" — the signature product moment, shown in the app.
 *
 * The loop is read on a phone rather than described beside one: the figure
 * that moved, what was happening around it, what may be connected, what she
 * could try, and what happened after she did. The page keeps only the words
 * that frame it, so the screen is the proof rather than the illustration.
 *
 * Every figure agrees with the record the rest of the site documents: sleep
 * averaging 7h 18m, the weeks of 26 Jan and 23 Feb lowest, cycle 29/28/27/26
 * days, levothyroxine changed 3 Mar, the 14 Mar Quest panel. Today is 1 Apr
 * 2026.
 */

const AROUND: string[] = [
  'Work demands were higher.',
  'Fatigue was reported 3 times.',
  'Cycle changed phase.',
  'Bedtime was later on 4 nights.',
];

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

        <div className="sec-phone">
          <div className="product sec-phone-device">
            <ChangeScreen />
          </div>

          <div className="sec-phone-read">
            <section className="cg-block" aria-labelledby="cg-around">
              <h3 id="cg-around">What happened around it</h3>
              <ul className="cg-list">
                {AROUND.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="cg-block" aria-labelledby="cg-connected">
              <h3 id="cg-connected">What may be connected</h3>
              <p>Your sleep has been lower during several high-demand weeks.</p>
            </section>

            <section className="cg-block" aria-labelledby="cg-do">
              <h3 id="cg-do">What can you do?</h3>
              <p>Try a 7-day sleep experiment.</p>
            </section>

            <section className="cg-block is-next" aria-labelledby="cg-next">
              <h3 id="cg-next">What happened next</h3>
              <p>Sleep returned closer to your usual on 5 of 7 nights.</p>
            </section>
          </div>
        </div>

        <p className="cg-note">
          Things that move together are not necessarily one causing the other.
          Ciatta shows what an observation is based on, and you decide what it
          means for you.
        </p>
      </div>
    </section>
  );
}

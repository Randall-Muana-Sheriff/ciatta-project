/**
 * "Your health doesn't happen in pieces."
 *
 * The page's first turn: the problem stated in her own terms, and one quiet
 * drawing of it. Five fragments sit at five different heights, each labelled
 * with where that part of her record actually lives, and then the same five
 * land on one line as dated events. Nothing animates and nothing is a card:
 * black type, hairlines, and the warm paper the rest of the page is set on.
 */

const FRAGMENTS: [string, string][] = [
  ['Symptoms', 'A notes app'],
  ['Labs', 'A patient portal'],
  ['Cycle', 'A period app'],
  ['Medications', 'A pharmacy record'],
  ['Sleep', 'A wearable'],
];

/** The same five, dated, in the order they happened. */
const TIMELINE: [string, string][] = [
  ['8 Jan', 'Medication started'],
  ['26 Jan', 'Sleep lowest'],
  ['3 Feb', 'Cycle shortened'],
  ['7 Mar', 'Fatigue reported'],
  ['14 Mar', 'Ferritin 24'],
];

export function ProblemSection() {
  return (
    <section className="section problem" aria-labelledby="problem-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="problem-heading" className="band-title">
            Your health doesn’t happen in pieces.
          </h2>
        </div>

        <div className="pr-body">
          <div className="pr-copy">
            <p className="pr-lines">
              Your symptoms are in one place.
              <br />
              Your labs are somewhere else.
              <br />
              Your cycle is in an app.
              <br />
              Your medications are in a portal.
              <br />
              Your sleep is on a wearable.
            </p>
            <p className="pr-ask">And what was happening around all of it?</p>
            <p className="pr-answer">Usually, that’s in your head.</p>
          </div>

          <div className="pr-figure">
            {/* scattered: five parts, five places, no common line */}
            <ul className="pr-scatter" aria-label="Where each part of your record lives today">
              {FRAGMENTS.map(([part, where]) => (
                <li key={part}>
                  <b>{part}</b>
                  <i>{where}</i>
                </li>
              ))}
            </ul>

            <p className="pr-turn">Ciatta puts the pieces together.</p>

            {/* the same five, on one line, in the order they happened */}
            <ol className="pr-line" aria-label="The same parts as one timeline">
              {TIMELINE.map(([date, what]) => (
                <li key={date}>
                  <span className="pr-tick" aria-hidden="true" />
                  <b>{date}</b>
                  <i>{what}</i>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

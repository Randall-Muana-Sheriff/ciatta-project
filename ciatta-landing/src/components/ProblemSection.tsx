/**
 * "Your health doesn't happen in pieces."
 *
 * The page's first turn: the problem stated in her own terms, and then the
 * same five parts landing on one line as dated events. Nothing animates and
 * nothing is a card: black type, hairlines, and the warm paper the rest of
 * the page is set on.
 */

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

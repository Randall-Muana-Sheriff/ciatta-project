/**
 * "See connections you might miss on your own."
 *
 * Three observations, each one a pair of things read together and a sentence
 * saying what was seen, how often, and over what period. They are rows on
 * hairlines rather than cards, because a card implies a conclusion. The
 * section closes on the limit: a connection is not a diagnosis, and the
 * reasoning stays visible so she decides what it means.
 */

const OBSERVATIONS: [string, string, string][] = [
  [
    'Symptoms × Cycle',
    'Your abdominal symptoms were reported more often during the same phase of your cycle across the last three cycles.',
    'Seen 3 times · Jan to Mar',
  ],
  [
    'Sleep × Daily life',
    'Your sleep was lower during 4 of your last 6 high-demand workweeks.',
    'Seen 4 times · Dec to Mar',
  ],
  [
    'Treatment × Symptoms',
    'Your symptom severity changed after your treatment change.',
    'Seen once · Mar',
  ],
];

export function InsightsSection() {
  return (
    <section className="section insights" aria-labelledby="insights-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="insights-heading" className="band-title">
            See connections you might miss on your own.
          </h2>
          <p className="band-sub">
            Ciatta looks across your health data and the context around it to
            surface patterns worth exploring.
          </p>
        </div>

        <ol className="in-list">
          {OBSERVATIONS.map(([pair, line, basis]) => (
            <li key={pair}>
              <span className="in-pair">{pair}</span>
              <p className="in-line">{line}</p>
              <span className="in-basis">{basis}</span>
            </li>
          ))}
        </ol>

        <div className="in-limit">
          <p className="in-limit-head">A connection isn’t a diagnosis.</p>
          <p className="in-limit-sub">
            Ciatta shows you what the observation is based on so you can decide
            what it means for you.
          </p>
        </div>
      </div>
    </section>
  );
}

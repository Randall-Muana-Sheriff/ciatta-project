/**
 * "Seeing a pattern is only the beginning."
 *
 * The loop closing: explore, try, observe, learn. One experiment card in the
 * app's dark resolution, and then what actually happened after seven days,
 * which is the part a tracker never comes back to.
 *
 * The card is a picture of the product, not the product: its action reads as
 * a label rather than a button, because nothing here can be started from a
 * page about the app.
 */

const STEPS = ['Explore', 'Try', 'Observe', 'Learn'] as const;

const TRY: string[] = [
  'Earlier wind-down',
  'Consistent bedtime',
  'Reduce late-day caffeine',
  'Track how you feel each morning',
];

const AFTER: [string, string][] = [
  ['Sleep', 'Higher on 5 of 7 nights'],
  ['Fatigue', 'Reported less often'],
  ['Energy', 'Higher on 4 mornings'],
];

export function ActionSection() {
  return (
    <section className="section action" aria-labelledby="action-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="action-heading" className="band-title">
            Seeing a pattern is only the beginning.
          </h2>
        </div>

        <ol className="ac-steps" aria-label="Explore, try, observe, learn">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="ac-body">
          <div className="product ac-card">
            <span className="ac-label">Worth exploring</span>
            <p className="ac-head">Your sleep has been lower lately.</p>

            <div className="ac-try">
              <h3>Try for 7 days</h3>
              <ul>
                {TRY.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <span className="ac-start" aria-hidden="true">Start</span>
          </div>

          <div className="ac-after">
            <h3>What happened?</h3>
            <dl>
              {AFTER.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="ac-learn">Ciatta learns from what happens next.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

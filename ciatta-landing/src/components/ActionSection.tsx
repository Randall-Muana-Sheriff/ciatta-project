import { ExperimentScreen } from './ProductShowcase';

/**
 * "Seeing a pattern is only the beginning."
 *
 * The loop closing: explore, try, observe, learn. One experiment card in the
 * app's dark resolution, and then what actually happened after seven days,
 * which is the part a tracker never comes back to.
 *
 * The experiment is the app's own screen rather than a card about it: the
 * four things to try, how many of the seven nights she kept to each, and the
 * nights themselves. Its Start reads as a label, because nothing here can be
 * started from a page about the app.
 */

const STEPS = ['Explore', 'Try', 'Observe', 'Learn'] as const;


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

        <div className="sec-phone is-alone">
          <div className="product sec-phone-device">
            <ExperimentScreen />
          </div>
        </div>
      </div>
    </section>
  );
}

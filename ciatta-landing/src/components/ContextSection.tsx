import { ContextScreen } from './ProductShowcase';

/**
 * "Health doesn't happen in a vacuum."
 *
 * What separates a record that is read together from a tracker: four layers
 * of context, named plainly, and then one week where they all say something
 * at once. The layers are a rule-separated row rather than four cards, and
 * the example is the product's own dark panel, so the page keeps alternating
 * between editorial type and product.
 */

const LAYERS: [string, string][] = [
  ['Your body', 'Sleep · cycle · symptoms · weight · activity'],
  ['Your care', 'Medications · treatments · surgery · appointments · labs'],
  ['Your life', 'Work · travel · meals · routines · stress · schedule'],
  ['Your environment', 'Weather · temperature · air quality · daylight'],
];


export function ContextSection() {
  return (
    <section className="section context" aria-labelledby="context-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="context-heading" className="band-title">
            Health doesn’t happen in a vacuum.
          </h2>
          <p className="band-sub">
            A measurement on its own is a number. Read beside the week it
            happened in, it is something you can ask about.
          </p>
        </div>

        <ul className="cx-layers">
          {LAYERS.map(([name, parts]) => (
            <li key={name}>
              <h3>{name}</h3>
              <p>{parts}</p>
            </li>
          ))}
        </ul>

        <div className="sec-phone is-reversed">
          <div className="product sec-phone-device">
            <ContextScreen />
          </div>
          <div className="sec-phone-read">
            <p className="sec-phone-lede">
              One week she reported pain, and every other part of the record with
              something to say about the same week.
            </p>
            <p className="sec-phone-sub">
              Nothing here claims a cause. It is the week, assembled, so she can
              ask about it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

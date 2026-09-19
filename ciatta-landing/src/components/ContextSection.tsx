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

const AROUND: [string, string][] = [
  ['Cycle', 'Day 24'],
  ['Sleep', 'Lower than your usual'],
  ['GI symptoms', 'Reported more often'],
  ['Workload', 'Higher'],
  ['Medication', 'Changed 8 days earlier'],
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

        <div className="product cx-example">
          <div className="cx-finding">
            <span className="cx-label">This week</span>
            <p className="cx-headline">Your pain increased this week.</p>
            <p className="cx-sub">Around the same time:</p>
          </div>

          <dl className="cx-around">
            {AROUND.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <p className="cx-action">Explore what changed around it.</p>
        </div>
      </div>
    </section>
  );
}

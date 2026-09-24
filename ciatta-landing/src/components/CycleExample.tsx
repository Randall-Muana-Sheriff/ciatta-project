/**
 * One example, shown all the way through.
 *
 * This replaced the nine-tab tour of the record on the home page. The tour
 * was accurate and it was nine invitations to do work: a visitor had to pick
 * a tab, read a panel, and build the argument herself, nine times, before the
 * page had shown her a single thing Ciatta does. Nobody does that on a first
 * visit. What persuades is one change, shown, with what sits around it.
 *
 * So: her cycle shortened four times running, and then the five other parts
 * of the record from the same months. Same photography, same panel, same
 * cards as the tour it replaces. The tour itself still exists in full on the
 * How it works page, where someone who wants all nine can have them.
 *
 * Every figure here is the record the rest of the site documents: cycles of
 * 29, 28, 27 and 26 days; sleep lowest in the weeks of 26 Jan and 23 Feb;
 * levothyroxine 50 mcg from 8 Jan and 75 from 3 Mar; the 14 Mar Quest panel;
 * and her own note of 26 Jan. Today is 1 Apr 2026, as it is everywhere else.
 *
 * NOTHING HERE CLAIMS A CAUSE. The heading says the cycle changed, which it
 * did. The rows say what else the record holds from the same months, which is
 * all they say: "from the same months", "around it", "may be worth". There is
 * no "because", no "due to", and no arrow from one row to another.
 */

/* The cycle, as the tour plots it: four points, the last one current. */
const POINTS: [string, number, string][] = [
  ['8 Dec', 29, '29'],
  ['6 Jan', 28, '28'],
  ['3 Feb', 27, '27'],
  ['2 Mar', 26, '26'],
];

/* What else the record holds from those months. Name, the fact, and where
   the fact came from — the same three-part row the tour's log cards use, so
   the provenance is on the page rather than implied. */
const AROUND: [string, string, string][] = [
  ['Symptoms', 'Energy low for four days from 26 Jan, and three days from 23 Feb.', 'You told Ciatta'],
  ['Sleep', 'Your two lowest weeks were 26 Jan and 23 Feb, averaging 6h 02m and 6h 14m.', 'Connected'],
  ['Treatment', 'Levothyroxine went from 50 mcg to 75 mcg on 3 Mar.', 'Imported'],
  ['Labs', 'On 14 Mar, ferritin 24: inside its range, close to the floor of it.', 'Imported'],
  ['Your own words', '“Waking several times a night,” written on 26 Jan.', 'You told Ciatta'],
];

/** The plot, drawn from the four points. One scale, the last point marked. */
function Plot() {
  const ys = POINTS.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = (hi - lo) * 0.35 || 1;
  const top = hi + pad;
  const bottom = lo - pad;
  const W = 100;
  const H = 40;
  const x = (i: number) => (i / (POINTS.length - 1)) * W;
  const y = (v: number) => H - ((v - bottom) / (top - bottom)) * H;
  const d = POINTS.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p[1]).toFixed(2)}`).join(' ');
  const last = POINTS.length - 1;

  return (
    <>
      <svg className="ex-plot" viewBox={`-3 -4 ${W + 6} ${H + 8}`} role="img"
           aria-label={POINTS.map((p) => `${p[0]}, ${p[2]} days`).join('; ')}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.1"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        {POINTS.map((p, i) => (
          <circle key={p[0]} cx={x(i)} cy={y(p[1])} r={i === last ? 2.6 : 1.7}
                  fill={i === last ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.1" />
        ))}
      </svg>
      {/* .ex-points, as the tour's own series cards use it: the same dl, so
          the figures under the plot are set by the styles that already exist
          rather than by a second set written for one section. */}
      <dl className="ex-points">
        {POINTS.map((p, i) => (
          <div key={p[0]} className={i === last ? 'is-last' : undefined}>
            <dt>{p[0]}</dt>
            <dd>{p[2]}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function CycleExample() {
  return (
    <section className="section explore cycle-ex" aria-labelledby="cycle-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="cycle-heading" className="band-title">Your cycle changed.</h2>
          <p className="band-sub">
            Ciatta shows the change over time, then puts symptoms, sleep,
            treatment, labs, and your own notes around it.
          </p>
        </div>

        <div className="ex-panel">
          <img className="ex-panel-img" src="/images/explore/cycle.jpg"
               alt="A woman sitting cross-legged on a mat in a bare, bright room."
               width={1800} height={900} loading="lazy" decoding="async"
               onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          <div className="ex-panel-scrim" aria-hidden="true" />

          <div className="ex-copy">
            <span className="ex-pill">Cycle</span>
            <h3 className="ex-title">Four cycles, each a day shorter</h3>
            <p className="ex-lede">
              29, then 28, then 27, then 26 days. Four separate facts in four
              different months, and one change as soon as they are kept
              together.
            </p>
          </div>

          <figure className="ex-card">
            <figcaption className="ex-card-head">
              <span>Cycle length</span>
              <i>days</i>
            </figcaption>
            <div className="ex-card-body"><Plot /></div>
          </figure>
        </div>

        {/* Not a reveal target, on purpose: the rows are the substance of the
            section, and nothing whose whole content is a reveal target may
            depend on the reveal to exist. */}
        <div className="cy-around">
          <p className="cy-around-head">What else your record holds from the same months</p>
          <ul className="cy-rows">
            {AROUND.map(([name, fact, from]) => (
              <li key={name}>
                <b>{name}</b>
                <span>{fact}</span>
                <i>{from}</i>
              </li>
            ))}
          </ul>
          <p className="cy-close">One pattern. More context.</p>
        </div>
      </div>
    </section>
  );
}

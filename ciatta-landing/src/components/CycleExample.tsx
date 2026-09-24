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

/* Pain, highest logged in each week, from 8 Dec to 2 Mar.
 *
 * THIRTEEN WEEKS, BECAUSE THIRTEEN IS WHAT MAKES THE TWO PLOTS ONE PLOT.
 * 8 Dec, 6 Jan, 3 Feb and 2 Mar are the four cycle starts above, and on a
 * weekly series beginning 8 Dec they land on weeks 0, 4, 8 and 12 — exactly
 * the quarters the line's four points sit on. So the bars run under the line
 * on the same axis, the dates below label both, and a week in one is the
 * same week in the other. A second chart on its own scale would have been a
 * second subject.
 *
 * Weekly rather than daily: a hundred and sixteen daily values is a hundred
 * and sixteen figures this record does not have, and the week is the unit
 * the rest of the section is already written in.
 *
 * The two eights are the flares the symptom row names, the sevens are the
 * weeks a period began, and nothing here is drawn as one causing another.
 * They are bars on a timeline, side by side with a line on the same
 * timeline, which is the only claim: these happened in the same weeks. */
const PAIN: [string, number][] = [
  ['8 Dec', 7], ['15 Dec', 3], ['22 Dec', 2], ['29 Dec', 3],
  ['5 Jan', 7], ['12 Jan', 3], ['19 Jan', 4], ['26 Jan', 8],
  ['2 Feb', 7], ['9 Feb', 3], ['16 Feb', 4], ['23 Feb', 8],
  ['2 Mar', 7],
];
const PAIN_MAX = 10;

/* What else the record holds from those months. A name and the fact, and
   nothing else.

   Each row used to carry where the fact came from as well — "You told
   Ciatta", "Connected", "Imported" — which is the three-part row the record
   tour's log cards use. On those cards the source is the subject: they are
   about what Ciatta reads and from where. Here it is not. This section is
   about one change and what sits around it, and a third column repeating
   one of three words down the side of five sentences was answering a
   question nobody is asking yet. Provenance is still on the page where it
   belongs: on the tour, on the How it works page, and in the Questions. */
const AROUND: [string, string][] = [
  /* The symptom row carries what she actually logs: how bad the pain was,
     how long the flare ran, and how heavy the bleeding was — which is the
     detail that decides a day and the detail she is least likely to recall
     in June. The protection is named rather than described — overnight pads,
     super tampons — because "heavy" is a word everyone uses differently and
     what she got through in two hours is not. It is also the detail a
     clinician can do something with.

     "Flare", "overnight pads" and "super tampons" are her words for her own
     experience, not a finding: no condition is named here, or anywhere on
     this site, because naming one is a clinician's job. */
  ['Symptoms', 'Energy low and pain at 8 of 10 across four days from 26 Jan, and three from 23 Feb. Both flares ran through overnight pads and super tampons every two hours.'],
  ['Sleep', 'Your two lowest weeks were 26 Jan and 23 Feb, averaging 6h 02m and 6h 14m.'],
  ['Treatment', 'Levothyroxine went from 50 mcg to 75 mcg on 3 Mar.'],
  ['Labs', 'On 14 Mar, ferritin 24: inside its range, close to the floor of it.'],
  ['Your own words', '“Waking several times a night,” written on 26 Jan.'],
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
  );
}

/**
 * The axis, under both series.
 *
 * It is .ex-points, as the tour's own series cards use it, so the figures are
 * set by styles that already exist. It sits below the bars rather than
 * directly under the line, because it labels both: the four cycle starts are
 * weeks 0, 4, 8 and 12 of the pain series, so one row of dates is the whole
 * axis and two rows would have been the same four dates twice.
 */
function Dates() {
  const last = POINTS.length - 1;
  return (
    <dl className="ex-points">
      {POINTS.map((p, i) => (
        <div key={p[0]} className={i === last ? 'is-last' : undefined}>
          <dt>{p[0]}</dt>
          <dd>{p[2]}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Pain, as bars under the line. Height is the week's highest logged pain on
 * the 0 to 10 scale the symptom row uses, so a bar at full height is a 10
 * and the two flares read as what they are rather than as the top of
 * whatever happened to be in the data.
 */
function Pain() {
  const peak = Math.max(...PAIN.map((p) => p[1]));

  return (
    <div className="cy-bars" role="img"
         aria-label={`Highest pain logged each week, out of ${PAIN_MAX}: ${
           PAIN.map(([w, v]) => `week of ${w}, ${v}`).join('; ')}`}>
      {PAIN.map(([week, v]) => (
        <span key={week} className={v === peak ? 'cy-bar is-peak' : 'cy-bar'}>
          <i style={{ height: `${(v / PAIN_MAX) * 100}%` }} />
        </span>
      ))}
    </div>
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

          {/* THE CHANGE, AND WHAT IS AROUND IT, AS ONE OBJECT.
              The rows used to sit in a block under the photograph, which made
              them a second section about the first one: you read the cycle,
              the panel ended, and then a list started. They are inside the
              panel now, in the same column as the plot and directly under it,
              and a hairline rail runs from the foot of the plot card down
              through a dot on every row.

              The rail is the whole point of the arrangement. It says these
              hang off that change — which is true, they are the same months —
              and it says it without an arrow, because an arrow from a cause
              to an effect is the one thing this section must not draw. */}
          <div className="cy-stack">
            <figure className="ex-card cy-plot-card">
              <figcaption className="ex-card-head">
                <span>Cycle length</span>
                <i>days</i>
              </figcaption>
              {/* Two series, one axis. The line is the cycle shortening and
                  the bars under it are how bad the pain got in each of those
                  weeks, drawn across the same thirteen weeks so a week in one
                  is the week above it in the other. Reading them together is
                  left to her: nothing is joined, and nothing says because. */}
              <div className="ex-card-body"><Plot /></div>
              <div className="cy-pain">
                <div className="cy-pain-head">
                  <span>Pain, highest each week</span>
                  <i>out of 10</i>
                </div>
                <Pain />
              </div>
              <Dates />
            </figure>

            {/* Not a reveal target, on purpose: these rows are the substance
                of the section, and nothing whose whole content is a reveal
                target may depend on the reveal to exist. */}
            <div className="ex-card cy-card">
              <p className="cy-card-head">
                What else your record holds from the same months
              </p>
              <ul className="cy-rows">
                {AROUND.map(([name, fact]) => (
                  <li key={name}>
                    <span className="cy-dot" aria-hidden="true" />
                    <b>{name}</b>
                    <span className="cy-fact">{fact}</span>
                  </li>
                ))}
              </ul>
              <p className="cy-close">One pattern. More context.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

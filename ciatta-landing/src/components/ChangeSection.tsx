/**
 * "What changed?" — the signature product moment.
 *
 * The whole loop in one panel, in the order it is actually read: the figure
 * that moved, what was happening around it, what may be connected, what she
 * could try, and what happened after she did. It is the app's own dark
 * resolution on the page's warm paper, the same treatment the screens behind
 * the plus already take, so the product reads as the product rather than as
 * an illustration of one.
 *
 * Every figure agrees with the record the rest of the site documents: sleep
 * averaging 7h 18m, the weeks of 26 Jan and 23 Feb lowest, cycle 29/28/27/26
 * days, levothyroxine changed 3 Mar, the 14 Mar Quest panel. Today is 1 Apr
 * 2026.
 */

/** Thirty nights, most recent last. The low stretch is the point. */
const NIGHTS = [
  7.5, 7.3, 7.6, 7.2, 7.4, 7.1, 7.5, 7.2, 6.9, 7.3, 7.0, 6.8, 7.1, 6.6, 6.9,
  6.4, 6.7, 6.2, 6.5, 6.3, 6.6, 6.1, 6.4, 6.8, 6.5, 6.9, 6.7, 7.0, 6.8, 6.77,
];
const USUAL = 7.3;

const AROUND: string[] = [
  'Work demands were higher.',
  'Fatigue was reported 3 times.',
  'Cycle changed phase.',
  'Bedtime was later on 4 nights.',
];

function Chart() {
  const lo = 5.8;
  const hi = 8;
  const h = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="cg-chart">
      <span className="cg-usual" style={{ bottom: h(USUAL) }} aria-hidden="true">
        <i>Your usual 7h 18m</i>
      </span>
      <div className="cg-bars" role="img" aria-label="Sleep across the last 30 nights, ending at 6h 46m, below a usual of 7h 18m.">
        {NIGHTS.map((v, i) => (
          <span key={i} className={v < 6.8 ? 'cg-bar is-low' : 'cg-bar'} style={{ height: h(v) }} />
        ))}
      </div>
      <div className="cg-axis" aria-hidden="true">
        <span>30 days ago</span>
        <span>Last night</span>
      </div>
    </div>
  );
}

export function ChangeSection() {
  return (
    <section className="section change" aria-labelledby="change-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="change-heading" className="band-title">What changed?</h2>
        </div>

        <div className="product cg-panel">
          <div className="cg-measure">
            <div className="cg-head">
              <span className="cg-kind">Sleep</span>
              <span className="cg-src">Measured</span>
            </div>
            <p className="cg-figure">
              6<i>h</i> 46<i>m</i>
            </p>
            <p className="cg-delta">48 min below your usual</p>
            <Chart />
          </div>

          <div className="cg-read">
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
              <p className="cg-try">Try a 7-day sleep experiment.</p>
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

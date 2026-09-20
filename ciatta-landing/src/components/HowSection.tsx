/**
 * "What is your body telling you?" — how Ciatta works, directly under the hero.
 *
 * Built to the shape findmypattern.com gives the same job: a question as the
 * headline, one sentence under it, and then the work itself as four numbered
 * steps. The shape is theirs; the steps are Ciatta's, and each one describes
 * something the product actually does rather than a benefit it claims.
 *
 * Nothing here is a card. Four columns on a rule, numbered, in the page's own
 * black type on paper, so the section reads as the opening of the argument
 * rather than as a feature grid.
 */

/* The four drawings. Each one is the step itself at the size of a stamp:
   hairlines and black type on paper, one ember accent where the step's own
   point is. Nothing is a screenshot and nothing is decorative. */

/** 01 · four sources arriving on one line. */
function Bring() {
  const sources = ['Imported', 'Uploaded', 'Measured', 'Your words'];
  return (
    <div className="hw-art hw-art-bring" aria-hidden="true">
      <ul>
        {sources.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <span className="hw-art-rail" />
    </div>
  );
}

/** 02 · a measurement falling below her own usual, the last point marked. */
function Changed() {
  const points = [7.5, 7.3, 7.4, 7.1, 6.9, 7.0, 6.6, 6.77];
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const y = (v: number) => 30 - ((v - 6.3) / 1.4) * 26;
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div className="hw-art" aria-hidden="true">
      <svg viewBox="-3 -2 106 36" className="hw-art-svg">
        <line x1="0" x2="100" y1={y(7.3)} y2={y(7.3)} stroke="currentColor" strokeOpacity="0.28" strokeDasharray="2 2" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="2.6" fill="var(--change-text)" />
      </svg>
      <span className="hw-art-cap">Your usual, and last night</span>
    </div>
  );
}

/** 03 · the same week, read across four parts of the record. */
function Beside() {
  const lanes: [string, number, number][] = [
    ['Sleep', 10, 46],
    ['Cycle', 34, 30],
    ['Workload', 48, 40],
    ['Your words', 62, 16],
  ];
  return (
    <div className="hw-art hw-art-beside" aria-hidden="true">
      {lanes.map(([name, left, width]) => (
        <span className="hw-lane" key={name}>
          <i>{name}</i>
          <b><u style={{ left: `${left}%`, width: `${width}%` }} /></b>
        </span>
      ))}
      <span className="hw-art-mark" style={{ left: '62%' }} />
    </div>
  );
}

/** 04 · seven days tried, and what they came back as. */
function Next() {
  const days = [1, 1, 0, 1, 1, 0, 1];
  return (
    <div className="hw-art hw-art-next" aria-hidden="true">
      <span className="hw-days">
        {days.map((hit, i) => (
          <i key={i} className={hit ? 'is-hit' : undefined} />
        ))}
      </span>
      <span className="hw-art-cap">5 of 7 nights closer to your usual</span>
      <span className="hw-brief">
        <em />
        <em />
        <em className="is-short" />
      </span>
    </div>
  );
}

const ART = [Bring, Changed, Beside, Next];

const STEPS: [string, string, string][] = [
  [
    '01',
    'Bring it together',
    'Import results from your providers, upload the documents they send, connect the app or wearable you already use, and add the things only you can say.',
  ],
  [
    '02',
    'See what changed',
    'Ciatta reads your record in order and shows what moved against your own usual, with the date it moved and where the figure came from.',
  ],
  [
    '03',
    'See what it sits beside',
    'Every change is read beside the week it happened in: your cycle, your care, your workload, your own words. Ciatta names what may be connected, and what that is based on.',
  ],
  [
    '04',
    'Decide what to do next',
    'Try one thing, see what happened after, and take what changed into your next appointment as one page rather than six months of memory.',
  ],
];

export function HowSection() {
  return (
    <section className="section how" aria-labelledby="how-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="how-heading" className="band-title">
            What is your body telling you?
          </h2>
          <p className="band-sub">
            The story of your health unfolds over time. Ciatta brings the pieces
            together and reads them in order, so the changes, and what sits
            beside them, are yours to see.
          </p>
        </div>

        <ol className="hw-steps">
          {STEPS.map(([n, title, body], i) => {
            const Art = ART[i];
            return (
              <li key={n}>
                <Art />
                <span className="hw-n">{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            );
          })}
        </ol>

        <p className="hw-note">
          A connection is not a diagnosis. Ciatta shows what an observation is
          based on, and what is still too thin to call.
        </p>
      </div>
    </section>
  );
}

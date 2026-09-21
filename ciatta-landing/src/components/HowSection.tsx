import { DayChart } from './ProductShowcase';

/**
 * "What is your body telling you?" — how Ciatta works, directly under the hero.
 *
 * findmypattern.com's shape: a question, one sentence, then the work as
 * numbered steps, each one shown rather than described. The steps are
 * Ciatta's, and each drawing is the product itself: the sources arriving, the
 * Today screen reading them together, the suggestions it ends on, and the page
 * she takes to an appointment.
 *
 * Seeing what changed and seeing what it sits beside are one step, because on
 * the screen they are one screen.
 *
 * Step 01 draws the sources as a hub: each one keeps its own line in to
 * Ciatta. Where a source has supplied its own mark the node uses it; where it
 * has not, the node draws a plain shape rather than an imitation of one.
 */

/* -- 01 · what arrives, and where it arrives ------------------------------- *
 * findmypattern's shape: the sources stacked in a list, each one running into
 * the product's own mark. Each keeps its own line rather than being pooled
 * into one arrow, because that is the claim — they arrive separately and are
 * read together.
 *
 * `logo` is the path to a source's official mark. Give a row one and it uses
 * the file; leave it off and the row draws a plain shape instead. A generic
 * shape is honest about standing in for a mark. A hand-drawn lookalike of
 * somebody's logo is not, so there are none here.
 */

type Node = {
  key: string;
  name: string;
  /** e.g. '/images/sources/oura.svg' — drop the file in and set this */
  logo?: string;
  glyph: React.ReactNode;
};

const NODES: Node[] = [
  { key: 'oura', name: 'Oura',
    logo: '/images/sources/oura.png',
    glyph: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.6" /></svg> },
  { key: 'whoop', name: 'WHOOP',
    logo: '/images/sources/whoop.png',
    glyph: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l4 10 5-10 5 10 4-10" /></svg> },
  { key: 'apple', name: 'Apple Health',
    logo: '/images/sources/apple-health.png',
    glyph: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.5 12 20 12 20Z" /></svg> },
  { key: 'mychart', name: 'MyChart',
    logo: '/images/sources/mychart.png',
    glyph: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15l4-5 3.5 3L20 6" /></svg> },
  { key: 'pdf', name: 'PDF results',
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 2.5h8L19 7.5v14H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 2.5V8h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <text x="12" y="18" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="currentColor">PDF</text>
      </svg>
    ) },
  { key: 'words', name: 'Your own words',
    glyph: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18.5 5 15l9-9 3.5 3.5-9 9-3.5 1Z" /><path d="M13.5 6.5 17 10" /></svg> },
];

/* The rows sit on the left and the mark on the right, in the same 0-100 space
   the lines are drawn in. The lines begin just clear of the names rather than
   out at the edge, so each one reads as leaving its own source. */
const ROWS_RIGHT = 54;
const HUB_X = 84;

function Sources() {
  const step = 100 / NODES.length;

  return (
    <div className="hw-hub">
      <svg className="hw-hub-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {NODES.map((n, i) => {
            const y = step * (i + 0.5);
            return (
              <path
                key={n.key} id={`hw-path-${n.key}`}
                d={`M${ROWS_RIGHT},${y} C${ROWS_RIGHT + 11},${y} ${HUB_X - 11},50 ${HUB_X},50`}
              />
            );
          })}
        </defs>

        {NODES.map((n) => (
          <use key={n.key} href={`#hw-path-${n.key}`} vectorEffect="non-scaling-stroke" />
        ))}

        {/* what each source is sending, on its way in. The marks are staggered
            so the six read as a flow rather than as one pulse six times. */}
        {NODES.map((n, i) => (
          <circle className="hw-flow" key={n.key} r="0.95">
            <animateMotion dur="2.8s" repeatCount="indefinite" begin={`${i * 0.38}s`} keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href={`#hw-path-${n.key}`} />
            </animateMotion>
            <animate attributeName="opacity" dur="2.8s" repeatCount="indefinite" begin={`${i * 0.38}s`}
                     values="0;1;1;0" keyTimes="0;0.12;0.82;1" />
          </circle>
        ))}
      </svg>

      <ul className="hw-rows">
        {NODES.map((n) => (
          <li className="hw-node" key={n.key}>
            <span className={n.logo ? 'hw-node-mark has-logo' : 'hw-node-mark'}>
              {n.logo
                ? <img src={n.logo} alt="" width={128} height={128} loading="lazy" decoding="async" />
                : n.glyph}
            </span>
            <span className="hw-node-b">
              <b>{n.name}</b>
            </span>
          </li>
        ))}
      </ul>

      <div className="hw-hub-c">
        <img src="/images/icon.svg" alt="Ciatta" width={96} height={96} />
      </div>
    </div>
  );
}

/* -- 02 · the day, and what Ciatta makes of it ----------------------------- *
 * The part of Today this step is about: the day drawn as one frame, and the
 * finding under it. Not the whole screen shrunk, but the two things the step
 * claims, at the size they are read at.                                      */

function TodayRead() {
  return (
    <div className="product hw-frag">
      <div className="hw-frag-head">
        <span>Today</span>
        <i>Wed 1 Apr · day 5</i>
      </div>
      <p className="hw-frag-hello">Good afternoon, Maya.</p>

      <DayChart />

      <div className="hw-frag-ins">
        <span className="hw-frag-tag">What may be connected</span>
        <p>Afternoon pain has been higher after nights under 7 hours.</p>
        <span className="hw-frag-basis">Seen 3 times this month</span>
      </div>
    </div>
  );
}

/* -- 03 · the suggestions, at the size they are read ----------------------- */

const TRY: [string, string, string][] = [
  ['Wind down by 10:30pm',
   'Your last 3 nights began after 11:40pm, and your longest nights this month started before 11',
   'Tonight'],
  ['A short walk before 6pm',
   'Your energy rose in the evening after a walk on 4 of 6 days, and today it has been low since 11am',
   'Today'],
  /* Not everything worth doing is something she does by herself. */
  ['Raise it with your clinician',
   'Symptom days have risen since your dose changed on 3 Mar, and ferritin has fallen across three results',
   'Next visit'],
];

function Suggestions() {
  return (
    <div className="product hw-frag">
      <div className="hw-frag-head">
        <span>What you could try</span>
        <i>3 to consider</i>
      </div>
      <div className="ps-rows">
        {TRY.map(([what, why, when]) => (
          <div className="ps-row" key={what}>
            <div className="ps-row-line">
              <span className="ps-row-k">
                <b>{what}</b>
                <i>{why}</i>
              </span>
              <span className="ps-row-v">{when}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

/* -- 04 · the page she takes to an appointment ----------------------------- */

const BRIEF: [string, string[]][] = [
  ['What changed', [
    'Symptom days rose from 4 to 11 a month across 6 weeks.',
    'Sleep fell to 6h 46m, 48 minutes under her usual.',
  ]],
  ['What was happening around it', [
    'Levothyroxine increased from 50 to 75 mcg on 3 Mar.',
    'Cycle shortened from 29 to 26 days across 4 cycles.',
    'Ferritin 32 on 12 Aug, 24 on 14 Mar, 18 on 2 Sep. Reference range 15 to 150.',
  ]],
  ['What she tried', [
    'A 7-day sleep experiment from 10 Mar, with an earlier wind-down on 5 of 7 nights.',
  ]],
  ['What happened next', [
    'Sleep returned closer to her usual on 5 of 7 nights. Fatigue was reported less often.',
  ]],
];

const QUESTIONS: string[] = [
  'Could the cycle shortening and the sleep change be worth evaluating together?',
  'Is the ferritin trend worth repeating, given the heavier bleeding reported in the same period?',
  'Should the dose change on 3 Mar be reviewed against the symptoms recorded since?',
];

function Brief() {
  return (
    <article className="hw-page" aria-label="An example health brief, as a printable page">
      <header className="hw-page-head">
        <img src="/images/icon.svg" alt="" width={44} height={44} />
        <div>
          <h4>Health brief</h4>
          <p>Maya R. · 1 Oct 2025 to 1 Apr 2026 · prepared 1 Apr 2026</p>
        </div>
      </header>

      <dl className="hw-page-body">
        {BRIEF.map(([label, lines]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <section className="hw-page-ask" aria-label="Questions to discuss">
        <h5>Questions to discuss</h5>
        <ol>
          {QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <footer className="hw-page-foot">
        <span>Measured · imported · uploaded · told by Maya</span>
        <span>Ciatta does not diagnose or replace medical care.</span>
      </footer>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

/* One line per step: what it is and what it does, said together. */
const STEPS: [string, string, () => React.ReactNode][] = [
  ['01', 'Bring it together: wearable, portal, documents, and your own words.', Sources],
  ['02', 'See what changed, and what sat beside it that day.', TodayRead],
  ['03', 'Decide what to try, what to raise, and what happened after.', Suggestions],
  ['04', 'Walk in informed: six months as one page, three questions.', Brief],
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
          {STEPS.map(([n, line, Art]) => (
            <li key={n} className="hw-step">
              {/* the step says itself in one line, then shows itself */}
              <div className="hw-head">
                <span className="hw-n">{n}</span>
                <h3>{line}</h3>
              </div>

              <div className={Art === Brief ? 'hw-art-wrap is-page' : 'hw-art-wrap'}>
                <Art />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

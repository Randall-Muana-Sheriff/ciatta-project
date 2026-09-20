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
 * The source names are set as type rather than as their logos: Ciatta says
 * where a figure can come from without borrowing anyone's mark.
 */

/* -- 01 · what arrives, and where it arrives ------------------------------- */

const SOURCES: [string, string][] = [
  ['Oura · WHOOP · Apple Health', 'Measured'],
  ['MyChart · Epic', 'Imported'],
  ['PDF results', 'Uploaded'],
  ['Your own words', 'You tell Ciatta'],
];

function Sources() {
  return (
    <div className="hw-sources">
      <ul className="hw-src-list">
        {SOURCES.map(([name, kind]) => (
          <li key={name}>
            {name === 'PDF results' && <span className="hw-src-pdf" aria-hidden="true">PDF</span>}
            <b>{name}</b>
            <i>{kind}</i>
          </li>
        ))}
      </ul>

      <div className="hw-src-into">
        <span className="hw-src-rail" aria-hidden="true" />
        <img src="/images/icon.svg" alt="Ciatta" width={96} height={96} className="hw-src-mark" />
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
];

function Suggestions() {
  return (
    <div className="product hw-frag">
      <div className="hw-frag-head">
        <span>What you could try</span>
        <i>2 for today</i>
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

const STEPS: [string, string, string, () => React.ReactNode][] = [
  [
    '01',
    'Bring it together',
    'Your wearable, your portal, the documents your provider sends, and the things only you can say. Each kept with its date and its source.',
    Sources,
  ],
  [
    '02',
    'See what changed, and what it sits beside',
    'What moved against your own usual, and the day it moved in. Ciatta names what may be connected, and what that is based on.',
    TodayRead,
  ],
  [
    '03',
    'Decide what to do next',
    'Try one thing, see what happened after, and let Ciatta keep the result, so the next reading starts from what you already learned.',
    Suggestions,
  ],
  [
    '04',
    'Walk in informed',
    'Six months as one page: what changed, what was around it, what you tried, what happened next, and three questions worth asking.',
    Brief,
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
          {STEPS.map(([n, title, body, Art]) => (
            <li key={n} className="hw-step">
              {/* each drawing is the part of the product the step is about,
                  at the size that part is read at */}
              <div className={Art === Brief ? 'hw-art-wrap is-page' : 'hw-art-wrap'}>
                <Art />
              </div>

              <div className="hw-say">
                <span className="hw-n">{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="hw-note">
          A connection is not a diagnosis. Ciatta shows what an observation is
          based on, and what is still too thin to call.
        </p>
      </div>
    </section>
  );
}

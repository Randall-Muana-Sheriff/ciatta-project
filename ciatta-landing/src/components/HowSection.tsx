import { Phone } from './PhoneChrome';
import { TodayScreen } from './TodayScreen';

/**
 * How Ciatta works: the loop, and every stage shown rather than described.
 *
 * findmypattern.com's shape — a heading, one sentence, then the work as
 * numbered steps, each one shown. The steps are Ciatta's and every drawing is
 * the product itself: the sources arriving, the Today screen reading them
 * together, the suggestions it ends on, what happened after she tried one,
 * and the page she takes to an appointment.
 *
 * The stages are the five the How it works page uses, in the same order and
 * under the same names. This is that loop at a glance; the depth page has the
 * long version, and neither has to say the other's job.
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
const ROWS_RIGHT = 60;
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
 * The hero's screen itself, not a second drawing of it. This step is about
 * what she sees on that screen, so it shows her that screen.
 */

function TodayRead() {
  return (
    <Phone className="is-today">
      <TodayScreen />
    </Phone>
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
    <Phone title="Today" className="is-rows">
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
    </Phone>
  );
}

/* -- 04 · the brief she takes to an appointment ---------------------------- *
 * The brief's own screen: what is in it, rather than the whole of it shrunk
 * until none of it can be read. Each line is a part of the brief and what
 * that part is, and the last one is the only thing she has to do with it.
 */

/* The brief says what Ciatta does, in the order Ciatta does it: what changed,
   what was around it, what she tried and what came of it, what is still worth
   asking, and the one thing she does with it. Not a table of contents. */
const BRIEF: [string, string][] = [
  ['What changed', 'Symptoms, sleep and your cycle'],
  ['What was happening around it', 'Your medication, your week, your words'],
  ['What you tried', 'And whether it held'],
  ['Questions to discuss', 'Three, drawn from your own record'],
  ['Take it with you', 'Print it, or send it ahead'],
];

function Caret() {
  return (
    <svg viewBox="0 0 8 14" className="ps-caret" aria-hidden="true">
      <path d="m1 1 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Brief() {
  return (
    <Phone title="Health brief" className="is-rows is-brief">
      <div className="product hw-frag">
        {/* the bar above already names the screen, so this line says what the
            brief covers instead of saying it twice */}
        <div className="hw-frag-head">
          <span>1 Oct to 1 Apr</span>
          <i>Prepared today</i>
        </div>
        <div className="ps-rows">
          {BRIEF.map(([name, what]) => (
            <div className="ps-row" key={name}>
              <div className="ps-row-line">
                <span className="ps-row-k">
                  <b>{name}</b>
                  <i>{what}</i>
                </span>
                <Caret />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/* -- 05 · what happened after she tried it --------------------------------
 * The stage the old four steps had no drawing for, because they ended on the
 * brief. Learn is the one that makes the loop a loop — what happened after
 * she tried something is what the next change gets read against — so it gets
 * a screen of its own rather than a sentence standing in for one.
 *
 * Same rows, same phone, same figures as everywhere else: seven nights after
 * the wind-down suggestion in step 03.
 */

const AFTER: [string, string, string][] = [
  ['Sleep', 'Closer to your usual', '5 of 7'],
  ['Fatigue', 'Reported less often', '3 fewer'],
  ['Energy', 'Higher in the morning', '4 of 7'],
];

function Next() {
  return (
    <Phone title="Today" className="is-rows">
      <div className="product hw-frag">
        <div className="hw-frag-head">
          <span>What happened next</span>
          <i>7 nights</i>
        </div>
        <div className="ps-rows">
          {AFTER.map(([what, how, n]) => (
            <div className="ps-row" key={what}>
              <div className="ps-row-line">
                <span className="ps-row-k">
                  <b>{what}</b>
                  <i>{how}</i>
                </span>
                <span className="ps-row-v">{n}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The loop, and each stage shown rather than described.
 *
 * This section was four illustrated steps, then five lines of text with no
 * pictures at all, and neither was right. The four steps were the mechanism
 * explained at length to someone who had not yet been given a reason to care
 * about the mechanism, and they repeated the How it works page exactly. Five
 * bare lines fixed the length and lost the thing that actually sells it:
 * every one of these stages is a screen, and a screen shown is worth more
 * than a screen described.
 *
 * So the stages stay five and keep the names the How it works page uses —
 * Connect, See, Act, Learn, Prepare — and each one shows its own screen. The
 * depth page still has the long version; this is the same loop at a glance.
 */

const LOOP: [string, string, string, () => React.ReactNode][] = [
  ['01', 'Connect',
   'Your wearable, your portal, the documents you were sent, and what you tell it yourself.',
   Sources],
  ['02', 'See',
   'What changed, and what your record holds from around the same time.',
   TodayRead],
  ['03', 'Act',
   'Something to try or something to raise, each one carrying the pattern it came from.',
   Suggestions],
  ['04', 'Learn',
   'What happened after you tried it, kept, and read against the next change.',
   Next],
  ['05', 'Prepare',
   'One page for an appointment: what changed, what you tried, and what is worth asking.',
   Brief],
];

export function HowSection() {
  return (
    <section className="section how" aria-labelledby="how-heading">
      <div className="shell">
        <div className="band-head">
          {/* No sentence under it. The five stages are named and shown
              directly below, so a line explaining that there are five of
              them was the heading's work done twice. */}
          <h2 id="how-heading" className="band-title">How Ciatta works</h2>
        </div>

        <ol className="hw-steps">
          {LOOP.map(([n, name, line, Art]) => (
            <li key={n} className="hw-step">
              {/* the stage names itself, says what it does, then shows it */}
              <div className="hw-head">
                <span className="hw-n">{n}</span>
                <h3><b>{name}</b> {line}</h3>
              </div>

              <div className={Art === Sources ? 'hw-art-wrap' : 'hw-art-wrap is-phone'}>
                <Art />
              </div>
            </li>
          ))}
        </ol>

        <p className="lp-more">
          <a href="/how-it-works/">See how it works, in full</a>
        </p>
      </div>
    </section>
  );
}

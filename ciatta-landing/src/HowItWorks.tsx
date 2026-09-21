import { useState } from 'react';
import { SiteHeader } from './components/SiteHeader';
import { Wordmark } from './components/Wordmark';
import { Film } from './components/Film';
import { Phone } from './components/PhoneChrome';
import { TodayScreen } from './components/TodayScreen';

/**
 * How Ciatta works — built to the composition of whoop.com/how-it-works.
 *
 * Their page is one dark document from the hero to the footer: a film opener,
 * a heading on its own, a row of steps, then module after module in which a
 * numbered accordion sits beside a phone whose screen changes as each item is
 * opened, and it closes on what the first thirty days look like.
 *
 * The composition is theirs. Everything inside it is Ciatta's: its screens,
 * its record, its type, and a claim about the first month that a device
 * company does not have to make.
 */

type Item = { n: string; title: string; body: string; Screen: () => React.ReactNode };

/* -- the screens ----------------------------------------------------------- *
 * One per item, because each item is about a different thing and a screen
 * that does not match its paragraph is decoration.
 *
 * They are built the way the hero's screen and the four columns under it are
 * built, which is the only way anything on this page renders on a real
 * iPhone: the hero's device, plain rem sizes, no query container, and no
 * unit derived from something a browser has to agree about.
 *
 * Four shapes carry all eleven: a figure, a list of rows, dated notes, and a
 * finding. The day itself is the hero's own screen.
 */

type Row = [string, string, string];

/** A measurement, at the size a measurement is read at. */
function Figure({
  title, head, big, sub, rows,
}: { title: string; head: [string, string]; big: string; sub: string; rows?: Row[] }) {
  return (
    <Phone title={title} className="is-rows">
      <div className="product hw-frag">
        <div className="hw-frag-head"><span>{head[0]}</span><i>{head[1]}</i></div>
        <p className="hf-big">{big}</p>
        <p className="hf-sub">{sub}</p>
        {rows && (
          <div className="ps-rows">
            {rows.map(([k, why, v]) => (
              <div className="ps-row" key={k}>
                <div className="ps-row-line">
                  <span className="ps-row-k"><b>{k}</b>{why && <i>{why}</i>}</span>
                  <span className="ps-row-v">{v}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Phone>
  );
}

/** A list: results across time, things to try, the parts of a brief. */
function Rows({
  title, head, rows, caret,
}: { title: string; head: [string, string]; rows: Row[]; caret?: boolean }) {
  return (
    <Phone title={title} className="is-rows is-brief">
      <div className="product hw-frag">
        <div className="hw-frag-head"><span>{head[0]}</span><i>{head[1]}</i></div>
        <div className="ps-rows">
          {rows.map(([k, why, v]) => (
            <div className="ps-row" key={k + v}>
              <div className="ps-row-line">
                <span className="ps-row-k"><b>{k}</b>{why && <i>{why}</i>}</span>
                {caret ? (
                  <svg viewBox="0 0 8 14" className="ps-caret" aria-hidden="true">
                    <path d="m1 1 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="ps-row-v">{v}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/** What she told Ciatta, dated as she wrote it. */
function Notes({ notes }: { notes: [string, string][] }) {
  return (
    <Phone title="Your own words" className="is-rows">
      <div className="product hw-frag">
        <div className="hw-frag-head"><span>What you told Ciatta</span><i>3 notes</i></div>
        <div className="hf-notes">
          {notes.map(([when, what]) => (
            <div key={when}>
              <span>{when}</span>
              <p>{what}</p>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/** A finding, and what it rests on. */
function Finding({
  tag, finding, basis,
}: { tag: string; finding: string; basis: string }) {
  return (
    <Phone title="Today" className="is-rows">
      <div className="product hw-frag">
        <div className="hw-frag-ins is-alone">
          <span className="hw-frag-tag">{tag}</span>
          <p>{finding}</p>
          <span className="hw-frag-basis">{basis}</span>
        </div>
      </div>
    </Phone>
  );
}

/* -- one per item ---------------------------------------------------------- */

const ChangedScreen = () => (
  <Figure title="Sleep" head={['Last night', 'Wed 1 Apr']} big="6h 46m"
          sub="48 minutes under your usual of 7h 18m"
          rows={[['Measured', 'Oura, last night', '11:42pm'] as Row]} />
);

const DayScreen = () => <Phone className="is-today"><TodayScreen /></Phone>;

const ConnectedScreen = () => (
  <Finding tag="Insights"
           finding="Your afternoon pain has been higher following nights under 7 hours."
           basis="Seen on 3 days this month. A connection is not a cause." />
);

const TryScreen = () => (
  <Rows title="Today" head={['What you could try', '3 to consider']} rows={[
    ['Wind down by 10:30pm', 'Your last 3 nights began after 11:40pm', 'Tonight'],
    ['A short walk before 6pm', 'Your energy rose after a walk on 4 of 6 days', 'Today'],
    ['Raise it with your clinician', 'Symptom days have risen since 3 Mar', 'Next visit'],
  ]} />
);

const NextScreen = () => (
  <Rows title="Today" head={['What happened next', '7 nights']} rows={[
    ['Sleep', 'Closer to your usual', '5 of 7'],
    ['Fatigue', 'Reported less often', '3 fewer'],
    ['Energy', 'Higher in the morning', '4 of 7'],
  ]} />
);

const CycleScreen = () => (
  <Rows title="Cycle" head={['Your last four cycles', 'Days']} rows={[
    ['8 Dec', 'Follicular phase 14 days', '29'],
    ['6 Jan', '', '28'],
    ['3 Feb', '', '27'],
    ['2 Mar', 'Shortest of the four', '26'],
  ]} />
);

const LabScreen = () => (
  <Rows title="Ferritin" head={['Every result you have', 'ng/mL']} rows={[
    ['12 Aug', 'Quest Diagnostics', '32'],
    ['14 Mar', 'Quest Diagnostics', '24'],
    ['2 Sep', 'Range 15 to 150', '18'],
  ]} />
);

const ToldScreen = () => (
  <Notes notes={[
    ['12 Jan', '“A stressful stretch at work.”'],
    ['26 Jan', '“Waking several times a night.”'],
    ['3 Mar', '“My doctor changed my medication.”'],
  ]} />
);

const BriefScreen = () => (
  <Rows title="Health brief" head={['1 Oct to 1 Apr', 'Prepared today']} caret rows={[
    ['What changed', 'Symptoms, sleep and your cycle', ''],
    ['What was happening around it', 'Your medication, your week, your words', ''],
    ['What you tried', 'And whether it held', ''],
    ['Questions to discuss', 'Three, drawn from your own record', ''],
    ['Take it with you', 'Print it, or send it ahead', ''],
  ]} />
);

const StartScreen = () => (
  <Rows title="Sources" head={['Connected', 'Day 1']} rows={[
    ['Oura', 'Sleep, HRV, temperature', 'Measured'],
    ['St. Luke’s MyChart', 'Lab results, medications', 'Imported'],
    ['Bloodwork results.pdf', 'Read from your document', 'Uploaded'],
    ['Your own words', 'Whenever you write them', 'Told'],
  ]} />
);

const FirstScreen = () => (
  <Finding tag="First observation"
           finding="Your sleep has been lower during high-demand weeks."
           basis="Seen twice. Ciatta waits until it has seen a thing more than once, and says how thin the evidence still is." />
);

/* -- the day, five stages ------------------------------------------------- */

const DAY: Item[] = [
  { n: '01', title: 'What changed',
    body: 'Sleep came in at 6h 46m, 48 minutes under your usual. Ciatta says what your usual is rather than assuming eight hours, and it says when the figure was measured and by what.',
    Screen: ChangedScreen },
  { n: '02', title: 'What happened around it',
    body: 'Work demands were higher. Fatigue was reported three times. Your cycle changed phase. Bedtime was later on four nights. The day is drawn as one frame, not three charts.',
    Screen: DayScreen },
  { n: '03', title: 'What may be connected',
    body: 'Afternoon pain has been higher after nights under seven hours, seen three times this month. Ciatta shows what the observation is based on, and says plainly that a connection is not a cause.',
    Screen: ConnectedScreen },
  { n: '04', title: 'What you could do',
    body: 'Two things drawn from your own record, each carrying the pattern that produced it: wind down by 10:30 because your last three nights began after 11:40, not because earlier nights are generally better.',
    Screen: TryScreen },
  { n: '05', title: 'What happened next',
    body: 'Seven nights later, sleep returned closer to your usual on five of them. Ciatta keeps that result and reads the next change against it.',
    Screen: NextScreen },
];

/* -- the record, beyond the day ------------------------------------------- */

const RECORD: Item[] = [
  { n: '01', title: 'Your cycle, and what moves with it',
    body: 'Length, start dates and phase, with each cycle read against the last four rather than against an average woman.',
    Screen: CycleScreen },
  { n: '02', title: 'Your results, across time',
    body: 'Upload the document your provider sent. Ciatta reads the values out of it and keeps each one beside every other time it was measured, with its unit, its range and its date.',
    Screen: LabScreen },
  { n: '03', title: 'Your own words, kept',
    body: 'A stressful week, a bad night, a dose change. Dated as you wrote it, never overwritten by a device or a clinic, and read beside the measurements.',
    Screen: ToldScreen },
  { n: '04', title: 'One page for an appointment',
    body: 'What changed, what was happening around it, what you tried, what happened next, and the questions worth asking. Take it, print it, or share it.',
    Screen: BriefScreen },
];

/* -- the first thirty days ------------------------------------------------ */

const DAYS: Item[] = [
  { n: 'Day 1', title: 'Bring what you already have',
    body: 'Connect one source and upload one document. Ciatta reads what is there and says plainly what it cannot see yet.',
    Screen: StartScreen },
  { n: 'Weeks 2 to 4', title: 'The first observations',
    body: 'Ciatta waits until it has seen something more than once before it calls it anything. When it does, it shows the working, and it says how thin the evidence still is.',
    Screen: FirstScreen },
];

/* -- a module: a numbered accordion, and the screen it is about ------------ */

function Module({
  id, kind, title, lede, items, reversed,
}: {
  id: string; kind: string; title: string; lede?: string; items: Item[]; reversed?: boolean;
}) {
  const [open, setOpen] = useState(0);
  const Screen = items[open].Screen;

  return (
    <section className="section hw2-module" aria-labelledby={id}>
      <div className="shell">
        <div className="band-head">
          <span className="hw2-kind">{kind}</span>
          <h2 id={id} className="band-title">{title}</h2>
          {lede && <p className="band-sub">{lede}</p>}
        </div>

        <div className={reversed ? 'hw2-body is-reversed' : 'hw2-body'}>
          <div className="hw2-list">
            {items.map((item, i) => {
              const isOpen = i === open;
              return (
                <div className={isOpen ? 'hw2-item is-open' : 'hw2-item'} key={item.n}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`${id}-${item.n}`}
                      onClick={() => setOpen(i)}
                    >
                      <span className="hw2-n">{item.n}</span>
                      <span className="hw2-t">{item.title}</span>
                      <span className="hw2-mark" aria-hidden="true" />
                    </button>
                  </h3>
                  <div id={`${id}-${item.n}`} className="hw2-panel" hidden={!isOpen}>
                    <p>{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hw2-media">
            <Screen />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HowItWorks() {
  return (
    <div className="page-dark">
      <a className="skip" href="#how-main">Skip to how Ciatta works</a>

      <SiteHeader current="/how-it-works/" />

      <main id="how-main">
        {/* ---------------------------------- HERO ------------------------ */}
        <section className="hero has-film is-page" aria-labelledby="hiw-title">
          <Film base="hero-2" />
          <div className="shell hero-inner">
            <div className="hero-copy">
              <h1 id="hiw-title" className="display hero-title">How Ciatta works</h1>
              <p className="hero-lede">
                Your health information already exists. It is in a portal, an
                app, a wearable and your head. Ciatta puts it in one order and
                reads it, so what changed and what sat beside it are yours to
                see.
              </p>
            </div>
          </div>
        </section>

        <Module
          id="day-heading"
          kind="A day"
          title="Your day, read in five stages"
          lede="This is a night of sleep. It is the same five stages for a lab result, a symptom or a dose change."
          items={DAY}
        />

        <Module
          id="record-heading"
          kind="Your record"
          title="Everything else it reads, and keeps"
          lede="Any part can be missing. Ciatta says which rather than filling the gap."
          items={RECORD}
          reversed
        />

        {/* ------------------------------ THE FILM ------------------------- */}
        <section className="hw2-film" aria-label="Ciatta in a sentence">
          <Film base="hero-2" className="hw2-film-layer" scrim="hw2-film-scrim" />
          <div className="shell">
            <p className="hw2-film-line">
              A connection is not a diagnosis. Ciatta shows what an observation
              is based on, and what is still too thin to call.
            </p>
          </div>
        </section>

        <Module
          id="start-heading"
          kind="Getting started"
          title="What to expect in your first 30 days"
          lede="Ciatta is more useful in month six than in week one, and it does not pretend otherwise."
          items={DAYS}
        />

      </main>

      <footer className="footer shell">
        <span className="sr-only">Ciatta</span>
        <Wordmark size="sm" />
        <nav className="footer-nav" aria-label="Footer">
          <a href="/">Home</a>
          <a href="/how-it-works/" aria-current="page">How it works</a>
          <a href="/briefs/">Briefs</a>
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Use</a>
        </nav>
        <span className="footer-copy">© 2026 Ciatta</span>
      </footer>
    </div>
  );
}

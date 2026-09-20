import { SiteHeader } from './components/SiteHeader';
import { SubscribeForm } from './components/SubscribeForm';
import { Wordmark } from './components/Wordmark';
import { Film } from './components/Film';
import { DayChart, ExperimentScreen, TodayScreen } from './components/ProductShowcase';

/**
 * How Ciatta works — the page the header points at.
 *
 * Built to the shape of whoop.com/how-it-works: a film hero carrying one
 * sentence, the work itself as four steps, what the product reads, one domain
 * opened up as numbered stages, what the first thirty days actually look like,
 * and the invitation at the foot.
 *
 * Their page sells a device, so it explains a sensor. Ciatta has no sensor, so
 * the same slots carry what Ciatta actually does: the record it holds, the
 * order it reads it in, and the limits it keeps.
 */

/* -- the four steps, said longer than the home page says them -------------- */

const STEPS: [string, string, string][] = [
  ['Bring it together',
   'Connect a wearable or an app you already use, import results from a patient portal, upload the documents your provider sends, and write down the things only you can say.',
   'Nothing is asked for twice. Every figure keeps the date it happened on and the source it came from.'],
  ['Read it in order',
   'Ciatta reads your record along a timeline rather than as a set of dashboards, so a change is always read against your own usual rather than a population average.',
   'What moved, when it moved, and what your usual looked like before it did.'],
  ['See what sits beside it',
   'A measurement is read beside the week it happened in: your cycle phase, your care, your workload, the weather you were in, the things you wrote down.',
   'Ciatta names what may be connected, how often it has seen it, and what the observation is based on.'],
  ['Decide, and see what happened',
   'Try one thing for a week. Ciatta keeps the result and reads the next change against it, and turns six months into one page when you have an appointment.',
   'A connection is not a diagnosis, and Ciatta says so on the observation rather than in a footnote.'],
];

/* -- what Ciatta reads ----------------------------------------------------- */

const PARTS: [string, string][] = [
  ['Cycle', 'Length, start dates, phase, and how each cycle compares with the last.'],
  ['Sleep', 'Duration and timing, nightly, against your own usual rather than eight hours.'],
  ['Symptoms', 'What you felt, when, how often and how severe, dated as you entered it.'],
  ['Medications & supplements', 'What you take, what changed, and the date it changed.'],
  ['Labs & results', 'Values with their units and ranges, kept across every panel you have.'],
  ['Surgery & procedures', 'The intervention, and what your record did on either side of it.'],
  ['Your own words', 'A stressful week, a bad night, a dose change. Context no device records.'],
  ['Everyday context', 'Work, travel, meals, routines, and the weather the week happened in.'],
];

/* -- one change, opened up ------------------------------------------------- */

const STAGES: [string, string, string][] = [
  ['01', 'What changed',
   'Sleep came in at 6h 46m, 48 minutes under your usual, and Ciatta says what your usual is rather than assuming it.'],
  ['02', 'What happened around it',
   'Work demands were higher. Fatigue was reported three times. Your cycle changed phase. Bedtime was later on four nights.'],
  ['03', 'What may be connected',
   'Your sleep has been lower during several high-demand weeks. Ciatta says how many times it has seen that, and over what period.'],
  ['04', 'What you could do',
   'Two things drawn from your own record, each carrying the pattern that produced it, not general advice about sleep hygiene.'],
  ['05', 'What happened next',
   'Seven nights later, sleep returned closer to your usual on five of them, and that result is kept for the next reading.'],
];

/* -- the first thirty days ------------------------------------------------- */

const DAYS: [string, string, string][] = [
  ['Day 1', 'Bring what you already have',
   'Connect one source and upload one document. Ciatta reads what is there and says plainly what it cannot see yet.'],
  ['Week 1', 'Your record starts to hold a shape',
   'Measurements arrive nightly, and what you write down sits beside them with the same weight.'],
  ['Weeks 2 to 4', 'The first observations',
   'Ciatta needs to see something more than once before it calls it anything. When it does, it shows the working.'],
  ['Day 30', 'The first brief',
   'What changed, what was happening around it, what you tried, what happened next, and the questions worth asking.'],
];

export default function HowItWorks() {
  return (
    <>
      <a className="skip" href="#how-main">Skip to how Ciatta works</a>

      <SiteHeader current="/how-it-works/" />

      <main id="how-main">
        {/* ---------------------------------- HERO ------------------------ */}
        <section className="hero has-film is-page" aria-labelledby="hiw-title">
          <Film base="hero" />
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

        {/* ------------------------------- THE WORK ----------------------- */}
        <section className="section" aria-labelledby="work-heading">
          <div className="shell">
            <div className="band-head">
              <h2 id="work-heading" className="band-title">The work Ciatta does</h2>
              <p className="band-sub">
                Four steps, in the order they happen, every day it runs.
              </p>
            </div>

            <ol className="hiw-steps">
              {STEPS.map(([title, body, note], i) => (
                <li key={title}>
                  <span className="hiw-n">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <p className="hiw-note">{note}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------- WHAT IT READS -------------------- */}
        <section className="section" aria-labelledby="parts-heading">
          <div className="shell">
            <div className="band-head">
              <h2 id="parts-heading" className="band-title">What Ciatta reads</h2>
              <p className="band-sub">
                Eight parts of one record. Any of them can be missing, and
                Ciatta says which rather than filling the gap.
              </p>
            </div>

            <ul className="hiw-parts">
              {PARTS.map(([name, what]) => (
                <li key={name}>
                  <h3>{name}</h3>
                  <p>{what}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --------------------------- ONE CHANGE, OPENED ----------------- */}
        <section className="section hiw-deep" aria-labelledby="deep-heading">
          <div className="shell">
            <div className="band-head">
              <h2 id="deep-heading" className="band-title">One change, read in five stages</h2>
              <p className="band-sub">
                This is a night of sleep. It is the same five stages for a lab
                result, a symptom or a dose change.
              </p>
            </div>

            <div className="hiw-deep-body">
              <ol className="hiw-stages">
                {STAGES.map(([n, title, body]) => (
                  <li key={n}>
                    <span className="hiw-n">{n}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </li>
                ))}
              </ol>

              <div className="hiw-devices">
                <div className="product hiw-device">
                  <TodayScreen />
                </div>
                <div className="product hiw-device is-second">
                  <ExperimentScreen />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------ THE DAY ------------------------- */}
        <section className="section" aria-labelledby="day-heading">
          <div className="shell">
            <div className="band-head">
              <h2 id="day-heading" className="band-title">A day, drawn as a day</h2>
              <p className="band-sub">
                The night you slept, the energy you reported and the pain you
                logged, on one 24-hour frame rather than three charts.
              </p>
            </div>

            <div className="product hiw-day">
              <DayChart />
            </div>
          </div>
        </section>

        {/* --------------------------- FIRST 30 DAYS ---------------------- */}
        <section className="section" aria-labelledby="days-heading">
          <div className="shell">
            <div className="band-head">
              <h2 id="days-heading" className="band-title">What to expect in your first 30 days</h2>
              <p className="band-sub">
                Ciatta is more useful in month six than in week one, and it does
                not pretend otherwise.
              </p>
            </div>

            <ol className="hiw-days">
              {DAYS.map(([when, title, body]) => (
                <li key={when}>
                  <span className="hiw-when">{when}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------- CTA --------------------------- */}
        <section className="section" aria-labelledby="hiw-cta">
          <div className="shell split is-centred">
            <div className="split-lead close-inner">
              <h2 id="hiw-cta" className="display">
                See what’s changing.{' '}
                <span className="close-second">Know what happened around it.</span>
              </h2>
              <p className="close-lines">
                Ciatta opens to a small group first. Reserve a place and you
                will get one email when it does.
              </p>
            </div>
            <div className="split-body">
              <div className="surface is-shell is-lifted" id="join">
                <SubscribeForm
                  id="waitlist-how"
                  source="closing"
                  kind="waitlist"
                  note=""
                  consent="I agree to receive emails about early access and product updates."
                />
              </div>
              <p className="close-disclaimer">
                Ciatta provides health information, observations, and
                recommendations for exploration. It does not diagnose or replace
                medical care.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer shell">
        <span className="sr-only">Ciatta</span>
        <Wordmark size="sm" />
        <nav className="footer-nav" aria-label="Footer">
          <a href="/">Home</a>
          <a href="/how-it-works/" aria-current="page">How it works</a>
          <a href="/briefs/">Briefs</a>
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
        </nav>
        <span className="footer-copy">© 2026 Ciatta</span>
      </footer>
    </>
  );
}

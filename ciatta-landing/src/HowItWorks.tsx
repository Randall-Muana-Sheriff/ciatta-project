import { SiteHeader } from './components/SiteHeader';
import { ExploreSection } from './components/ExploreSection';
import { Film } from './components/Film';
import { Phone } from './components/PhoneChrome';
import { Finding, Module, Rows, type Item } from './components/Module';
import { TodayScreen } from './components/TodayScreen';
import { CookieBanner } from './components/CookieBanner';
import { SiteFooter } from './components/SiteFooter';

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

/* -- one per item ---------------------------------------------------------- */

const DayScreen = () => <Phone className="is-today"><TodayScreen /></Phone>;

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

/* -- the loop, five stages ------------------------------------------------ *
 * The same five words the home page uses, in the same order: Connect, See,
 * Act, Learn, Prepare. The page used to open on "Your day, read in five
 * stages" — what changed, what was around it, what may be connected, what you
 * could do, what happened next — which is the same work described from the
 * inside, as a pipeline. Named from the outside it is the loop, and the home
 * page and this page now say one thing rather than two versions of it.
 *
 * A second module followed it, "Everything else it reads, and keeps", four
 * items on cycles, results, her own words and the brief. The record tour that
 * moved here from the home page covers all four with more of each, so the
 * module has gone rather than being said twice on one page.                  */

const LOOP: Item[] = [
  { n: '01', title: 'Connect',
    body: 'A wearable, a portal, the documents your provider sent, and what you write yourself. Ciatta reads what is there and says plainly what it cannot see yet.',
    Screen: StartScreen },
  { n: '02', title: 'See',
    body: 'Sleep came in at 6h 46m, 48 minutes under your usual, in a week when work demands were higher, fatigue was reported three times and bedtime was later on four nights. The day is drawn as one frame rather than three charts. Where Ciatta says two things may be connected it shows what that is based on, and says plainly that a connection is not a cause.',
    Screen: DayScreen },
  { n: '03', title: 'Act',
    body: 'Something to try, or something to raise, each one carrying the pattern it came from: wind down by 10:30 because your last three nights began after 11:40, not because earlier nights are generally better.',
    Screen: TryScreen },
  { n: '04', title: 'Learn',
    body: 'Seven nights later, sleep returned closer to your usual on five of them. Ciatta keeps that result and reads the next change against it.',
    Screen: NextScreen },
  { n: '05', title: 'Prepare',
    body: 'One page for an appointment: what changed, what was happening around it, what you tried, what happened next, and the questions worth asking. Take it, print it, or share it.',
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
          kind="The loop"
          title="Connect, See, Act, Learn, Prepare"
          lede="This one runs on a night of sleep. It is the same five stages for a lab result, a symptom or a dose change."
          items={LOOP}
        />

        {/* The whole record, layer by layer. It was on the home page, where it
            asked a first-time visitor to work through nine tabs before she had
            been given a reason to. It belongs here, on the page someone opens
            because they want the detail. */}
        <ExploreSection />

        <Module
          id="start-heading"
          kind="Getting started"
          title="What to expect in your first 30 days"
          lede="Ciatta is more useful in month six than in week one, and it does not pretend otherwise."
          items={DAYS}
        />

      </main>

      <SiteFooter />
      <CookieBanner />
    </div>
  );
}

import { useState } from 'react';
import { SiteHeader } from './components/SiteHeader';
import { SubscribeForm } from './components/SubscribeForm';
import { Wordmark } from './components/Wordmark';
import { Film } from './components/Film';
import {
  BriefScreen, ChangeScreen, CycleScreen, ExperimentScreen, LabScreen, TodayScreen, ToldScreen,
} from './components/ProductShowcase';

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

/* -- the four steps, across the top --------------------------------------- */

const STEPS: [string, string][] = [
  ['Bring it together',
   'Connect an app or wearable, import from a portal, upload the documents your provider sends, and add what only you can say.'],
  ['Read it in order',
   'Ciatta reads along a timeline rather than as dashboards, so a change is read against your own usual.'],
  ['See what sits beside it',
   'Every change is read beside the week it happened in: your cycle, your care, your workload, your words.'],
  ['Decide, and see what happened',
   'Try one thing, keep the result, and take one page to your next appointment.'],
];

/* -- the day, five stages ------------------------------------------------- */

const DAY: Item[] = [
  { n: '01', title: 'What changed',
    body: 'Sleep came in at 6h 46m, 48 minutes under your usual. Ciatta says what your usual is rather than assuming eight hours, and it says when the figure was measured and by what.',
    Screen: ChangeScreen },
  { n: '02', title: 'What happened around it',
    body: 'Work demands were higher. Fatigue was reported three times. Your cycle changed phase. Bedtime was later on four nights. The day is drawn as one frame, not three charts.',
    Screen: TodayScreen },
  { n: '03', title: 'What may be connected',
    body: 'Afternoon pain has been higher after nights under seven hours, seen three times this month. Ciatta shows what the observation is based on, and says plainly that a connection is not a cause.',
    Screen: TodayScreen },
  { n: '04', title: 'What you could do',
    body: 'Two things drawn from your own record, each carrying the pattern that produced it: wind down by 10:30 because your last three nights began after 11:40, not because earlier nights are generally better.',
    Screen: ExperimentScreen },
  { n: '05', title: 'What happened next',
    body: 'Seven nights later, sleep returned closer to your usual on five of them. Ciatta keeps that result and reads the next change against it.',
    Screen: ExperimentScreen },
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
    Screen: TodayScreen },
  { n: 'Weeks 2 to 4', title: 'The first observations',
    body: 'Ciatta waits until it has seen something more than once before it calls it anything. When it does, it shows the working, and it says how thin the evidence still is.',
    Screen: ExperimentScreen },
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
            <div className="product hw2-device">
              <Screen />
            </div>
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

        {/* ------------------------- THE WORK, AS A ROW -------------------- */}
        <section className="section hw2-steps-band" aria-labelledby="work-heading">
          <div className="shell">
            <div className="band-head">
              <h2 id="work-heading" className="band-title">The work Ciatta does</h2>
              <p className="band-sub">Four steps, in the order they happen, every day it runs.</p>
            </div>

            <ol className="hw2-steps">
              {STEPS.map(([title, body], i) => (
                <li key={title}>
                  <span className="hw2-n">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
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
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Use</a>
        </nav>
        <span className="footer-copy">© 2026 Ciatta</span>
      </footer>
    </div>
  );
}

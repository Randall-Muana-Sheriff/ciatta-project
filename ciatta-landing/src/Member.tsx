import { Wordmark } from './components/Wordmark';
import { SubscribeForm } from './components/SubscribeForm';
import { Film } from './components/Film';

/**
 * Ciatta membership.
 *
 * Paced after Oura's membership page, which sells one membership rather than
 * three tiers and moves in a steady rhythm: an editorial statement, then the
 * product doing the thing the statement claimed, then proof, then the
 * practical detail, then the ask. Nothing is explained twice and no section
 * carries two ideas.
 *
 * What it is about is Ciatta's. The argument is that a record compounds: the
 * first week of anything is thin, and the same reading across a year of
 * cycles, labs, treatments and notes is not. So the page is built to make
 * one thing felt — that joining is access to a system that keeps building a
 * connected picture, not a download of an app.
 *
 * Two things this page must not fake, and does not. There is one tier and no
 * price, so it says the price is unset rather than inventing one; and Care
 * and the agents are ahead of Core, so they are marked as what follows
 * rather than as what opens.
 */

/* -- 05 · the record as it thickens ---------------------------------------- */

const TIMELINE: [string, string, string][] = [
  ['Oct', 'Symptoms', 'Pain reported more often'],
  ['Nov', 'Lab', 'Ferritin 32'],
  ['Jan', 'Medication', 'Levothyroxine started'],
  ['Feb', 'Cycle', 'Shortened to 27 days'],
  ['Feb', 'Treatment', 'Dose changed'],
  ['Mar', 'Surgery', 'Laparoscopy'],
  ['Apr', 'Recovery', 'Symptom days fell'],
  ['Now', 'What happened next', 'Sleep closer to her usual'],
];

/* -- 07 · Ciatta Care ------------------------------------------------------- */

const CARE: [string, string][] = [
  ['Appointment preparation', 'What changed since the last visit, and what you meant to raise and forgot.'],
  ['Clinician message drafting', 'What you want to ask, written as a message you can change and send yourself.'],
  ['Question preparation', 'The questions worth asking, each drawn from something in your record.'],
  ['Record organization', 'Results, documents and notes filed against the date they belong to.'],
  ['Referrals', 'What was referred, to whom, and whether it has happened.'],
  ['Follow-up tracking', 'What was said would happen next, and whether it has.'],
  ['Insurance navigation', 'What your cover requires before a thing can happen, in order.'],
  ['Appointment coordination', 'Finding a time that works, and holding the thread until it is booked.'],
];

/* -- 08 · what Ciatta will be able to do, with permission ------------------ */

const AGENTIC: string[] = [
  'Help find appointments',
  'Coordinate referrals',
  'Navigate insurance requirements',
  'Prepare communications',
  'Organize records',
  'Track what needs to happen next',
];

/* -- 10 · what membership opens with --------------------------------------- */

const INCLUDED: string[] = [
  'Your connected health record',
  'Your data organised and kept in order',
  'Longitudinal trends across months and years',
  'Personalized insights from your own record',
  'The context around every change',
  'Evidence you can explore for yourself',
  'Health Briefs for your appointments',
  'Preparation for clinician conversations',
  'Ciatta Care, as it arrives',
];

/* -- 11 · the questions people ask first ----------------------------------- */

const QUESTIONS: [string, string][] = [
  ['What is Ciatta membership?',
   'Access to a system rather than a download. Your record is kept in one place, read along a timeline, and returned to you as what changed and what to do next. It is more useful in month six than in week one, and it is built on that basis.'],
  ['What is included?',
   'The connected record, the trends across time, the insights drawn from your own history, the Health Briefs you take to appointments, and Ciatta Care as its capabilities arrive.'],
  ['What is Ciatta Care?',
   'The part of membership that acts on your record rather than only keeping it. It follows Core rather than opening with it.'],
  ['Can Ciatta take actions for me?',
   'In time, and only what you authorize. Each connection is made by you and can be withdrawn by you, and Ciatta keeps a record of everything done in your name. It does not enter payment details, and it does not make clinical decisions.'],
  ['When does membership begin?',
   'When Ciatta opens. Joining now reserves your place, and nothing begins, or is billed, before then.'],
  ['What does it cost?',
   'Not set yet. You will see the price before anything is charged, with the choice to stop there. No card is taken today.'],
];

export default function Member() {
  return (
    <>
      <a className="skip" href="#member-main">Skip to the form</a>

      <header className="m-top">
        <a className="m-mark" href="/" aria-label="Ciatta, home">
          <Wordmark size="sm" />
        </a>
        <a className="m-top-link" href="/">Back to Ciatta</a>
      </header>

      <main id="member-main" className="member">
        {/* ============ 01 · the hero ==================================== */}
        <section className="m-hero is-member">
          <Film base="member" className="m-hero-film" scrim="m-hero-scrim" width={1080} height={1920} />
          <div className="m-hero-inner">
            <span className="m-eyebrow">Membership</span>
            <h1 className="m-hero-title">Your health, continuously connected.</h1>
            <p className="m-hero-lede">
              Your records, your symptoms, your treatments, your everyday
              context and your own words, read together over time.
            </p>
            <a className="m-btn is-light" href="#join">Reserve your place</a>
            <p className="m-hero-note">
              <span>No card</span> <span>&middot; Nothing charged</span>
            </p>
          </div>
        </section>

        {/* ============ 02 · the whole argument for membership ========== */}
        <section className="m-band mb-say" aria-labelledby="why-heading">
          <div className="m-wrap">
            <h2 id="why-heading" className="mb-say-line">
              A record is not the product.
              <span> What it becomes is.</span>
            </h2>
            <p className="mb-say-sub">
              Six months is not six months of data. It is the reason a change
              in April can be read against a dose change in January. That is
              worth little on your first day and a great deal by your second
              year, which is why Ciatta is a membership and not a download.
            </p>

            <ol className="mb-time">
              {TIMELINE.map(([when, kind, what]) => (
                <li key={when + kind}>
                  <span className="mb-time-when">{when}</span>
                  <b>{kind}</b>
                  <span className="mb-time-what">{what}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============ 08 · Ciatta Care ================================= */}
        <section className="m-band" aria-labelledby="care-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Ciatta Care</span>
              <h2 className="m-h2" id="care-heading">Healthcare doesn’t end when you close the app.</h2>
              <p className="m-h2-sub">
                The work around an appointment that currently falls to you. It
                follows Core rather than opening with it.
              </p>
            </div>

            <dl className="mb-care">
              {CARE.map(([name, line]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{line}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ============ 09 · what comes after ============================ */}
        <section className="m-band is-alt" aria-labelledby="agentic-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Ahead of us</span>
              <h2 className="m-h2" id="agentic-heading">
                You tell Ciatta what you need. Ciatta helps move it forward.
              </h2>
              <p className="m-h2-sub">
                In time, and only where you authorize it, Ciatta will act
                rather than only prepare. None of this is available today.
              </p>
            </div>

            <ul className="mb-agentic">
              {AGENTIC.map((a) => <li key={a}>{a}</li>)}
            </ul>

            <p className="mb-note">
              You connect each source and can disconnect it. Ciatta says what
              it is about to do before it does it, and keeps a record of
              everything done in your name. It never enters payment details,
              and it never decides anything clinical.
            </p>
          </div>
        </section>

        {/* ============ 11 · membership ================================== */}
        <section className="m-band is-alt" aria-labelledby="plan-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Membership</span>
              <h2 className="m-h2" id="plan-heading">Where membership starts</h2>
              <p className="m-h2-sub">
                One membership. What Ciatta can do will grow, and it will grow
                inside this one.
              </p>
            </div>

            <div className="m-plan">
              <div className="m-plan-head">
                <span className="m-plan-name">Ciatta Core</span>
                <p className="m-plan-price">Price coming soon</p>
                <p className="m-plan-price-note">
                  You will see the price before anything is charged.
                </p>
                <a className="m-btn" href="#join">Reserve your place</a>
                <p className="m-plan-foot">Reserving a place is free</p>
              </div>
              <ul className="m-ticks">
                {INCLUDED.map((line) => (
                  <li key={line}><i aria-hidden="true" /><span>{line}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============ 12 · questions =================================== */}
        <section className="m-band" aria-labelledby="q-heading">
          <div className="m-wrap split">
            <div className="split-lead">
              <h2 className="m-h2" id="q-heading">Questions</h2>
            </div>
            <div className="m-faq split-body">
              {QUESTIONS.map(([q, a]) => (
                <details className="qa-item" key={q}>
                  <summary><span>{q}</span><i aria-hidden="true" /></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============ 13 · the ask ===================================== */}
        <section className="m-free m-dark" id="join" aria-labelledby="join-heading">
          <div className="m-wrap split is-centred">
            <div className="split-lead">
              <h2 className="m-free-title" id="join-heading">
                Your health story is always changing.
              </h2>
              <p className="m-free-sub">Ciatta helps you keep up with it.</p>
            </div>
            <div className="split-body">
              <SubscribeForm id="waitlist-member" source="member" kind="waitlist" offerBriefs cta="Reserve your place" note="" />
              <p className="m-free-note">
                No card. Nothing charged. You will see the price before
                anything is charged.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="m-foot">
        <div className="m-wrap">
          <nav aria-label="Footer">
            <a href="/">Home</a>
            <a href="/how-it-works/">How it works</a>
            <a href="/briefs/">Briefs</a>
            <a href="/privacy/">Privacy</a>
            <a href="/terms/">Terms</a>
          </nav>
          <span>&copy; {new Date().getFullYear()} Ciatta</span>
        </div>
      </footer>
    </>
  );
}

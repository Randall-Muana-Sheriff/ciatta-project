import { Wordmark } from './components/Wordmark';
import { SubscribeForm } from './components/SubscribeForm';
import { Film } from './components/Film';
import { HeroStory } from './components/HeroStory';
import { Phone } from './components/PhoneChrome';
import { TodayScreen } from './components/TodayScreen';

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

/* -- 03 · everything the record holds -------------------------------------- *
 * Said as domains rather than drawn as a dashboard: this is the scope of the
 * thing, and a grid of tiles would turn scope into features.                 */

const DOMAINS: [string, string[]][] = [
  ['From your clinicians',
   ['Medical records', 'Lab results', 'Medications', 'Treatments', 'Surgery and procedures']],
  ['From your body',
   ['Symptoms', 'Cycle', 'Sleep', 'Activity', 'Wearable data', 'Nutrition', 'Gut health']],
  ['From your life',
   ['Everyday context', 'Mental and cognitive health', 'Your own words']],
];

/* -- 04 · what reading them together can show ------------------------------ */

const PAIRS: [string, string][] = [
  ['Sleep × symptoms', 'Afternoon pain has been higher following nights under seven hours.'],
  ['Cycle × symptoms', 'Abdominal symptoms were reported more often in the same phase, across three cycles.'],
  ['Labs × symptoms', 'Ferritin fell across three results in the period fatigue was reported most.'],
  ['Treatment × symptoms', 'Symptom days changed after a dose change, and kept changing for six weeks.'],
  ['Surgery × recovery', 'Symptom days fell in the months after the procedure, against her own baseline.'],
  ['Nutrition × gut health', 'Reported discomfort clustered on days with a late, heavy evening meal.'],
];

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

/* -- 06 · the page she takes to an appointment ----------------------------- */

const BRIEF: [string, string[]][] = [
  ['What changed', [
    'Symptom days rose from 4 to 11 a month across 6 weeks.',
    'Sleep fell to 6h 46m, 48 minutes under her usual.',
  ]],
  ['What was happening around it', [
    'Levothyroxine increased from 50 to 75 mcg on 3 Mar.',
    'Cycle shortened from 29 to 26 days across 4 cycles.',
    'Ferritin 32 on 12 Aug, 24 on 14 Mar, 18 on 2 Sep. Range 15 to 150.',
  ]],
  ['What you tried', [
    'A 7-day sleep experiment from 10 Mar, with an earlier wind-down on 5 of 7 nights.',
  ]],
  ['What happened next', [
    'Sleep returned closer to your usual on 5 of 7 nights. Fatigue was reported less often.',
  ]],
];

const BRIEF_ASKS: string[] = [
  'Could the cycle shortening and the sleep change be worth evaluating together?',
  'Is the ferritin trend worth repeating, given the heavier bleeding in the same period?',
  'Should the dose change on 3 Mar be reviewed against the symptoms recorded since?',
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

/* -- 09 · what Ciatta shows about its own working -------------------------- */

const TRUST: [string, string][] = [
  ['Where it came from', 'Measured, imported, uploaded, or told to Ciatta by you.'],
  ['When it happened', 'Every figure carries its date, its unit, and its range.'],
  ['What surrounded it', 'The week a change happened in, not the change alone.'],
  ['What supports it', 'The evidence an observation rests on, and how thin it still is.'],
  ['What is uncertain', 'Things that move together are not necessarily one causing the other.'],
  ['What Ciatta did', 'A record of every action taken in your name, and by whose permission.'],
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
   'Access to a system rather than a download. Your record is brought into one place and kept there, read along a timeline, and returned to you as what changed, what was happening around it, what may be connected, and what you might do next. It is more useful in month six than in week one, and it is built on that basis.'],
  ['What is included?',
   'The connected record, the organisation of it, the trends across time, the insights drawn from your own history, the evidence behind them, the Health Briefs you take to appointments, and Ciatta Care as its capabilities arrive.'],
  ['Can Ciatta analyze my labs?',
   'It reads the values out of the document your provider sent and keeps each one beside every other time it was measured, with its unit, its range, its date and who sent it. It shows you the trend. It does not tell you what a result means clinically.'],
  ['Do I need a wearable?',
   'No. A wearable adds nightly sleep and cycle data if you already have one. Without it, Ciatta works from what you enter, what you upload, and what your providers send.'],
  ['Does Ciatta diagnose?',
   'No. Ciatta describes what is in your record and what moved close to what. Naming a condition is a clinician’s job, and Ciatta does not do it, suggest it, or hint at it. It does not prescribe, and it does not replace your clinician.'],
  ['How does Ciatta use my data?',
   'To build your record and read it for you. Data is encrypted in transit and at rest, access is audited, and we will never sell, rent, or share it with advertisers, brokers, or insurers. You can export everything, and if you delete your account we delete every byte.'],
  ['What is Ciatta Care?',
   'The part of membership that acts on your record rather than only keeping it: preparing you for a visit, drafting the message you meant to send, organising the record, and tracking what was supposed to happen next. It follows Core rather than opening with it.'],
  ['Can Ciatta take actions for me?',
   'In time, and only what you authorize. Each connection is made by you and can be withdrawn by you, Ciatta says what it is about to do and on whose behalf before it does it, and it keeps a record of everything done in your name. It does not enter payment details, and it does not make clinical decisions.'],
  ['When does membership begin?',
   'When Ciatta opens. Joining now reserves your place in the order people are let in, and nothing begins, or is billed, before then.'],
  ['What does it cost?',
   'Not set yet. You will be told what membership costs before anything is charged, with the choice to stop there. No card is taken today.'],
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
              Ciatta brings your health data, medical records, symptoms,
              treatments, everyday context and your own words together, so you
              can see what is changing and what to do next.
            </p>
            <a className="m-btn is-light" href="#join">Reserve your place</a>
            <p className="m-hero-note">
              <span>No card</span> <span>&middot; Nothing charged</span>
            </p>
          </div>
        </section>

        {/* ============ 02 · why membership ============================== */}
        <section className="m-band mb-say" aria-labelledby="why-heading">
          <div className="m-wrap">
            <h2 id="why-heading" className="mb-say-line">
              A record is not the product.
              <span> What it becomes is.</span>
            </h2>
            <p className="mb-say-sub">
              Anything can store your health information. Ciatta reads it
              along a timeline, against your own usual, beside the week it
              happened in. That is worth little on your first day and a great
              deal by your second year, which is why it is a membership and
              not a download.
            </p>
          </div>
        </section>

        {/* ============ 03 · the product, running ======================== */}
        <section className="m-band is-alt" aria-labelledby="see-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">The Today screen</span>
              <h2 className="m-h2" id="see-heading">Watch a day come together</h2>
              <p className="m-h2-sub">
                A ring, a portal, the document your provider sent, a sentence
                only you can write, a photograph of lunch. They arrive
                separately and are read together.
              </p>
            </div>
            <div className="mb-stage">
              <HeroStory />
            </div>
          </div>
        </section>

        {/* ============ 04 · the connected record ======================== */}
        <section className="m-band" aria-labelledby="record-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">The connected record</span>
              <h2 className="m-h2" id="record-heading">Your health doesn’t happen in pieces.</h2>
              <p className="m-h2-sub">
                It happens in a portal, an app, a wearable, a drawer, and your
                own head. Membership is what puts all of it in one order.
              </p>
            </div>

            <div className="mb-domains">
              {DOMAINS.map(([group, items]) => (
                <div className="mb-domain" key={group}>
                  <h3>{group}</h3>
                  <ul>
                    {items.map((i) => <li key={i}>{i}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <figure className="mb-figure">
              <img src="/images/who/reads.jpg" alt="A woman in an infinity pool, facing an open sea."
                   width={1440} height={900} loading="lazy" decoding="async" />
            </figure>
          </div>
        </section>

        {/* ============ 05 · personalized intelligence =================== */}
        <section className="m-band is-alt" aria-labelledby="pairs-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Personalized insight</span>
              <h2 className="m-h2" id="pairs-heading">Ciatta reads across, not down.</h2>
              <p className="m-h2-sub">
                One measurement on its own is a number. Read beside everything
                else in the same weeks, it becomes something you can ask
                about.
              </p>
            </div>

            <ul className="mb-pairs">
              {PAIRS.map(([pair, line]) => (
                <li key={pair}>
                  <b>{pair}</b>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p className="mb-note">
              These are possible relationships, not diagnoses. Things that
              move together are not necessarily one causing the other, and
              Ciatta says so on the observation itself.
            </p>
          </div>
        </section>

        {/* ============ 06 · the longitudinal case ======================= */}
        <section className="m-band" aria-labelledby="time-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Over time</span>
              <h2 className="m-h2" id="time-heading">Ciatta remembers, so you don’t have to.</h2>
              <p className="m-h2-sub">
                Six months is not six months of data. It is the reason a
                change in April can be read against a dose change in January.
              </p>
            </div>

            <ol className="mb-time">
              {TIMELINE.map(([when, kind, what]) => (
                <li key={when + kind}>
                  <span className="mb-time-when">{when}</span>
                  <b>{kind}</b>
                  <span className="mb-time-what">{what}</span>
                </li>
              ))}
            </ol>

            <p className="mb-note">
              The longer you use Ciatta, the more your record can say. This is
              the part a new account cannot give you, and the reason to start
              one.
            </p>
          </div>
        </section>

        {/* ============ 07 · the health brief ============================ */}
        <section className="m-band is-alt" aria-labelledby="brief-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Health Briefs</span>
              <h2 className="m-h2" id="brief-heading">Walk into every appointment prepared.</h2>
              <p className="m-h2-sub">
                Six months as one page, and three questions worth asking.
                Yours to take, print, or ignore.
              </p>
            </div>

            <div className="mb-brief-row">
              <article className="mb-brief" aria-label="An example health brief">
                <header>
                  <img src="/images/icon.svg" alt="" width={44} height={44} />
                  <div>
                    <h3>Health brief</h3>
                    <p>Maya R. · 1 Oct to 1 Apr · prepared today</p>
                  </div>
                </header>
                <dl>
                  {BRIEF.map(([label, lines]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{lines.map((l) => <p key={l}>{l}</p>)}</dd>
                    </div>
                  ))}
                </dl>
                <section aria-label="Questions to discuss">
                  <h4>Questions to discuss</h4>
                  <ol>{BRIEF_ASKS.map((q) => <li key={q}>{q}</li>)}</ol>
                </section>
                <footer>
                  <span>Measured · imported · uploaded · told by Maya</span>
                  <span>Ciatta does not diagnose or replace medical care.</span>
                </footer>
              </article>

              <div className="mb-brief-phone">
                <Phone className="is-today">
                  <TodayScreen />
                </Phone>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 08 · Ciatta Care ================================= */}
        <section className="m-band" aria-labelledby="care-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Ciatta Care</span>
              <h2 className="m-h2" id="care-heading">Healthcare doesn’t end when you close the app.</h2>
              <p className="m-h2-sub">
                Care is the next layer of the same membership: the work around
                an appointment that currently falls to you. It follows Core
                rather than opening with it.
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
                In time, and only where you authorize it, Ciatta will be able
                to act rather than only prepare. None of this is available
                today, and none of it happens without you.
              </p>
            </div>

            <ul className="mb-agentic">
              {AGENTIC.map((a) => <li key={a}>{a}</li>)}
            </ul>

            <p className="mb-note">
              You connect each source and can disconnect it. Ciatta says what
              it is about to do and on whose behalf before it does it, and
              keeps a record of everything done in your name. It never enters
              payment details, and it never decides anything clinical.
            </p>
          </div>
        </section>

        {/* ============ 10 · trust ======================================= */}
        <section className="m-band" aria-labelledby="trust-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Your record</span>
              <h2 className="m-h2" id="trust-heading">Your health. Your record. Your decisions.</h2>
              <p className="m-h2-sub">
                Ciatta shows its working, because an observation you cannot
                check is not worth having.
              </p>
            </div>

            <ul className="mb-trust">
              {TRUST.map(([name, line]) => (
                <li key={name}>
                  <h3>{name}</h3>
                  <p>{line}</p>
                </li>
              ))}
            </ul>

            <p className="mb-note">
              Encrypted in transit and at rest. Never sold, rented, or shared
              with advertisers, brokers, or insurers. Export everything at any
              time. The{' '}
              <a href="/privacy/">privacy notice</a> and{' '}
              <a href="/terms/">terms</a> are the binding versions.
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
                One membership, and it opens for members first. What Ciatta
                can do will grow, and it will grow inside this one.
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

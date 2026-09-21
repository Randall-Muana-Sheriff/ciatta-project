import { Wordmark } from './components/Wordmark';
import { SubscribeForm } from './components/SubscribeForm';
import { Film } from './components/Film';
import { ReservedNotice } from './components/ReserveButton';
import { MembershipCard } from './components/MembershipCard';
import { CookieBanner, CookieChoicesLink } from './components/CookieBanner';

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

/* -- Ciatta Care, in four movements ---------------------------------------- *
 * Eight separate capabilities read as a feature list and said the same thing
 * four times. These are the four things Care actually does, in the order a
 * visit happens.                                                            */

const CARE: [string, string][] = [
  ['Prepare for care',
   'What changed, what is relevant, and what you want to discuss.'],
  ['Communicate',
   'Draft messages and questions from your actual health record.'],
  ['Coordinate care',
   'Manage referrals, appointments, and the steps between visits.'],
  ['Navigate healthcare',
   'Help organise insurance requirements, records, and what needs to happen next.'],
];

/* -- the questions a page that asks for money has to answer ---------------- */

const QUESTIONS: [string, string][] = [
  ['What is Ciatta membership?',
   'Access to a system rather than a download. Your record is kept in one place, read along a timeline, and returned to you as what changed and what to do next. It is more useful in month six than in week one, and it is built on that basis.'],
  ['What is included in Ciatta Core?',
   'Your health in one place, what is changing in it, what may be connected, insights drawn from your own history, preparation for your appointments, and a record that keeps getting richer. Ciatta Care is included as its capabilities arrive.'],
  ['What is Ciatta Care?',
   'The part of membership that acts on your record rather than only keeping it: preparing you for a visit, drafting what you meant to send, coordinating referrals and appointments, and keeping track of what needs to happen next.'],
  ['Can Ciatta take actions for me?',
   'In time, and only what you authorize. Ciatta tells you what it is about to do, asks when your approval is needed, and keeps a record of everything done on your behalf. It does not enter payment details, and it does not make clinical decisions.'],
  ['Does Ciatta diagnose or replace my clinician?',
   'No. Ciatta describes what is in your record and what moved close to what. Naming a condition is a clinician\u2019s job, and Ciatta does not do it, suggest it, or hint at it. What it prepares is yours to take to your clinician or to ignore.'],
  ['How does Ciatta use my health data?',
   'To build your record and read it for you. It is encrypted in transit and at rest, access is audited, and we will never sell, rent, or share it with advertisers, brokers, or insurers. You can export everything, and if you delete your account we delete every byte.'],
  ['When does membership begin?',
   'When Ciatta opens, which we are building towards for Quarter 3 of 2027. Reserving now holds your place, and nothing begins, or is billed, before then. If the date moves we will tell you.'],
  ['Can I cancel?',
   'At any time, and you keep your record: export everything before you go, or delete it outright. Cancelling stops the next payment rather than ending your access that day.'],
  ['What does it cost?',
   '$9.99 a month, from the day you choose to begin. Nothing is charged today, and nothing is charged before Ciatta opens in 2027.'],
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
              <span>$9.99 a month</span> <span>&middot; No card today</span>{' '}
              <span>&middot; Nothing charged until it opens</span>
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
              Your health becomes more useful in context. A change in April
              means more when Ciatta remembers what happened in January,
              February and March. The longer you use it, the richer your
              health record becomes.
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

        {/* ============ 03 · Ciatta Care, and what it will grow into ==== */}
        <section className="m-band is-alt" aria-labelledby="care-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Ciatta Care</span>
              <h2 className="m-h2" id="care-heading">Healthcare doesn’t end when you close the app.</h2>
              <p className="m-h2-sub">
                The work around an appointment that currently falls to you.
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

            {/* The roadmap used to be a section of its own, listing the same
                four things again under different verbs. It is a paragraph. */}
            <p className="mb-note">
              Ciatta Care evolves inside your membership. As Ciatta becomes
              more capable, you will be able to authorize it to take care of
              more of this work for you. It will always tell you what it is
              about to do, ask when your approval is needed, and keep a record
              of what it does on your behalf.
            </p>
          </div>
        </section>

        {/* ============ 04 · membership ================================= */}
        <MembershipCard />

        <div className="m-band">
          <div className="m-wrap">
            <p className="mb-note is-mid">
              Ciatta Care and future agent capabilities evolve within your
              membership.
            </p>
          </div>
        </div>

        {/* ============ 05 · permission, and privacy ===================== */}
        <section className="m-band is-alt mb-trustline" aria-labelledby="control-heading">
          <div className="m-wrap">
            <h2 className="m-h2" id="control-heading">Your health. Your record. Your decisions.</h2>
            <p className="m-h2-sub">
              Nothing happens without your permission, and Ciatta shows where
              every figure came from. Your record is encrypted, never sold or
              shared, exportable at any time, and deleted in full if you ask.
              The <a href="/privacy/">Privacy Policy</a> and{' '}
              <a href="/terms/">Terms of Use</a>
          <CookieChoicesLink /> are the binding versions.
            </p>
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
              <ReservedNotice />
              <SubscribeForm id="waitlist-member" source="member" kind="waitlist" offerBriefs cta="Reserve your place" note="" />
              <p className="m-free-note">
                No card today. Nothing is charged until Ciatta opens and you
                choose to begin.
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
            <a href="/privacy/">Privacy Policy</a>
            <a href="/terms/">Terms of Use</a>
          </nav>
          <span>&copy; {new Date().getFullYear()} Ciatta</span>
        </div>
      </footer>
      <CookieBanner />
    </>
  );
}

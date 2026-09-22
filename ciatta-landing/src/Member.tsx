import { Wordmark } from './components/Wordmark';
import { SubscribeForm } from './components/SubscribeForm';
import { Film } from './components/Film';
import { ReservedNotice } from './components/ReserveButton';
import { MembershipCard } from './components/MembershipCard';
import { CookieBanner } from './components/CookieBanner';
import { SiteFooter } from './components/SiteFooter';

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

/* Six, as on the home page.

   Ten was five questions asked twice: what membership is and what is in it;
   what Care is and whether it can act; what reserving does and when
   membership begins; what it costs and whether you can cancel. Each pair is
   one question now, answered once and properly.

   These are the membership questions. The home page answers the product
   ones — what Ciatta does, how it decides two things may be connected,
   whether a wearable is needed — and neither page repeats the other. */
const QUESTIONS: [string, string][] = [
  ['What is Ciatta membership, and what does Core include?',
   'Access to a system rather than a download. Your record is kept in one place, read along a timeline, and returned to you as what changed and what to do next: your health in one place, what is changing in it, what may be connected, insights drawn from your own history, preparation for your appointments, and a record that keeps getting richer. It is more useful in month six than in week one, and it is built on that basis.'],

  ['What is Ciatta Care, and can Ciatta act for me?',
   'Care is the part of membership that acts on your record rather than only keeping it: preparing you for a visit, drafting what you meant to send, coordinating referrals and appointments, and tracking what needs to happen next. It arrives as its capabilities do, and it acts only on what you authorize. Ciatta says what it is about to do, asks when your approval is needed, and keeps a record of everything done on your behalf. It does not enter payment details, and it does not make clinical decisions.'],

  ['Does Ciatta diagnose, or replace my clinician?',
   'No. Ciatta describes what is in your record and what moved close to what. Naming a condition is a clinician\u2019s job, and Ciatta does not do it, suggest it, or hint at it. What it prepares is yours to take to your clinician, or to ignore.'],

  ['How does Ciatta use my health data?',
   'To build your record and read it for you, and nothing else. It is encrypted in transit and at rest, access is audited, and we will never sell, rent, or share it with advertisers, brokers, or insurers. You can export everything at any time, and if you delete your account we delete every byte.'],

  ['What does it cost, and can I cancel?',
   'Ciatta Core is $99 for the year: one membership, one payment, and continuous access for the year rather than a subscription that starts over every thirty days. You can cancel at any time and keep your record: export everything before you go, or delete it outright. Cancelling stops the next annual payment rather than ending your access that day, and we email you before each renewal.'],

  ['What does reserving a place do, and when does membership begin?',
   'Reserving puts you on the early-access list, in the order people are let in, and it is free. Leave your address and no card is taken. Reserve with a card and it is saved against your place rather than billed, so membership can begin the day Ciatta opens, and you can remove it at any time before then. Either way you are not a member and not subscribed until you choose to begin. Membership begins when Ciatta opens, which we are building towards for Quarter 3 of 2027. Nothing is billed before then, and if the date moves we will tell you.'],
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
            <span className="m-eyebrow">Reservations open</span>
            <h1 className="m-hero-title">Your health, continuously connected.</h1>
            <p className="m-hero-lede">
              Your records, your symptoms, your treatments, your everyday
              context and your own words, read together over time. Ciatta
              Core is $99 for the year when membership opens; reserving a
              place today is free.
            </p>
            <a className="m-btn is-light" href="#join">Reserve</a>
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
              <a href="/terms/">Terms of Use</a> are the binding versions.
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
              <SubscribeForm id="waitlist-member" source="member" kind="waitlist" offerBriefs cta="Reserve" note="" />
              <p className="m-free-note">
                <span>No card</span> <span>&middot; Nothing charged</span>{' '}
                <span>&middot; You are not subscribed to anything</span>
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <CookieBanner />
    </>
  );
}

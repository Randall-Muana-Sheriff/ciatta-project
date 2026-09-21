import { Wordmark } from './components/Wordmark';
import { SubscribeForm } from './components/SubscribeForm';
import { Film } from './components/Film';
import { AgentsSection } from './components/AgentsSection';

/**
 * Member — the page the "Become a member" button goes to.
 *
 * Structured after whoop.com/us/en/membership: a full-bleed film with the
 * membership named over it, then what the membership is, then the
 * "Start free, choose later" band, then the questions. WHOOP's
 * composition, not WHOOP's palette — this stays on Paper, and spends its one
 * dark band on the band that asks for the address.
 *
 * Two things WHOOP has that this page must not fake. WHOOP sells three named
 * tiers at three prices; Ciatta has one tier, Core, and no price yet, so the
 * plan section names the tier and says the price is unset rather than
 * inventing a number. Naming it Core is the point: it reads as the first of
 * several rather than as the whole of what Ciatta will ever sell, and the
 * questions say so outright. And WHOOP's "Start free" is a free trial of a
 * shipping product; Ciatta's is the literal truth that joining costs nothing
 * and the price is announced before anything is charged. There are no card
 * fields here and there should not be until there is something to charge for.
 */

/** What is in the membership. WHOOP's ticked inclusion list. */
const INCLUDED: string[] = [
  'See your health over time',
  'Discover patterns across your health',
  'Get personalized insights & recommendations',
  'Understand what may be relevant to you',
  'Explore research relevant to your questions',
  'Prepare for better clinician conversations',
  'Build a richer health picture over time',
];



/**
 * Ciatta Care: the part of the membership that does something with the record
 * rather than only keeping it. Each line is a piece of work a woman currently
 * does herself, in her own evenings, badly, because nobody gave her the six
 * months of her own history in one place first.
 */
const CARE: [string, string][] = [
  ['Visit preparation',
   'What changed since your last appointment, what sat beside it, and what you meant to raise and forgot.'],
  ['Health Brief generation',
   'One page: what changed, what was happening around it, what you tried, and what happened next.'],
  ['Clinician message drafting',
   'What you want to ask, written as a message you can read, change, and send yourself.'],
  ['Question generation',
   'The questions worth asking at this visit, each one drawn from something actually in your record.'],
  ['Record organization',
   'Results, documents and notes filed against the date they belong to, not the date you got round to them.'],
  ['Follow-up tracking',
   'What was said would happen next, and whether it has.'],
];

/**
 * What Care can be authorized to do. These are actions on her behalf, in her
 * name, with real consequences, so the list says plainly that each one is
 * connected by her and asks before it acts. Several of these depend on the
 * other side supporting it, which is said here rather than discovered later.
 */
const CONNECTS: string[] = [
  'Appointment search and booking',
  'Calendar',
  'Patient portals, where they support it',
  'Insurance information',
  'Referrals',
  'Labs and imaging',
  'Pharmacy',
  'Document and record requests',
];

/** The questions people ask first. WHOOP's Membership FAQ. */
const QUESTIONS: [string, string][] = [
  ['What is included in Ciatta Core?',
   'Your health record in one place — results and documents from your providers, your cycle, your sleep, your symptoms, what you take, and your own notes — and the insights that come from reading those together. Imported from a connected provider or entered once, then kept.'],
  ['What is Ciatta Care?',
   'The part of membership that acts on your record rather than only keeping it: preparing you for a visit, writing the brief, drafting the message you meant to send, and tracking what was supposed to happen next. It is included in membership, and it follows Core rather than opening with it.'],
  ['Does Ciatta Care do things on my behalf?',
   'Only what you connect and only when you say so. Each tool is authorized by you and can be disconnected by you, Care tells you what it is about to do and on whose behalf before it does it, and it keeps a record of every action taken in your name. It does not enter payment details, and it does not make clinical decisions.'],
  ['Which portals and pharmacies will it work with?',
   'The ones that support it. Some providers and services allow this kind of access and some do not, and that is not ours to decide. Ciatta will say which of yours are supported rather than implying it reaches all of them.'],
  ['Will there be other tiers?',
   'Yes. Core is the first, and it is the one that opens. What comes after it will be built on what Core turns out to be short of, so there is nothing honest to say about it yet — except that you will not be moved onto another tier, or charged for one, without choosing it.'],
  ['What does it cost?',
   'Not set yet. You will be told what membership costs before anything is charged, with the choice to stop there. No card is taken today.'],
  ['When does my membership start?',
   'When Ciatta opens. Joining now reserves your place in the order people are let in, and nothing begins — or is billed — before then.'],
  ['What happens when I join?',
   'One email when it opens, and nothing else. Your address is used to tell you it is ready and for nothing else.'],
  ['Why is Ciatta a membership rather than an app you buy once?',
   'Because the value is in the record accumulating. An insight on your first week is thin; the same reading across a year of cycles, sleep, labs and notes is not. A membership is the honest shape for something that keeps working on what you already gave it.'],
  ['Is my record private?',
   'Your record is yours. Your own words are never overwritten by a device or a clinic, everything you put in can be exported, and Ciatta is not in the room at your appointment — what it prepares is yours to take or to ignore.'],
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
        {/* ---- the film, with the membership named over it ---------------- */}
        <section className="m-hero">
          <Film base="member" className="m-hero-film" scrim="m-hero-scrim" width={1080} height={1920} />
          <div className="m-hero-inner">
            <span className="m-eyebrow">Pre-order</span>
            <h1 className="m-hero-title">A membership built around your record</h1>
            <p className="m-hero-lede">
              Your results, your cycle, your sleep, your symptoms and your own
              notes in one place, and what they say when they are read
              together. One membership, and it opens for members first.
            </p>
            <a className="m-btn is-light" href="#join">Reserve your place</a>
            <p className="m-hero-note">
              <span>No card</span> <span>&middot; Nothing charged</span>{' '}
              <span>&middot; One email when it opens</span>
            </p>
          </div>
        </section>

        {/* ---- what the membership is ------------------------------------ */}
        <section className="m-band">
          <div className="m-wrap">
            <div className="band-head">
              <h2 className="m-h2">Where membership starts</h2>
              <p className="m-h2-sub">
                Core is the tier that opens. Others will follow as Ciatta does
                more, and nothing moves you onto a different one without you
                choosing it.
              </p>
            </div>
            <div className="m-plan">
              <div className="m-plan-head">
                <span className="m-plan-name">Ciatta Core</span>
                <p className="m-plan-price">Price not set yet</p>
                <p className="m-plan-price-note">
                  You will be told what it costs before anything is charged.
                </p>
                <a className="m-btn" href="#join">Start with Core</a>
                <p className="m-plan-foot">Reserving a place is free</p>
              </div>
              <ul className="m-ticks">
                {INCLUDED.map((line) => (
                  <li key={line}>
                    <i aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---- Ciatta Care: what membership does with the record ---------- */}
        <section className="m-band" aria-labelledby="care-heading">
          <div className="m-wrap">
            <div className="band-head">
              <span className="m-eyebrow is-ink">Ciatta Care</span>
              <h2 className="m-h2" id="care-heading">
                The part that does something with it
              </h2>
              <p className="m-h2-sub">
                Keeping your record in one place is the beginning. Care is the
                work that comes after: getting you ready for an appointment,
                writing what you meant to ask, and knowing what was supposed to
                happen next. It is part of membership, not a separate purchase,
                and it follows Core rather than arriving with it.
              </p>
            </div>

            <div className="m-care">
              <div className="m-care-col">
                <h3 className="m-care-h">What Care prepares</h3>
                <dl className="m-care-list">
                  {CARE.map(([name, line]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{line}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="m-care-col">
                <h3 className="m-care-h">What you can authorize it to do</h3>
                <ul className="m-care-tools">
                  {CONNECTS.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                {/* The governing rule, next to the list it governs rather than
                    in a policy she has to go and find. */}
                <p className="m-care-rule">
                  You connect each one, and you can disconnect it. Care asks
                  before it acts, says what it is about to do and on whose
                  behalf, and keeps a record of everything it has done in your
                  name. It never enters payment details, and it never decides
                  anything clinical.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- the agents, and the view a clinician gets ------------------ */}
        <AgentsSection />

        {/* ---- start free, choose later. The one dark band, and the ask. -- */}
        <section className="m-free m-dark" id="join">
          <div className="m-wrap split is-centred">
            <div className="split-lead">
              <h2 className="m-free-title">Start free, choose later</h2>
              <p className="m-free-sub">Nothing is decided the day you join</p>
              <p className="m-free-body">
                Reserving a place costs nothing and commits you to nothing. Bring
                your results, your cycle, your sleep, your symptoms and your own
                notes into one place when it opens, see what they say read
                together, and decide about membership after that — with the price
                in front of you and the choice to stop there.
              </p>
            </div>
            <div className="split-body">
              <SubscribeForm id="waitlist-member" source="member" kind="waitlist" offerBriefs cta="Try Ciatta for free" note="" />
              <p className="m-free-note">
                No card is taken and nothing is charged. Joining reserves your
                place and tells you when it opens.
              </p>
            </div>
          </div>
        </section>

        {/* ---- questions -------------------------------------------------- */}
        <section className="m-band">
          <div className="m-wrap split">
            <div className="split-lead">
              <h2 className="m-h2">Membership questions</h2>
            </div>
            <div className="m-faq split-body">
              {QUESTIONS.map(([q, a]) => (
                <details className="qa-item" key={q}>
                  <summary>
                    <span>{q}</span>
                    <i aria-hidden="true" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="m-foot">
        <div className="m-wrap">
          <nav aria-label="Footer">
            <a href="/">Home</a>
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

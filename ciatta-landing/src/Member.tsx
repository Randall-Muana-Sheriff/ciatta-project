import { Wordmark } from './components/Wordmark';
import { WaitlistForm } from './components/WaitlistForm';
import { Film } from './components/Film';

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



/** The questions people ask first. WHOOP's Membership FAQ. */
const QUESTIONS: [string, string][] = [
  ['What is included in Ciatta Core?',
   'Your health record in one place — results and documents from your providers, your cycle, your sleep, your symptoms, what you take, and your own notes — and the insights that come from reading those together. Imported from a connected provider or entered once, then kept.'],
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
            <h2 className="m-h2">Where membership starts</h2>
            <p className="m-h2-sub">
              Core is the tier that opens. Others will follow as Ciatta does
              more, and nothing moves you onto a different one without you
              choosing it.
            </p>
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

        {/* ---- start free, choose later. The one dark band, and the ask. -- */}
        <section className="m-free m-dark" id="join">
          <div className="m-wrap">
            <h2 className="m-free-title">Start free, choose later</h2>
            <p className="m-free-sub">Nothing is decided the day you join</p>
            <p className="m-free-body">
              Reserving a place costs nothing and commits you to nothing. Bring
              your results, your cycle, your sleep, your symptoms and your own
              notes into one place when it opens, see what they say read
              together, and decide about membership after that — with the price
              in front of you and the choice to stop there.
            </p>

            <WaitlistForm id="waitlist-member" source="member" cta="Try Ciatta for free" note="" />

            <p className="m-free-note">
              No card is taken and nothing is charged. Joining reserves your
              place and tells you when it opens.
            </p>
          </div>
        </section>

        {/* ---- questions -------------------------------------------------- */}
        <section className="m-band">
          <div className="m-wrap">
            <h2 className="m-h2">Membership questions</h2>
            <div className="m-faq">
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
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </nav>
          <span>&copy; {new Date().getFullYear()} Ciatta</span>
        </div>
      </footer>
    </>
  );
}

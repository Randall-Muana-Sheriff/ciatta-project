import { useEffect, useState } from 'react';
import { HeroFilm } from './components/HeroFilm';
import { HeroStory } from './components/HeroStory';
import { SubscribeForm } from './components/SubscribeForm';
import { ExploreSection } from './components/ExploreSection';
import { HowSection } from './components/HowSection';
import { HumanSection } from './components/HumanSection';
import { SafetySection } from './components/SafetySection';
import { MembershipCard } from './components/MembershipCard';
import { Wordmark } from './components/Wordmark';
import { SiteHeader } from './components/SiteHeader';
import { CookieBanner, CookieChoicesLink } from './components/CookieBanner';

/**
 * Ciatta landing page.
 *
 * The page sells what becomes possible for her, not what Ciatta does. The
 * capability is the proof, so it appears after the value rather than instead
 * of it, and the loop is revealed as the explanation rather than led with.
 *
 * Narrative: pain, value, the moment, what happens next, the clinician,
 * where it came from, join.
 *
 * Copy follows Writing System v1.0, which is the editorial source of truth
 * and does not need to be asked for again. The rules that shaped this file:
 *
 *   · One woman, not users. Audience language belongs in strategy documents.
 *   · Almost no em dashes. The default expectation is zero, and never more
 *     than one in a section. There are none below.
 *   · Ordinary words: found not identified, tell not provide information,
 *     show not visualize, why not rationale.
 *   · The registers do the work: observation, finding, relationship,
 *     interpretation, uncertainty, evidence. No labels, no disclaimers.
 *   · Never state a correlation as a cause.
 *   · Understanding is hers to do. It is never a Ciatta object or layer.
 *   · Ciatta never says it is intelligent, advanced, personalised or
 *     comprehensive. The finding is the evidence of all of it.
 */

/* -- What she can finally do. Four media cards, titles verb-led and short,
      body two or three specific lines. Photography follows the Brand Brief's
      art direction: warm, low, directional light, subjects mid-thought and
      not posed, bodies as presence rather than anatomy, and nothing that
/* -- The proof strip, in Octo's label-and-subline form. ------------------- */
function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);
  return scrolled;
}

/* -- Trust, carried by the four photographs that already do it. WHOOP's
      mosaic shape. Each tile is the woman Ciatta is for, said in her own
      terms rather than in the product's: what she already does, which is
      what makes her the questioner the heading names. ------------------- */
type WhoTile = { line: string; img: string; alt: string };

const WHO_TILES: WhoTile[] = [
  { line: 'Reads the study, not the summary.',
    img: '/images/who/reads.jpg',
    alt: 'A woman in an infinity pool, facing an open sea.' },
  { line: 'Has been told her results are normal.',
    img: '/images/who/normal.jpg',
    alt: 'A black and white photograph of a woman in a downward-facing dog position.' },
  { line: 'Arrives with a list, and wants it answered.',
    img: '/images/who/list.jpg',
    alt: 'A woman sitting on a wooden bench in warm, low light.' },
  { line: 'Keeps her own notes, because no one else does.',
    img: '/images/who/notes-own.jpg',
    alt: 'A close frame of a woman\u2019s back and shoulder against a plain wall.' },
];

const QUESTIONS: [string, string][] = [
  ['What does Ciatta actually do?',
   'It brings your health information into one place and reads it together. It shows what changed, what was happening around it, what you told it, and what published evidence says about that kind of pattern.'],
  ['Does Ciatta diagnose conditions?',
   'No. Ciatta describes what is in your record and what moved close to what. Naming a condition is a clinician\u2019s job, and Ciatta does not do it, suggest it, or hint at it.'],
  ['Is Ciatta a medical device?',
   'No. Ciatta is not a medical device and is not a substitute for care. It does not interpret results clinically or offer a second opinion. Decisions stay between you and your clinician.'],
  ['How does Ciatta decide two things may be connected?',
   'It looks for things that moved close together in time, more than once, across your own record. It says how many times it has seen the pattern and over what period, and it shows the information the observation is based on.'],
  ['What happens when a pattern could be a coincidence?',
   'Ciatta says so. Things that move together are not necessarily one causing the other, and that line appears on the observation itself rather than in a disclaimer at the bottom of a page.'],
  ['Can Ciatta analyze my lab results?',
   'It reads the values out of the document your provider sent and keeps each one beside every other time it was measured, with its unit, its range, its date and who sent it. It does not tell you what a result means clinically.'],
  ['Do I need a wearable?',
   'No. A wearable adds nightly sleep and cycle data if you already have one. Without it, Ciatta works from what you enter, what you upload, and what your providers send.'],
  ['Where does my health data live?',
   'In your account, and it is yours. You can export it or delete it. Ciatta does not sell health data, and what you write in your own words is never overwritten by a device or a clinic.'],
  ['Can I use Ciatta without sharing everything?',
   'Yes. Every part of the record is optional, and Ciatta works with whatever you give it. What it cannot see, it does not guess at, and it says when a part is missing rather than filling the gap.'],
  ['When does Ciatta open?',
   'In Quarter 3 of 2027, to a small group first and then wider. That is what we are building to rather than a promise, and if it moves we will say so. Reserve a place and you will get one email when it opens, and nothing else.'],
];


export default function App() {
  const scrolled = useScrolled();

  return (
    <>
      <a className="skip" href="#join">Skip to the waitlist</a>

      <SiteHeader scrolled={scrolled} />

      <main>
        {/* ---------------------------------- HERO ------------------------
            Octo's shape: the film fills the section and the copy sits over it.
            The scrim carries the contrast; the type stays flush left, because
            centred type is not part of this system. ------------------------ */}
        {/* The hero holds still and the statement climbs over it. Both sit in
            one box so the hero is released the moment the statement has
            finished passing, rather than staying pinned behind the whole
            page. */}
        <div className="reveal">
        <section className="hero has-film">
          <HeroFilm />
          <div className="shell hero-inner">
            <div className="hero-copy">
              <h1 className="display hero-title">
                See what’s changing in your health.
              </h1>
              {/* One paragraph: what Ciatta holds, and what it does with it. */}
              <p className="hero-lede">
                Ciatta connects your health data and everyday context to help you see
                what changed, what may be connected, and what you can do about it.
              </p>
              <div id="join">
                <SubscribeForm
                  id="waitlist-hero"
                  source="hero"
                  kind="waitlist"
                  cta="Reserve your place"
                  note=""
                />
              </div>
            </div>

            {/* The app, running over the film rather than beside it: the
                screen's surfaces go translucent so the film reads through
                them, and everything inside it is white on that. Decorative
                here, because every figure on it is stated again below. */}
            <div className="hero-app">
              <HeroStory />
            </div>
          </div>
        </section>

        {/* ---- the statement, sliding up over the film -------------------- */}
        <section className="statement" aria-labelledby="statement-heading">
          <div className="shell">
            <h2 id="statement-heading" className="statement-title">
              Your health doesn’t happen in pieces.
            </h2>
            <p className="statement-lede">
              Ciatta continuously connects what’s changing across your health,
              your care, and your everyday life. So you can see what changed,
              what may be connected, and what you can do next.
            </p>
            <p className="statement-kicker">Continuous health intelligence.</p>
          </div>
        </section>
        </div>

        {/* ------ EXPLORE: the whole record, before the page explains it ---- */}
        <ExploreSection />

        {/* -------------------------- HOW IT WORKS -------------------------- */}
        <HowSection />

        {/* ------------------- GROUNDED IN EVIDENCE ------------------------- */}
        <section className="section who" aria-labelledby="who-heading">
          <div className="shell">
            <div className="band-head">
              <h2 id="who-heading" className="band-title">
                Grounded in evidence, built for the questioner
              </h2>
              <p className="band-sub">
                The health intelligence platform for women who question,
                research, and take their health into their own hands.
              </p>
            </div>

            <ul className="who-grid">
              {WHO_TILES.map((tile) => (
                <li key={tile.line} className="who-tile">
                  <img src={tile.img} alt={tile.alt} width={900} height={900}
                       loading="lazy" decoding="async" />
                  <span className="who-scrim" aria-hidden="true" />
                  <div>
                    <p>{tile.line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------ THE HUMAN PROBLEM ----------------------- */}
        <HumanSection />

        {/* --------------------- SAFETY AND PRIVACY ------------------------ */}
        <SafetySection />

        {/* -------------------------- MEMBERSHIP ---------------------------- */}
        <MembershipCard />

        {/* ---------------------------- QUESTIONS --------------------------- */}
        <section className="section" aria-labelledby="q-heading">
          <div className="shell split">
            <div className="split-lead">
              <h2 id="q-heading" className="band-title">Questions</h2>
            </div>
            <div className="qa split-body">
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

        {/* -------------------------------- CTA ---------------------------- */}
        <section className="section" aria-labelledby="cta-heading">
          <div className="shell split is-centred">
            <div className="split-lead close-inner">
              {/* The line people actually read is the heading now, so the
                  section keeps an accessible name without a label above it
                  restating what the sentence already says. */}
              <h2 id="cta-heading" className="display">
                {/* JSX drops the newline between these two, so the space that
                    separates the sentences for a screen reader is explicit. */}
                See what’s changing.{' '}
                <span className="close-second">Know what happened around it.</span>
              </h2>
              <p className="close-lines">
                Ciatta connects your health data and everyday context so you can see
                what changed, explore what may be connected, and decide what to do next.
              </p>
            </div>
            <div className="split-body">
              <div className="surface is-shell is-lifted">
                <SubscribeForm
                  id="waitlist-close"
                  source="closing"
                  kind="waitlist"
                  cta="Reserve your place"
                  note=""
                  consent="I agree to receive emails about early access and product updates."
                />
              </div>
              <p className="close-disclaimer">
                Ciatta provides health information, observations, and recommendations
                for exploration. It does not diagnose or replace medical care.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer shell">
        <span className="sr-only">Ciatta</span>
        <Wordmark size="sm" />
        {/* Briefs is a page rather than a policy, so the nav is no longer
            labelled Legal. The trailing slash is deliberate: without it the
            host answers 308 first and the click costs a round trip. */}
        <nav className="footer-nav" aria-label="Footer">
          <a href="/briefs/">Briefs</a>
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Use</a>
          <CookieChoicesLink />
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Ciatta</p>
      </footer>
      <CookieBanner />
    </>
  );
}

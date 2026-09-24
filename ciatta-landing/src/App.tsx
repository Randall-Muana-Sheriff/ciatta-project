import { useEffect, useState } from 'react';
import { HeroFilm } from './components/HeroFilm';
import { HeroStory } from './components/HeroStory';
import { SubscribeForm } from './components/SubscribeForm';
import { ExploreSection } from './components/ExploreSection';
import { HowSection } from './components/HowSection';
import { HumanSection } from './components/HumanSection';
import { SafetySection } from './components/SafetySection';
import { MembershipCard } from './components/MembershipCard';
import { SiteHeader } from './components/SiteHeader';
import { CookieBanner } from './components/CookieBanner';
import { SiteFooter } from './components/SiteFooter';

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

/* Six, not ten.

   Ten questions is a page saying everything it can think of rather than
   the six a person actually arrives with, and four of the old ten were
   halves of the same question — diagnose and medical device, connection
   and coincidence, wearable and partial sharing. Each pair is one question
   now, answered once and properly.

   What could not be cut: that Ciatta does not diagnose, that a connection
   is not a cause, that the record is hers, and when it opens. Those are
   the four the rest of the site is also bound by. */
const QUESTIONS: [string, string][] = [
  ['What does Ciatta actually do?',
   'It brings your health information into one place and reads it together, rather than leaving you to hold a portal, an app, a wearable and your own memory at once. It shows what changed, what was happening around it, what you told it, and what published evidence says about that kind of pattern. It reads the documents your provider sends, too, keeping each value beside every other time it was measured, with its unit, its range and its date.'],

  ['Does Ciatta diagnose conditions, or replace my doctor?',
   'No, to both. Ciatta is not a medical device and is not a substitute for care. It describes what is in your record and what moved close to what; naming a condition is a clinician\u2019s job, and Ciatta does not do it, suggest it, or hint at it. What it is for is the appointment: arriving with your own history in order, and the questions worth asking already written down.'],

  ['How does Ciatta decide two things may be connected?',
   'It looks for things that moved close together in time, more than once, across your own record, and it shows you the information the observation rests on, along with how many times it has seen the pattern and over what period. When something could be a coincidence, Ciatta says so on the observation itself rather than in a disclaimer at the bottom of the page. Things that move together are not necessarily one causing the other, and a tool that blurs that is worse than no tool.'],

  ['Do I need a wearable, or to share everything?',
   'Neither. A wearable adds nightly sleep and cycle data if you already have one; without it, Ciatta works from what you enter, what you upload, and what your providers send. Every part of the record is optional. What Ciatta cannot see it does not guess at: it says which part is missing rather than filling the gap.'],

  ['Where does my health data live, and who can reach it?',
   'In your account, and it is yours. It is encrypted in transit and at rest, with sensitive fields wrapped in per-user encryption envelopes, and access inside Ciatta is audited and held to the principle of least privilege. It stays yours: export everything at any time, disconnect any source and its data goes with it, delete your account and every byte goes too, with no shadow copies retained. We will never sell, rent or share your health data with advertisers, brokers or insurers. And Ciatta is built for your health outcomes rather than for ad targeting, so what it tells you is grounded in medical evidence.'],

  ['When does Ciatta open, and what does reserving a place do?',
   'Q3 of 2027, to a small group first and then wider. That is what we are building to rather than a promise, and if it moves we will say so. Reserving a place puts you on the early-access list, and charges you nothing either way. Leave your address and no card is taken at all. Reserve with a card and it is saved, not billed, so membership can begin the day Ciatta opens; you can remove it at any time until then, and you are not subscribed to anything. You will get one email when it opens, and nothing else.'],
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
              {/* The hero's action is the shortest word on the page. It sits
                  inside the field on a phone, where "Reserve your place" left
                  barely a hundred pixels to type an address into, and the
                  sentence above it has already said what she is joining. */}
              <div id="join">
                <SubscribeForm
                  id="waitlist-hero"
                  source="hero"
                  kind="waitlist"
                  cta="Join now"
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
            {/* One sentence, in the page's own words.

                A scan of every claim on the site found this was the only
                place that said anything forward-looking. "Surface emerging
                risks" promises detection of something before it arrives,
                and nothing else here supports it: the FAQ six sections down
                says Ciatta does not name a condition, "suggest it, or hint
                at it", the observation copy says a connection is not a
                cause, and the footer on every page says it does not
                diagnose, treat or prevent. It was also the largest type on
                the page, so the strongest claim was the one with the least
                behind it.

                The triad the rest of the site actually makes is: what
                changed, what may be connected, what you can do. The hero
                says it, the how-it-works steps say it, the FAQ says it.
                This says it too now, at the size the page is loudest. */}
            {/* Set the way apple.com/apple-vision-pro sets its statement:
                one continuous block of sentences, every line the same size
                and weight, broken where the writing breaks rather than
                wherever the column happens to end. Theirs reads

                  Apple Vision Pro seamlessly
                  blends digital content with
                  your physical space.
                  So you can work, watch, relive
                  memories, and connect in ways
                  never before possible.

                What it says has changed as well. It used to be the hero's
                own sentence again: 83% of the content words in common, one
                screen apart, which reads as a stutter rather than emphasis.
                The hero says what Ciatta does, so this says why it has to
                exist at all, which nothing else on the page says and which
                is what "one membership, one year" rests on further down.

                The three middle lines are set as three because they are
                three: a wearable, a lab, a clinic, each catching one thing
                and missing the rest. Stacked, the shape of the sentence is
                the argument.

                The breaks are authored, so they are switched off below a
                tablet: a line break written for a 1440 window lands in the
                middle of a phrase on a 390 one. There the block wraps to
                its own measure instead.

                st-br2 is the second kind: a break that only exists between a
                tablet and 1280. The wearable line is the longest of the six
                and wraps there on its own, leaving "recovery." alone on a
                line. Above 1280 it fits and the break is off; below a tablet
                every break is off. The {' '} before each break is not
                decoration: JSX strips the whitespace either side of an
                element, so with the breaks switched off the lines ran
                together as "connectsyour health data". */}
            <h2 id="statement-heading" className="statement-title">
              Your health is continuous,{' '}<br className="st-br" />
              but your data is still divided.{' '}<br className="st-br" />
              Your wearable tracks sleep,{' '}<br className="st-br2" />
              movement, and recovery.{' '}<br className="st-br" />
              Your labs capture measurements.{' '}<br className="st-br" />
              Your clinic sees your visits.{' '}<br className="st-br" />
              Your life holds everything around them.
            </h2>
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
                You shouldn’t have to piece together your own health.
              </h2>
              <p className="close-lines">
                We are building the intelligence layer for personal health,
                connecting what’s happening across your body, your care, and
                your everyday life so you can see what’s changing, make
                informed decisions, and move forward with greater clarity.
              </p>
            </div>
            <div className="split-body">
              <div className="surface is-shell is-lifted">
                <SubscribeForm
                  id="waitlist-close"
                  source="closing"
                  kind="waitlist"
                  cta="Reserve"
                  note=""
                  consent="I agree to receive emails about early access and product updates."
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <CookieBanner />
    </>
  );
}

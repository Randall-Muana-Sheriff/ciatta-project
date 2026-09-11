import { useEffect, useState } from 'react';
import { HeroFilm } from './components/HeroFilm';
import { WaitlistForm } from './components/WaitlistForm';
import { ProductShowcase } from './components/ProductShowcase';
import { ExploreSection } from './components/ExploreSection';
import { Wordmark } from './components/Wordmark';

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

/* -- What you get. One card per part of the product, named the way the app
      names it, each with the photograph that carries its feeling rather than
      illustrates its function. ------------------------------------------- */
const WHAT_YOU_GET: [string, string, string, string][] = [
  ['Your health in one place',
   'Results and documents from your providers, your cycle, your sleep, your symptoms, and what you take. Imported or entered once.',
   '/images/get/one-place.jpg',
   'A woman at a window in low morning light, holding a cup, looking out.'],
  ['Change over time',
   'Not today\u2019s number. What moved, when it moved, and what your own usual looked like before it did.',
   '/images/get/over-time.jpg',
   'A figure standing on a ridge at sunrise, with range after range behind her.'],
  ['Personalized insights',
   'What several pieces of your record say when they are read together, with the reasoning shown rather than asserted.',
   '/images/get/insight.jpg',
   'A woman with her eyes closed and one hand resting on her chest, in warm evening light.'],
  ['Your own words, kept',
   'A stressful week, a medication change, a night you did not sleep. Context that no device records, sitting beside the measurements.',
   '/images/get/own-words.jpg',
   'A woman sitting up in bed in a bright room, stretching, first thing in the morning.'],
  ['Where every part came from',
   'Measured, you told Ciatta, imported, uploaded, published evidence, or inferred. Every figure carries its source.',
   '/images/get/provenance.jpg',
   'A close frame of a woman\u2019s torso and shoulder against a plain wall.'],
  ['Something to bring to an appointment',
   'What changed, what was happening around it, and one question worth asking. Yours to take or to ignore.',
   '/images/get/appointment.jpg',
   'A woman outdoors at dawn with her arms raised above her head, mid-stretch.'],
];

/* -- How Ciatta compares. Categories rather than named products: a claim
      about a category can be checked against the category, and it does not
      go stale the week someone ships a feature. -------------------------- */
const COMPARE_COLS = ['Ciatta', 'A tracking app', 'Your patient portal'] as const;
const COMPARE_ROWS: [string, string, string, string][] = [
  ['What it holds',
   'Cycle, sleep, symptoms, medications, your own notes, and your clinical results together.',
   'Whatever that app was built to track.',
   'What your providers sent, and only from providers who send to it.'],
  ['Where your results live',
   'Beside everything else, with unit, range, date and provider.',
   'Usually nowhere. Most have no place for a lab result.',
   'Here, as documents and values.'],
  ['Your own context',
   'Kept as you wrote it, dated, and read alongside the measurements.',
   'Sometimes a notes field. Rarely used in anything.',
   'Not collected.'],
  ['Whether it says why',
   'Shows what it read and what it is unsure of, and names what is still too thin to call.',
   'Usually a number or a score, without the working.',
   'No interpretation. It is a record, not a reading of one.'],
  ['What you can take to an appointment',
   'What changed, what was around it, and a question you might ask.',
   'Screenshots.',
   'A document you can print.'],
];

/* -- Questions. The ones a careful person asks before handing over a health
      record, answered without hedging into meaninglessness. -------------- */
/* -- "Grounded in evidence, built for the questioner." --------------------
      Shaped after the "Backed by PHDs, worn by MVPs" mosaic on whoop.com:
      a headline, a lede, and a grid mixing photographic tiles with written
      ones. WHOOP fills the written ones with member quotes. Ciatta has no
      members yet, but it does have sixty women who answered its study, so
      the quotes are theirs.

      Every one is a verbatim answer from
      ciatta-understanding-your-health-over-time-study-results.csv, August
      2026, n=60, all finished responses. Five different respondents, one
      quote each. Nothing is composited and nothing is paraphrased: the only
      changes are sentence capitalisation, apostrophes, and trims marked with
      an ellipsis. An attribution is the age band the study asked in and the
      life stage she selected, and nothing else: both come straight off her
      row, so they are as specific as the data actually is and no further.
      No names, no initials, none invented. If these are
      ever re-cut, re-cut them from the CSV — do not edit them here.

      The photographic tiles carry the other half of WHOOP's headline: who
      this is for. ------------------------------------------------------- */
type WhoTile =
  | { kind: 'photo'; line: string; img: string; alt: string; wide?: boolean }
  | { kind: 'quote'; line: string; who: string; wide?: boolean };

const WHO_TILES: WhoTile[] = [
  { kind: 'photo', line: 'Reads the study, not the summary.',
    img: '/images/who/reads.jpg',
    alt: 'A woman in an infinity pool, facing an open sea.' },
  // row 24, col 22 — what made it difficult to connect information
  { kind: 'quote',
    line: 'So many doctors told me that the symptoms I was having were not related to one another.',
    who: '45–54, in perimenopause' },
  { kind: 'photo', wide: true, line: 'Has been told her results are normal.',
    img: '/images/who/normal.jpg',
    alt: 'A black and white photograph of a woman in a downward-facing dog position.' },

  // row 2, col 34 — what connected information would have helped her understand
  { kind: 'quote', wide: true,
    line: 'Having my complete health history, especially the last 10 years — I believe the patterns would be evident instead of me feeling unheard, and just waiting for whatever is really going on to get to a point that it’s 100% obvious.',
    who: '55+, in perimenopause' },
  { kind: 'photo', line: 'Arrives with a list, and wants it answered.',
    img: '/images/who/list.jpg',
    alt: 'A woman sitting on a wooden bench in warm, low light.' },
  // row 19, col 39 — what would change about her response
  { kind: 'quote',
    line: 'I wouldn’t be so likely to start googling and freaking out if I knew it already changed before and had the proof of that.',
    who: '35–44, currently cycling' },

  { kind: 'photo', line: 'Keeps her own notes, because no one else does.',
    img: '/images/who/notes-own.jpg',
    alt: 'A close frame of a woman’s back and shoulder against a plain wall.' },
  // row 34, col 34
  { kind: 'quote', wide: true,
    line: 'It would have saved me hours searching portals, printing documents, hunting old medical records and trying to find old records that no one seems to have now.',
    who: '45–54, currently cycling' },
  // row 14, col 34
  { kind: 'quote',
    line: 'I could have avoided multiple unhelpful doctors and a range of medications that did not help.',
    who: '35–44, cycle changing' },
];

const QUESTIONS: [string, string][] = [
  ['What does Ciatta actually do?',
   'It brings your health information into one place and reads it together. It shows what changed, what was happening around it, what you told it, and what published evidence says about that kind of pattern. It does not diagnose, prescribe, or tell you what to do.'],
  ['Is Ciatta a medical device?',
   'No. Ciatta is not a medical device and is not a substitute for care. It does not interpret results clinically or offer a second opinion. Decisions stay between you and your clinician.'],
  ['Where does my data live?',
   'In your account, and it is yours. You can export it or delete it. Ciatta does not sell health data, and what you write in your own words is never overwritten by a device or a clinic.'],
  ['How does Ciatta decide two things are connected?',
   'It looks for things that moved close together in time, more than once, across your own record. It says how many times it has seen the pattern and over what period, and it says plainly when there is not enough behind something to call it.'],
  ['What if a pattern is a coincidence?',
   'Often it is, and Ciatta says so. Things that move together are not necessarily one causing the other, and that line appears on the insight itself rather than in a disclaimer at the bottom of a page.'],
  ['Do I need a wearable?',
   'No. A wearable adds nightly sleep and cycle data if you already have one. Without it, Ciatta works from what you enter, what you upload, and what your providers send.'],
  ['When does it open?',
   'A small group first, then wider. Reserve a place and you will get one email when it opens, and nothing else.'],
];

export default function App() {
  const scrolled = useScrolled();

  return (
    <>
      <a className="skip" href="#join">Skip to the waitlist</a>

      <header className={scrolled ? 'header is-scrolled' : 'header'}>
        <a href="/" className="header-brand" aria-label="Ciatta, home">
          <Wordmark size="sm" />
        </a>
        <div className="header-end">
          <a className="header-cta" href="/member/">Become a member</a>
        </div>
      </header>

      <main>
        {/* ---------------------------------- HERO ------------------------
            Octo's shape: the film fills the section and the copy sits over it.
            The scrim carries the contrast; the type stays flush left, because
            centred type is not part of this system. ------------------------ */}
        <section className="hero has-film">
          <HeroFilm />
          <div className="shell hero-inner">
            <div className="hero-copy">
              <h1 className="display hero-title">
                Your health is changing. See what is changing with it.
              </h1>
              {/* One paragraph, in the order the problem is actually met: what
                  changes, where it ends up, and what Ciatta does with it. The
                  value sentence closes it rather than sitting in its own block,
                  so position carries the emphasis. */}
              <p className="hero-lede">
                Your cycle changes. Your sleep changes. Symptoms come and go. The
                pieces are scattered across apps, devices and appointments. Ciatta
                brings them together so you can see what changed and what to ask.
              </p>
              <div id="join">
                <WaitlistForm id="waitlist-hero" source="hero" />
              </div>
            </div>
          </div>
        </section>

        <ProductShowcase />

        {/* -------------------------- WHAT YOU GET -------------------------- */}
        <section className="section get" aria-labelledby="get-heading">
          <div className="shell">
            <h2 id="get-heading" className="band-title">What you get</h2>
            <p className="band-sub">
              Six parts, and they only work because they are in the same place.
            </p>
          </div>
          {/* The rail breaks out of the shell so the cards run to the edge of
              the screen and the next one is always half-visible. That peek is
              the only thing telling anyone there is more than three. */}
          <ul className="get-rail">
            {WHAT_YOU_GET.map(([title, body, img, alt]) => (
              <li className="get-card" key={title}>
                <img src={img} alt={alt} width={900} height={1200} loading="lazy" decoding="async" />
                <div className="get-scrim" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>


        {/* ----------------------------- EXPLORE ---------------------------- */}
        <ExploreSection />

        {/* ------------------------ HOW CIATTA COMPARES --------------------- */}
        <section className="section" aria-labelledby="compare-heading">
          <div className="shell">
            <h2 id="compare-heading" className="band-title">How Ciatta compares</h2>
            <p className="band-sub">
              Three places your health information already lives. Only one of them
              reads it together.
            </p>
            <div className="compare-wrap">
              <table className="compare">
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">What is compared</span></th>
                    {COMPARE_COLS.map((c, i) => (
                      <th scope="col" key={c} className={i === 0 ? 'is-ours' : undefined}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(([label, a, b, c]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="is-ours">{a}</td>
                      <td>{b}</td>
                      <td>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="compare-note">
              Compared as categories rather than named products, because the point
              is where each kind of tool stops rather than which brand you use.
            </p>
          </div>
        </section>

        {/* ------------------- GROUNDED IN EVIDENCE ------------------------- */}
        <section className="section who" aria-labelledby="who-heading">
          <div className="shell">
            <h2 id="who-heading" className="band-title is-centred">
              Grounded in evidence, built for the questioner
            </h2>
            <p className="band-sub is-centred">
              The health intelligence platform for women who question, research,
              and take their health into their own hands.
            </p>

            <ul className="who-grid">
              {WHO_TILES.map((tile) => (
                <li
                  key={tile.line}
                  className={`who-tile is-${tile.kind}${tile.wide ? ' is-wide' : ''}`}
                >
                  {tile.kind === 'photo' ? (
                    <>
                      <img src={tile.img} alt={tile.alt} width={900} height={900}
                           loading="lazy" decoding="async" />
                      <span className="who-scrim" aria-hidden="true" />
                      <p>{tile.line}</p>
                    </>
                  ) : (
                    <figure>
                      <blockquote><p>{tile.line}</p></blockquote>
                      <figcaption>{tile.who}</figcaption>
                    </figure>
                  )}
                </li>
              ))}
            </ul>

            <p className="who-note">
              Quotations are answers given by women in Ciatta&rsquo;s
              <em> Understanding your health over time</em> study, August 2026,
              sixty respondents.
            </p>
          </div>
        </section>

        {/* ---------------------------- QUESTIONS --------------------------- */}
        <section className="section" aria-labelledby="q-heading">
          <div className="shell">
            <h2 id="q-heading" className="band-title">Questions</h2>
            <div className="qa">
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
          <div className="shell close-inner">
            {/* The line people actually read is the heading now, so the
                section keeps an accessible name without a label above it
                restating what the sentence already says. */}
            <h2 id="cta-heading" className="display">
              Something feels different, and you cannot quite explain it.
            </h2>
            <p className="close-lines">
              Ciatta turns that into what changed, what was happening around it, and what
              you have noticed since.
            </p>
            <div className="surface is-shell is-lifted">
              <WaitlistForm id="waitlist-close" source="closing" />
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
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@ciatta.app">Contact</a>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Ciatta</p>
      </footer>
    </>
  );
}

import { useEffect, useState } from 'react';
import { HeroFilm } from './components/HeroFilm';
import { ProductShowcase } from './components/ProductShowcase';
import { Wordmark } from './components/Wordmark';
import { joinWaitlist } from './lib/waitlist';

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
      looks like a hospital. --------------------------------------------- */
const VALUE = [
  {
    id: 'remember',
    img: '/images/value/remember.jpg',
    alt: 'A woman at a window in low morning light, holding a cup, looking out.',
    title: 'You understand your health better',
    body: 'Something felt different in March. Now you can see what actually changed then, and what changed alongside it.',
  },
  {
    id: 'connect',
    img: '/images/value/connect.jpg',
    alt: 'A woman with her eyes closed and one hand resting on her chest, in warm evening light.',
    title: 'You know what to pay attention to',
    body: 'Not everything that moves matters. Ciatta shows you which changes held, which repeated, and which are still too thin to call.',
  },
  {
    id: 'clinician',
    img: '/images/value/clinician.jpg',
    alt: 'A woman at the edge of still water, seen from behind, facing an open horizon.',
    title: 'You have a better conversation',
    body: 'You arrive with what changed, what you noticed and what you want to ask, instead of trying to reconstruct six months in ten minutes.',
  },
  {
    id: 'over-time',
    img: '/images/value/over-time.jpg',
    alt: 'A woman with short white hair sitting outdoors, holding a glass, looking away from the camera.',
    title: 'You decide what to explore next',
    body: 'With the evidence in front of you and its limits stated, the next step is yours to choose rather than guess at.',
  },
] as const;

/* -- The proof strip, in Octo's label-and-subline form. ------------------- */
const PROOF = [
  ['58%', 'bring their health information together entirely themselves'],
  ['2%', 'have anything automated'],
  ['85%', 'notice change in their bodies often or very often'],
  ['63%', 'wanted one connected place for it'],
] as const;

/* -- The finding, carried all the way through: what she noticed, what Ciatta
      found in it, what evidence says in general, what may be worth exploring,
      and what to raise. The register of each answer tells her which kind of
      claim it is, which is the Writing System doing the work no label could. */
const MOMENT = [
  {
    q: 'What you noticed',
    a: 'That something changed in the spring, and that you had stopped sleeping through the night.',
  },
  {
    q: 'What Ciatta found in it',
    a: 'Your two shortest cycles each began within a week of your two lowest-sleep weeks.',
  },
  {
    q: 'What evidence says in general',
    a: 'Sleep disruption is associated with cycle variability in published cohorts. That is a population finding, not a statement about you.',
  },
  {
    q: 'What may be worth exploring',
    a: 'Whether the pattern holds through the three months missing from your record, and whether anything else moved in the same weeks.',
  },
  {
    q: 'What to raise with your clinician',
    a: 'Whether shorter cycles alongside disrupted sleep is worth investigating now, or worth watching for another two cycles.',
  },
] as const;

/* -- Her journey, not the machine's. The five stages are what she does and
      what she gets, in the order she meets them. Stage five returns to the
      first, because a change she made becomes something to observe. ------- */
const JOURNEY = [
  {
    name: 'See',
    token: 'var(--measured)',
    line: 'What has been changing, across all of it.',
    body: 'Your cycle, your sleep, your symptoms and your labs, read against your own history rather than a population average.',
  },
  {
    name: 'Understand',
    token: 'var(--change)',
    line: 'What may be behind it.',
    body: 'Your own information, the context you add, and published evidence, read together to make sense of what may be happening. Ciatta states what it found and what it cannot establish.',
  },
  {
    name: 'Prepare',
    token: 'var(--reported)',
    line: 'What to bring to your clinician.',
    body: 'The findings, your observations and your questions, gathered before the appointment rather than recalled during it.',
  },
  {
    name: 'Decide',
    token: 'var(--evidence)',
    line: 'What may be worth exploring next.',
    body: 'Options and questions grounded in your own evidence, with the uncertainty stated. Ciatta does not diagnose, prescribe, or stand in for your clinician.',
  },
  {
    name: 'Learn',
    token: 'var(--measured)',
    line: 'What happened after.',
    body: 'You try something, or decide to watch. Ciatta observes the period that follows and carries what it learns into everything it shows you next.',
  },
] as const;

/* -- Evidence. Four kinds of provenance only, and what Ciatta worked out is
      listed last and named as Ciatta's. ------------------------------------ */
const CHAIN = [
  { what: 'Cycle length, 12 months', src: 'Measured · Oura', family: 'measured' },
  { what: 'Two entries in March', src: 'You told Ciatta', family: 'reported' },
  { what: 'Sleep, nightly', src: 'Measured · Oura', family: 'measured' },
  { what: 'Range for ages 25 to 34', src: 'Published 2019', family: 'evidence' },
  { what: 'Three months missing', src: 'Not in the record', family: 'uncertainty' },
  { what: 'The connection between them', src: 'Ciatta worked this out', family: 'change', inference: true },
] as const;

/* -- What she walks in with. Four things, in her language. --------------- */
const PREPARED = [
  ['What changed', 'Cycle length fell from 29 days to 26 across the year.'],
  ['What you noticed', 'A stressful stretch in March, and sleep that stopped running through.'],
  ['What seems connected', 'The two shortest cycles each followed a lowest-sleep week.'],
  ['What you want to ask', 'Is this worth investigating now, or worth watching another two cycles?'],
] as const;

const REFUSALS = [
  ['Not a wellness app.', 'The offer is continuity, not encouragement.'],
  ['Not a dashboard.', 'More charts is not more clarity.'],
  ['Not an assistant.', 'No persona, no chat, no advice.'],
  ['Not a diagnostic.', 'Ciatta does not interpret, diagnose or recommend.'],
] as const;

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

type FormState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; alreadyJoined: boolean }
  | { kind: 'error'; message: string };

function WaitlistForm({ id, source }: { id: string; source: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'saving') return;
    setState({ kind: 'saving' });
    const result = await joinWaitlist(email, source);
    if (result.ok) {
      setState({ kind: 'done', alreadyJoined: result.alreadyJoined });
      setEmail('');
    } else {
      setState({ kind: 'error', message: result.message });
    }
  }

  // Silence is part of the product. It says what happened and stops.
  if (state.kind === 'done') {
    return (
      <div className="joined" role="status">
        <span className="joined-mark" aria-hidden="true" />
        <div>
          <p className="joined-title">
            {state.alreadyJoined ? 'You were already on the list.' : 'You are on the list.'}
          </p>
          <p className="joined-sub">One email when it opens.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="waitlist" onSubmit={onSubmit}>
      <div className="waitlist-row">
        <div className="waitlist-field">
          <label htmlFor={id}>Email</label>
          <input
            id={id}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={`${id}-note`}
          />
        </div>
        <button className="btn-primary" type="submit" disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Adding…' : 'Join the waitlist'}
        </button>
      </div>
      <p
        id={`${id}-note`}
        className={state.kind === 'error' ? 'waitlist-note is-error' : 'waitlist-note'}
        role={state.kind === 'error' ? 'alert' : undefined}
      >
        {state.kind === 'error'
          ? state.message
          : 'Private testing. One email when it opens.'}
      </p>
    </form>
  );
}

/**
 * Cycle length over twelve months on a real time axis.
 *
 * Distance on screen is distance in time. Spacing irregular observations
 * evenly manufactures a smooth history out of a patchy one, so the three
 * missing months are drawn as a dashed span sized to the real gap.
 */
function CycleChart() {
  const points = [
    { m: 0, d: 29 }, { m: 1, d: 29 },
    { m: 5, d: 28 }, { m: 6, d: 28 }, { m: 7, d: 27 },
    { m: 8, d: 27 }, { m: 9, d: 26 }, { m: 10, d: 26 }, { m: 11, d: 26 },
  ];
  const W = 360, H = 150;
  const padL = 30, padR = 12, padT = 16, padB = 26;
  const x = (m: number) => padL + (m / 11) * (W - padL - padR);
  const y = (d: number) => padT + ((30 - d) / 5) * (H - padT - padB);
  const before = points.filter((p) => p.m <= 1);
  const after = points.filter((p) => p.m >= 5);
  const line = (ps: typeof points) => ps.map((p, i) => `${i ? 'L' : 'M'} ${x(p.m)} ${y(p.d)}`).join(' ');

  return (
    <div className="surface chart">
      <svg
        className="chart-frame"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Cycle length over twelve months, falling from 29 days to 26 days. Three months in the middle are missing from the record and are drawn as a gap."
      >
        {[26, 28, 30].map((d) => (
          <g key={d}>
            <line x1={padL} y1={y(d)} x2={W - padR} y2={y(d)} stroke="var(--rule)" strokeWidth="1" />
            <text x={0} y={y(d) + 4} fill="var(--meta-ink)" fontSize="11" fontFamily="var(--font)">{d}d</text>
          </g>
        ))}
        <line
          x1={x(1)} y1={y(29)} x2={x(5)} y2={y(28)}
          stroke="var(--uncertainty)" strokeWidth="2" strokeDasharray="4 4"
        />
        <text
          x={(x(1) + x(5)) / 2} y={y(29) - 8}
          fill="var(--meta-ink)" fontSize="11" fontFamily="var(--font)"
          textAnchor="middle" letterSpacing="1"
        >
          3 MONTHS MISSING
        </text>
        <path d={line(before)} fill="none" stroke="var(--measured)" strokeWidth="2" />
        <path d={line(after)} fill="none" stroke="var(--measured)" strokeWidth="2" />
        {points.map((p) => (
          <circle key={p.m} cx={x(p.m)} cy={y(p.d)} r="2.5" fill="var(--measured)" />
        ))}
        <text x={padL} y={H - 6} fill="var(--meta-ink)" fontSize="11" fontFamily="var(--font)">JAN</text>
        <text x={W - padR} y={H - 6} fill="var(--meta-ink)" fontSize="11" fontFamily="var(--font)" textAnchor="end">DEC</text>
      </svg>
      <div className="chart-legend">
        <span className="pill is-measured">Measured</span>
        <span className="pill is-uncertainty">Not in the record</span>
      </div>
      <p className="chart-note">
        Three months are missing from the record. Ciatta does not guess to fill the gap.
      </p>
    </div>
  );
}

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
          <span className="pill is-change header-status">
            <i aria-hidden="true" />
            Private testing
          </span>
          <a className="header-cta" href="#join">Become a member</a>
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
              <span className="pill is-reported hero-audience">
                <i aria-hidden="true" />
                If your cycle is changing, or you are in perimenopause or menopause
              </span>
              <h1 className="display hero-title">
                Your health is changing.
                <em>See what is changing with it.</em>
              </h1>
              {/* One continuous paragraph. The value sentence closes it rather
                  than sitting in its own block, so position carries the
                  emphasis that weight used to. */}
              <p className="hero-lede">
                Your cycle changes. Your sleep changes. Symptoms come and go. The pieces
                are scattered across apps, devices, appointments, and your memory. Ciatta
                brings them together so you can see patterns and changes over time,
                prepare for better conversations with your clinicians, and make more
                informed decisions about what to explore next.
              </p>
              <div id="join">
                <WaitlistForm id="waitlist-hero" source="hero" />
              </div>
            </div>
          </div>
        </section>

        <ProductShowcase />

        {/* ----------------------- 01 · WHAT CHANGES FOR YOU --------------- */}
        <section className="section" aria-labelledby="value-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">01</span>
              <h2 id="value-heading">What changes for you</h2>
            </div>
            <div className="section-intro">
              <p className="statement">
                Four things you can say afterwards that you could not say before.
              </p>
            </div>

            <div className="value-row">
              {VALUE.map((v) => (
                <article className="value-item" key={v.id}>
                  <img className="value-tile" src={v.img} alt={v.alt} width={720} height={900} loading="lazy" />
                  <h3 className="value-title">{v.title}</h3>
                  <p>{v.body}</p>
                </article>
              ))}
            </div>

            <div className="proof">
              {PROOF.map(([n, label]) => (
                <div className="proof-item" key={n}>
                  <span className="proof-n">{n}</span>
                  <span className="proof-label">{label}</span>
                </div>
              ))}
            </div>
            <p className="note">
              From Ciatta&rsquo;s own research. What people asked for first was patterns
              they cannot see themselves. Change over time came second.
            </p>
          </div>
        </section>

        {/* ---------------------------- 02 · THE JOURNEY -------------------- */}
        <section className="section" aria-labelledby="journey-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">02</span>
              <h2 id="journey-heading">See, understand, prepare, decide, learn</h2>
              <span className="aside">Returns to See</span>
            </div>
            <div className="section-intro">
              <p className="statement">
                Seeing the pattern is where it starts, not where it stops.
              </p>
            </div>

            <ol className="journey">
              {JOURNEY.map((st, i) => (
                <li className="surface journey-step" key={st.name}>
                  <span className="journey-mark" style={{ background: st.token }} aria-hidden="true" />
                  <span className="journey-n">{String(i + 1).padStart(2, '0')}</span>
                  <div className="journey-body">
                    <h3 className="journey-name">{st.name}</h3>
                    <p className="journey-line">{st.line}</p>
                    <p>{st.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="loop-return">
              <b>&#8634;</b>
              <span>
                Then it begins again, already knowing what happened last time. That is
                what makes the second visit different from the first.
              </span>
            </p>
          </div>
        </section>

        {/* ------------------------- 03 · UNDERSTAND ------------------------ */}
        <section className="section" aria-labelledby="moment-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">03</span>
              <h2 id="moment-heading">Understand what may be happening</h2>
              <span className="aside">A worked example</span>
            </div>
            <div className="section-intro">
              <p>
                It starts with something you noticed. Ciatta reads that against your own
                history and against published evidence, then says what it found, what it
                cannot establish, and what may be worth raising.
              </p>
            </div>

            <div className="finding">
              <div className="surface is-shell is-lifted finding-main">
                <span className="pill is-measured finding-register">
                  <i aria-hidden="true" />
                  Finding
                </span>
                <p className="statement finding-sentence">
                  Your two shortest cycles followed your two lowest-sleep weeks.
                </p>
                <dl className="finding-parts">
                  {MOMENT.map((m) => (
                    <div className="nested finding-part" key={m.q}>
                      <dt>{m.q}</dt>
                      <dd>{m.a}</dd>
                    </div>
                  ))}
                </dl>
                <p className="chart-note">
                  Things that move together are not one causing the other. Ciatta has not
                  established a mechanism here, and it says so.
                </p>
              </div>
              <CycleChart />
            </div>
          </div>
        </section>

        {/* --------------------------- 04 · PREPARE ------------------------- */}
        <section className="section" aria-labelledby="prepare-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">04</span>
              <h2 id="prepare-heading">Go into your next appointment prepared</h2>
            </div>
            <div className="section-intro">
              <p className="statement">
                Ten minutes is not long enough to remember six months.
              </p>
              <p>
                Symptoms, cycles, sleep, medications, supplements, labs and the things you
                noticed yourself. Instead of reconstructing all of it from memory in the
                room, you arrive with it already in front of you, and with the sources
                still attached.
              </p>
            </div>

            <div className="surface is-shell is-lifted">
              <span className="eyebrow">What you walk in with</span>
              <dl className="prepared">
                {PREPARED.map(([k, v]) => (
                  <div className="nested prepared-row" key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="note">
              You and your clinician make the decisions. Ciatta is not in the room and
              does not diagnose, prescribe or offer a second opinion. It gets you there
              better prepared and better informed.
            </p>
          </div>
        </section>

        {/* ------------------------------- TRUST --------------------------- */}
        <section className="section" aria-labelledby="trust-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">05</span>
              <h2 id="trust-heading">Know where every part of it came from</h2>
            </div>
            <div className="section-intro">
              <p>
                Four kinds only: measured, you told Ciatta, published evidence, or Ciatta
                worked it out. What is missing is on the list too, because an absence is
                part of how much to believe.
              </p>
            </div>

            <div className="surface is-shell">
              <div className="chain">
                {CHAIN.map((row) => (
                  <div
                    key={row.what}
                    className={
                      'inference' in row && row.inference
                        ? 'nested chain-row is-inference'
                        : 'nested chain-row'
                    }
                  >
                    <span className="chain-what">{row.what}</span>
                    <span className={`pill is-${row.family}`}>{row.src}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-grid cols-2 refusals">
              {REFUSALS.map(([head, sub]) => (
                <div className="surface refusal" key={head}>
                  <b>{head}</b>
                  <span>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------- CTA ---------------------------- */}
        <section className="section" aria-labelledby="cta-heading">
          <div className="shell close-inner">
            <div className="section-head">
              <span className="section-num">06</span>
              <h2 id="cta-heading">See your health differently</h2>
            </div>
            <p className="display">
              Something feels different, and you cannot quite explain it.
            </p>
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
        <nav className="footer-nav" aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@ciatta.app">Contact</a>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Ciatta</p>
      </footer>
    </>
  );
}

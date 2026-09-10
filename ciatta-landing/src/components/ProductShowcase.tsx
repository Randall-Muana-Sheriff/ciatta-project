import { useEffect, useRef, useState } from 'react';

/**
 * Product showcase — seven fully rendered app screens, fanned, with the
 * Finding as the anchor.
 *
 * Screens are drawn at iPhone 17 Pro proportions: 402 x 874 pt, per
 * layout.md › Specifications. They carry real chrome, so they read as an app
 * rather than as cards: status bar, navigation bar, content that fills the
 * height, a tab bar, and a home indicator.
 *
 * The ground is Ciatta's own dark resolution (Graphite canvas, Raised
 * surfaces, Paper ink), which is the neutral premium ground the system already
 * defines. It also does what the reference does: dark screens on a light page
 * separate cleanly without needing borders.
 *
 * Navigation follows the four peers the architecture names: Today, Body,
 * Timeline, Record. Labels stay visible and there are no badges anywhere,
 * which is both the HIG's guidance and the Constitution's harder rule.
 *
 * The fan is a depiction, so it is aria-hidden and the same narrative is given
 * to screen readers as an ordered list beneath it.
 */

const TABS = ['Today', 'My Health'] as const;

function Chrome({
  title,
  tab = 'My Health',
  children,
}: {
  title: string;
  tab?: (typeof TABS)[number];
  children: React.ReactNode;
}) {
  return (
    <div className="ps-phone">
      <div className="ps-screen">
        <div className="ps-status">
          <span className="ps-time">9:41</span>
          <span className="ps-status-r" aria-hidden="true">
            <svg viewBox="0 0 18 12" className="ps-sig"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity="0.4"/></svg>
            <svg viewBox="0 0 24 12" className="ps-batt"><rect x="0.6" y="0.6" width="19" height="10.8" rx="3" fill="none" strokeWidth="1.2"/><rect x="2.2" y="2.2" width="13" height="7.6" rx="1.6"/><path d="M21.4 4.2v3.6a2.2 2.2 0 0 0 0-3.6Z"/></svg>
          </span>
        </div>

        <div className="ps-nav">
          <svg viewBox="0 0 8 14" className="ps-chev" aria-hidden="true"><path d="M7 1 1 7l6 6" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="ps-nav-title">{title}</span>
          <svg viewBox="0 0 14 14" className="ps-info" aria-hidden="true"><circle cx="7" cy="7" r="6.2" fill="none" strokeWidth="1.2"/><path d="M7 6.2v4M7 3.9v.1" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </div>

        <div className="ps-body">{children}</div>

        <div className="ps-tabs" aria-hidden="true">
          {TABS.map((t) => (
            <span key={t} className={t === tab ? 'ps-tab is-on' : 'ps-tab'}>{t}</span>
          ))}
        </div>
        <span className="ps-home" aria-hidden="true" />
      </div>
    </div>
  );
}

/* --- 1. Cycle --------------------------------------------------------------- */
function CycleScreen() {
  const pts = [29, 29, 28, 28, 27, 27, 26, 26];
  const W = 150, H = 54;
  const x = (i: number) => 2 + (i / (pts.length - 1)) * (W - 4);
  const y = (d: number) => H - 4 - ((d - 25) / 5) * (H - 12);
  return (
    <Chrome title="Cycle length" tab="My Health">
      <div className="ps-hero">
        <span className="ps-hero-n">26<i>d</i></span>
        <span className="ps-delta">3 days shorter than your usual</span>
      </div>
      <svg className="ps-chart" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={pts.map((d, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(d)}`).join(' ')}
              fill="none" stroke="var(--ps-measured)" strokeWidth="1.5" />
        {pts.map((d, i) => <circle key={i} cx={x(i)} cy={y(d)} r="1.7" fill="var(--ps-measured)" />)}
        <circle cx={x(7)} cy={y(26)} r="3.4" fill="none" stroke="var(--ps-clay)" strokeWidth="1.1" />
      </svg>
      <span className="ps-axis-row"><span>Jan</span><span>Dec</span></span>
      <ul className="ps-list">
        <li><span>Shortest</span><b>26 days</b></li>
        <li><span>Your usual</span><b>29 days</b></li>
        <li><span>Range this year</span><b>26 to 29</b></li>
      </ul>
      <p className="ps-foot">Measured against your own history, not an average.</p>
    </Chrome>
  );
}

/* --- 2. Sleep --------------------------------------------------------------- */
function SleepScreen() {
  const bars = [7.1, 6.9, 7.2, 6.1, 6.8, 7.0, 5.9, 6.7, 7.1, 6.9, 7.0, 6.8];
  const low = [3, 6];
  return (
    <Chrome title="Sleep" tab="My Health">
      <div className="ps-hero">
        <span className="ps-hero-n">6<i>h</i> 12<i>m</i></span>
        <span className="ps-delta">against your usual 7h 05m</span>
      </div>
      <div className="ps-bars" aria-hidden="true">
        {bars.map((v, i) => (
          <span key={i} className={low.includes(i) ? 'ps-bar is-low' : 'ps-bar'}
                style={{ height: `${((v - 5.4) / 2.2) * 100}%` }} />
        ))}
      </div>
      <span className="ps-axis-row"><span>Jan</span><span>Dec</span></span>
      <ul className="ps-list">
        <li><span>Week of 11 Mar</span><b>6h 04m</b></li>
        <li><span>Week of 18 Mar</span><b>5h 54m</b></li>
      </ul>
      <p className="ps-foot">Two weeks fell furthest below your own average.</p>
    </Chrome>
  );
}

/* --- 3. Symptoms ------------------------------------------------------------ */
function SymptomsScreen() {
  const rows = [
    { name: 'Disrupted sleep', at: 18, w: 34, tone: 'reported' },
    { name: 'Night sweats', at: 46, w: 20, tone: 'reported' },
    { name: 'Cycle shortened', at: 40, w: 46, tone: 'measured' },
    { name: 'Low energy', at: 58, w: 26, tone: 'reported' },
  ];
  return (
    <Chrome title="Symptoms" tab="My Health">
      <p className="ps-lead">Across the same twelve months.</p>
      <div className="ps-tracks" aria-hidden="true">
        {rows.map((r) => (
          <div className="ps-track" key={r.name}>
            <span className="ps-track-name">{r.name}</span>
            <span className="ps-rail">
              <span className={`ps-span is-${r.tone}`} style={{ left: `${r.at}%`, width: `${r.w}%` }} />
            </span>
          </div>
        ))}
      </div>
      <span className="ps-axis-row"><span>Jan</span><span>Dec</span></span>
      <ul className="ps-list">
        <li><span>First noted</span><b>14 Mar</b></li>
        <li><span>Still present</span><b>Yes</b></li>
      </ul>
      <p className="ps-foot">Four of these overlap the weeks your cycle shortened.</p>
    </Chrome>
  );
}

/* --- 4. Medications --------------------------------------------------------- */
function MedsScreen() {
  const items = [
    { d: '2 Feb', t: 'Started', n: 'Iron, 24 mg', tone: 'reported' },
    { d: '14 Mar', t: 'Changed', n: 'Magnesium, evening', tone: 'reported' },
    { d: '30 Apr', t: 'Stopped', n: 'Iron', tone: 'historical' },
  ];
  return (
    <Chrome title="Medications" tab="My Health">
      <p className="ps-lead">What you were taking, and when.</p>
      <ol className="ps-events">
        {items.map((it) => (
          <li key={it.d} className={`is-${it.tone}`}>
            <span className="ps-dot" aria-hidden="true" />
            <span className="ps-ev-date">{it.d}</span>
            <span className="ps-ev-body"><b>{it.t}</b><span>{it.n}</span></span>
          </li>
        ))}
      </ol>
      <div className="ps-panel">
        <span className="ps-panel-k">Currently taking</span>
        <span className="ps-panel-v">Magnesium, 300 mg</span>
      </div>
      <p className="ps-foot">You logged these. No source can overwrite them.</p>
    </Chrome>
  );
}

/* --- 5. What she told Ciatta ------------------------------------------------ */
function ToldScreen() {
  return (
    <Chrome title="Your notes" tab="My Health">
      <p className="ps-lead">Kept as yours, in the same timeline.</p>
      <blockquote className="ps-quote">
        &ldquo;Stressful stretch at work.&rdquo;<cite>14 March</cite>
      </blockquote>
      <blockquote className="ps-quote">
        &ldquo;Stopped sleeping through the night.&rdquo;<cite>18 March</cite>
      </blockquote>
      <blockquote className="ps-quote">
        &ldquo;Warmer at night than usual.&rdquo;<cite>2 April</cite>
      </blockquote>
      <div className="ps-action">Add what changed</div>
      <p className="ps-foot">Your words are evidence, not a note beside it.</p>
    </Chrome>
  );
}

/* --- 6. Labs ---------------------------------------------------------------- */
function LabsScreen() {
  const rows: [string, string, string][] = [
    ['Ferritin', '34 ng/mL', 'Quest'],
    ['TSH', '2.1 mIU/L', 'Quest'],
    ['Vitamin D', '28 ng/mL', 'Quest'],
    ['Haemoglobin', '13.1 g/dL', 'Quest'],
  ];
  return (
    <Chrome title="Labs" tab="My Health">
      <p className="ps-lead">Drawn 2 February.</p>
      <table className="ps-table">
        <tbody>
          {rows.map(([k, v, src]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td className="ps-val">{v}</td>
              <td className="ps-src">{src}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ps-gap">
        <span className="ps-dash" aria-hidden="true" />
        Three months are not in the record.
      </div>
      <p className="ps-foot">Every value carries its date and its source.</p>
    </Chrome>
  );
}

/* --- The centre: a personalized insight, carried through to what to do ---- */
function InsightScreen() {
  const parts: [string, string][] = [
    ['What changed', 'Cycle length decreased from 29 to 26 days.'],
    ['What happened around it', 'Both shorter cycles began within a week of your lowest-sleep weeks.'],
    ['What you told Ciatta', 'You reported a stressful period and disrupted sleep.'],
    ['Worth exploring', 'Whether this pattern continues across your next few cycles.'],
  ];
  return (
    <Chrome title="Your health" tab="Today">
      <span className="ps-tag">Personalized insight</span>
      <p className="ps-finding">
        Your two shortest cycles followed your two lowest-sleep weeks.
      </p>
      <dl className="ps-parts">
        {parts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {/* The two series the insight is about, on one axis. The centre screen is
          the largest thing in the section, so its middle should carry the claim
          rather than sit empty. */}
      <div className="ps-pair">
        <div className="ps-pair-head">
          <span><i className="ps-key is-measured" />Cycle length</span>
          <span><i className="ps-key is-sleep" />Sleep</span>
        </div>
        <svg viewBox="0 0 150 46" className="ps-pair-chart" aria-hidden="true">
          <path d="M2 8 L23 8 L44 14 L65 14 L86 22 L107 22 L128 30 L148 30"
                fill="none" stroke="var(--ps-measured)" strokeWidth="1.5" />
          <path d="M2 26 L23 24 L44 36 L65 27 L86 25 L107 40 L128 28 L148 26"
                fill="none" stroke="var(--ps-ink)" strokeWidth="1.5" opacity="0.55" />
          <circle cx="44" cy="36" r="2.6" fill="var(--ps-clay)" />
          <circle cx="107" cy="40" r="2.6" fill="var(--ps-clay)" />
        </svg>
        <span className="ps-pair-note">The two marked weeks are your lowest-sleep weeks.</span>
      </div>

      {/* The guidance layer. This is the part that stops it being a chart. */}
      <div className="ps-next">
        <span className="ps-next-k">For your next conversation</span>
        <span className="ps-next-v">
          Ask your clinician whether the changes in your sleep and cycle history are
          worth evaluating together.
        </span>
      </div>
      <p className="ps-hedge">
        Things that move together are not one causing the other.
      </p>
      <div className="ps-action is-primary">Open the evidence</div>
    </Chrome>
  );
}

/* Seven positions, far left to far right. Every screen travels the whole
   track and takes its turn at the centre, where it is largest, brightest and
   in front. The centre is a position, so whichever screen arrives there
   becomes the thing the eye lands on. */
const SLOTS = [
  { x: -2.52, y: 15, s: 0.68, z: 3 },
  { x: -1.88, y: 10, s: 0.76, z: 4 },
  { x: -1.12, y: 5,  s: 0.86, z: 5 },
  { x:  0,    y: 0,  s: 1.62, z: 8 },   /* the centre */
  { x:  1.12, y: 5,  s: 0.86, z: 5 },
  { x:  1.88, y: 10, s: 0.76, z: 4 },
  { x:  2.52, y: 15, s: 0.68, z: 3 },
] as const;

const SCREENS = [
  { name: 'Labs', Screen: LabsScreen },
  { name: 'Cycle', Screen: CycleScreen },
  { name: 'Sleep', Screen: SleepScreen },
  { name: 'Personalized insight', Screen: InsightScreen },
  { name: 'Symptoms', Screen: SymptomsScreen },
  { name: 'Medications', Screen: MedsScreen },
  { name: 'What you told Ciatta', Screen: ToldScreen },
] as const;

const N = SCREENS.length;
const HALF = (N - 1) / 2;
const INSIGHT_INDEX = 3;

/* The progression, stated once beneath the fan so it reads at a glance
   without anyone having to read a phone. */
const PROGRESSION = [
  'What changed',
  'What was happening around it',
  'What you told Ciatta',
  'Relevant evidence',
  'What may be worth discussing',
] as const;

export function ProductShowcase() {
  // Opens on the insight, so the first frame is the value.
  const [active, setActive] = useState(INSIGHT_INDEX);
  const [held, setHeld] = useState(false);
  const prevOffsets = useRef<number[]>([]);
  const drag = useRef<{ x: number } | null>(null);

  const step = (d: number) => setActive((a) => (a + d + N) % N);

  useEffect(() => {
    // Motion & Interaction v1.0: nothing auto-advances. The rotation earns its
    // place here, but it stops for reduced motion and while she is driving it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (held) return;
    // `active` is a dependency so the timer re-arms on every change. Without
    // it a manual choice could be overridden a moment later by a tick that was
    // already part-way through its cycle.
    const id = window.setTimeout(() => step(1), 3600);
    return () => window.clearTimeout(id);
  }, [held, active]);

  const offsets = SCREENS.map((_, i) => {
    const raw = (i - active + N) % N;
    return raw > HALF ? raw - N : raw;
  });
  const wrapped = offsets.map((o, i) => {
    const prev = prevOffsets.current[i];
    return prev !== undefined && Math.abs(o - prev) > 1;
  });
  prevOffsets.current = offsets;

  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <div className="shell showcase-intro">
        <h2 id="showcase-heading" className="showcase-title">
          All the pieces. <em>One picture.</em>
        </h2>
        <p className="showcase-lede">Your health doesn&rsquo;t change one thing at a time.</p>
        <p className="showcase-sub">
          Ciatta brings your health information together to surface personalized
          insights, so you can understand what&rsquo;s changing, know what may be worth
          exploring, and have a better conversation with your clinician.
        </p>
      </div>

      <div className="shell">
        <ul className="ps-sources">
          {SCREENS.map(({ name }, i) => (
            <li key={name}>
              <button
                type="button"
                className={
                  'ps-source' +
                  (i === active ? ' is-on' : '') +
                  (i === INSIGHT_INDEX ? ' is-insight' : '')
                }
                aria-current={i === active ? 'true' : undefined}
                onClick={() => setActive(i)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
        <span className="ps-arrow" aria-hidden="true">&darr;</span>
      </div>

      {/* The fan is a depiction. The buttons above carry the same control. */}
      <div
        className="showcase-stage"
        aria-hidden="true"
        onPointerDown={(e) => { drag.current = { x: e.clientX }; setHeld(true); }}
        onPointerUp={(e) => {
          const d = drag.current; drag.current = null; setHeld(false);
          if (d && Math.abs(e.clientX - d.x) > 40) step(e.clientX - d.x < 0 ? 1 : -1);
        }}
        onPointerCancel={() => { drag.current = null; setHeld(false); }}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => { if (!drag.current) setHeld(false); }}
      >
        <div className="ps-fan">
          {SCREENS.map(({ name, Screen }, i) => {
            const slot = SLOTS[offsets[i] + HALF];
            return (
              <div
                key={name}
                className={
                  'ps-slot' +
                  (offsets[i] === 0 ? ' is-centre' : '') +
                  (wrapped[i] ? ' is-rejoining' : '')
                }
                style={{
                  transform: `translateX(calc(-50% + var(--ps-w) * ${slot.x})) translateY(${slot.y}%) scale(${slot.s})`,
                  zIndex: slot.z,
                }}
              >
                <Screen />
              </div>
            );
          })}
        </div>
      </div>

      <div className="shell">
        <span className="ps-arrow" aria-hidden="true">&darr;</span>
        <ol className="ps-progression">
          {PROGRESSION.map((s) => <li key={s}>{s}</li>)}
        </ol>

        <ol className="sr-only">
          <li>Six supporting screens: labs, cycle length, sleep, symptoms, medications, and what you told Ciatta.</li>
          <li>Among them, a personalized insight: your two shortest cycles followed your two lowest-sleep weeks.</li>
          <li>It carries what changed, what was happening around it, what you told Ciatta, what may be worth exploring, and what to ask your clinician.</li>
        </ol>
        <p className="showcase-foot">
          The insight is not a seventh thing Ciatta collected. It is what the other
          six say when they are read together.
        </p>
      </div>
    </section>
  );
}

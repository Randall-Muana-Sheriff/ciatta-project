import { useEffect, useRef, useState } from 'react';
import { Wordmark } from './Wordmark';

/**
 * The hero's interactive product story.
 *
 * Five things arrive, one at a time, and they are deliberately five different
 * kinds of thing: a ring that measures, a portal that holds results, a
 * document a provider sent, a sentence only she can write, and a photograph of
 * lunch. Measured, imported, uploaded, told, and seen. They settle into one
 * screen, which then comes alive: the day draws itself, the figures land, the
 * finding resolves, and one thing worth trying arrives last.
 *
 * What it must not do is narrate Ciatta's reasoning. The steps a woman sees
 * are the sources arriving and the day becoming legible; the work in between
 * is Ciatta's problem, not hers, so nothing here is labelled with it.
 *
 * It runs on a timeline she controls: play, pause, and replay when it ends.
 * Under Reduce Motion it never runs at all — the finished screen is simply
 * there, which is the same information without the performance.
 */

/* -- the timeline ---------------------------------------------------------- *
 * Each step is a state the screen can be paused in and read, so they are
 * named rather than numbered at the point of use.                            */

const S = {
  NOTHING: 0,
  OURA: 1,
  PORTAL: 2,
  DOC: 3,
  NOTE: 4,
  MEAL: 5,
  ASSEMBLE: 6,
  DAY: 7,
  FIGURES: 8,
  FINDING: 9,
  TRY: 10,
  DONE: 11,
} as const;

const STEPS: { at: number; step: number }[] = [
  { at: 0, step: S.NOTHING },
  { at: 300, step: S.OURA },
  { at: 1800, step: S.PORTAL },
  { at: 3300, step: S.DOC },
  { at: 5700, step: S.NOTE },
  { at: 8500, step: S.MEAL },
  { at: 10000, step: S.ASSEMBLE },
  { at: 11100, step: S.DAY },
  { at: 12400, step: S.FIGURES },
  { at: 13500, step: S.FINDING },
  { at: 14700, step: S.TRY },
  { at: 15800, step: S.DONE },
];

const END = STEPS[STEPS.length - 1].at;

/* What she types, and how long it takes her to type it. */
const NOTE = 'I’ve been waking up several times a night and my doctor changed my medication';
const TYPE_AT = 5700;
const TYPE_MS = 2400;

/* -- the five sources ------------------------------------------------------ */

type Source = {
  key: string;
  kind: 'connect' | 'doc' | 'note' | 'photo';
  name: string;
  state: string;
  step: number;
  items?: string[];
  /** a result, its value, and the range it is read against */
  rows?: { label: string; value: string; range: string; flag?: string }[];
  photo?: string;
  meta?: string;
};

const SOURCES: Source[] = [
  {
    key: 'oura', kind: 'connect', step: S.OURA,
    name: 'Oura', state: 'Connected',
    items: ['Sleep', 'HRV', 'Temperature', 'Activity'],
  },
  {
    key: 'portal', kind: 'connect', step: S.PORTAL,
    name: 'St. Luke’s MyChart', state: 'Connected',
    items: ['Lab results', 'Medications', 'Visit history'],
  },
  {
    key: 'doc', kind: 'doc', step: S.DOC,
    name: 'Bloodwork results.pdf', state: 'From your provider · 2 Sep',
    rows: [
      { label: 'Ferritin', value: '18 ng/mL', range: '15 – 150', flag: 'Low end' },
      { label: 'Haemoglobin', value: '11.8 g/dL', range: '12.0 – 15.5', flag: 'Below' },
      { label: 'TSH', value: '3.9 mIU/L', range: '0.4 – 4.0' },
    ],
    meta: 'Read from the document you uploaded',
  },
  {
    key: 'note', kind: 'note', step: S.NOTE,
    name: 'Your own words', state: 'Told to Ciatta · today',
  },
  {
    key: 'meal', kind: 'photo', step: S.MEAL,
    name: 'Lunch', state: 'Food · Today',
    photo: '/images/story/meal.jpg', meta: 'Added from your camera',
  },
];

/* -- the day --------------------------------------------------------------- *
 * The line is her energy through the hours that have happened, and it stops
 * where now is: Ciatta does not draw a day it has not seen yet.              */

const W = 132;
const TOP = 3;
const BASE = 30;
const RAIL = 36;
const NOW = 16.3;
const WOKE = 6.43;

const ENERGY: [number, number][] = [
  [6.43, 44], [7.5, 55], [8.5, 62], [9.5, 65], [10.5, 59], [11.5, 52],
  [12.5, 46], [13.5, 40], [14.5, 35], [15.5, 31], [NOW, 30],
];
/* what she logged, and how strongly, all of it before now */
const PAIN: [number, number][] = [[9.5, 1], [11, 2], [15.5, 3]];

const x = (h: number) => (h / 24) * W;
const y = (v: number) => BASE - ((v - 20) / 55) * (BASE - TOP);

/**
 * A Catmull-Rom spline written as cubic béziers: the curve passes through
 * every reading rather than near it, and arrives at each one without the
 * corner a polyline leaves behind.
 */
function smooth(points: [number, number][], tension = 0.9): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

const CURVE = ENERGY.map(([h, v]) => [x(h), y(v)] as [number, number]);
const LINE = smooth(CURVE);
const AREA = `${LINE} L${x(NOW).toFixed(2)},${BASE} L${x(WOKE).toFixed(2)},${BASE} Z`;

function Day({ drawn, now }: { drawn: boolean; now: boolean }) {
  return (
    <svg
      className="ha-chart" viewBox={`0 0 ${W} 40`} role="img"
      data-drawn={drawn ? 'y' : 'n'} data-now={now ? 'y' : 'n'}
      aria-label="Maya's day: asleep until 6:26am, energy rising to mid-morning and falling through the afternoon, and pain logged three times."
    >
      <defs>
        <linearGradient id="hs-under" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.26" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* the night she has already had */}
      <rect x="0" y="0" width={x(WOKE)} height={BASE} rx="2" fill="#FFFFFF" opacity="0.13" />
      <text x="2.5" y="5.6" fill="#FFFFFF" fillOpacity="0.62" fontSize="3.4" letterSpacing="0.3">ASLEEP</text>

      {/* her own usual, not a general one, and only across the hours she was awake */}
      <line x1={x(WOKE)} x2={W} y1={y(48)} y2={y(48)} stroke="#FFFFFF" strokeOpacity="0.26" strokeDasharray="1.6 2.4" strokeWidth="0.6" />
      <line x1="0" x2={W} y1={BASE} y2={BASE} stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="0.6" />

      <path className="hs-area" d={AREA} fill="url(#hs-under)" />
      <path
        className="hs-line" d={LINE} pathLength={1}
        fill="none" stroke="#FFFFFF" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* where now is, and the reading it sits on */}
      <line className="hs-now" x1={x(NOW)} x2={x(NOW)} y1={TOP - 2} y2={RAIL} stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.55" />
      <circle className="hs-nowdot" cx={x(NOW)} cy={y(30)} r="2" fill="#FFFFFF" />

      {/* what she logged, on its own rail so it does not fight the line */}
      {PAIN.map(([h, sev], i) => (
        <g className="hs-pain" key={h} style={{ transitionDelay: `${240 + i * 130}ms` }}>
          <line x1={x(h)} x2={x(h)} y1={BASE} y2={RAIL} stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="0.5" />
          <circle cx={x(h)} cy={RAIL} r={1 + sev * 0.75} fill="#FFFFFF" opacity="0.92" />
        </g>
      ))}
    </svg>
  );
}

const METRICS: [string, string][] = [['Sleep', '6h 46m'], ['HRV', '38 ms'], ['Pain', '3 logs']];

/* -- a source, in whichever shape it arrives in ---------------------------- */

function Card({ source, typed }: { source: Source; typed: number }) {
  if (source.kind === 'doc') {
    return (
      <div className="hs-card is-doc">
        <div className="hs-doc-head">
          <span className="hs-pdf" aria-hidden="true">PDF</span>
          <span className="hs-source-b">
            <b>{source.name}</b>
            <i>{source.state}</i>
          </span>
        </div>
        <ul className="hs-rows">
          {source.rows!.map((r, i) => (
            <li key={r.label} style={{ transitionDelay: `${160 + i * 120}ms` }}>
              <span className="hs-row-k">{r.label}</span>
              <span className="hs-row-v">{r.value}</span>
              <span className="hs-row-r">{r.range}</span>
              {r.flag && <span className="hs-row-f">{r.flag}</span>}
            </li>
          ))}
        </ul>
        <span className="hs-meta">{source.meta}</span>
      </div>
    );
  }

  if (source.kind === 'note') {
    return (
      <div className="hs-card is-note">
        <span className="hs-note-label">{source.state}</span>
        <p className="hs-field">
          {NOTE.slice(0, typed)}
          <span className="hs-caret" aria-hidden="true" />
        </p>
      </div>
    );
  }

  return (
    <div className="hs-card">
      {source.photo ? (
        <img src={source.photo} alt="" width={120} height={90} loading="lazy" decoding="async" />
      ) : (
        <span className="hs-dotlight" />
      )}
      <span className="hs-source-b">
        <b>{source.name}</b>
        <i>{source.state}</i>
      </span>
      {source.items && (
        <span className="hs-chips">
          {source.items.map((it, j) => (
            <em key={it} style={{ transitionDelay: `${j * 110}ms` }}>{it}</em>
          ))}
        </span>
      )}
      {source.meta && !source.items && <span className="hs-meta">{source.meta}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function HeroStory() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [step, setStep] = useState<number>(reduced ? S.DONE : S.NOTHING);
  const [typed, setTyped] = useState(reduced ? NOTE.length : 0);
  const [playing, setPlaying] = useState(!reduced);
  const frame = useRef<number | null>(null);
  const clock = useRef(0);

  useEffect(() => {
    if (reduced || !playing) return;
    const started = performance.now() - clock.current;
    const tick = () => {
      const t = performance.now() - started;
      clock.current = t;

      const next = STEPS.filter((s) => s.at <= t).pop();
      if (next) setStep(next.step);

      const chars = Math.round(((t - TYPE_AT) / TYPE_MS) * NOTE.length);
      setTyped((was) => {
        const now = Math.max(0, Math.min(NOTE.length, chars));
        return now === was ? was : now;
      });

      if (t >= END) {
        setPlaying(false);
        return;
      }
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [playing, reduced]);

  const done = step >= S.DONE;
  const replay = () => {
    clock.current = 0;
    setStep(S.NOTHING);
    setTyped(0);
    setPlaying(true);
  };

  return (
    <div className="hs" data-step={step} data-phase={step >= S.ASSEMBLE ? 'screen' : 'sources'}>
      <div className="hs-stage">
        <ul className="hs-sources">
          {SOURCES.map((s) => (
            <li
              key={s.key}
              className={`hs-source is-${s.key}`}
              data-state={step < s.step ? 'wait' : step === s.step ? 'in' : 'gone'}
              aria-hidden="true"
            >
              <Card source={s} typed={typed} />
            </li>
          ))}
        </ul>

        <div className="ha-device hs-device">
          <div className="ha">
            <div className="ha-status">
              <span className="ha-time">9:41</span>
              <span className="ha-island" />
              <span className="ha-sys">
                <svg viewBox="0 0 18 12" className="ha-sig"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity="0.45"/></svg>
                <svg viewBox="0 0 16 12" className="ha-wifi" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1.4 4.2a9.5 9.5 0 0 1 13.2 0"/><path d="M4 6.8a6 6 0 0 1 8 0"/><path d="M6.6 9.3a2.4 2.4 0 0 1 2.8 0"/></svg>
                <svg viewBox="0 0 24 12" className="ha-batt"><rect x="0.6" y="0.6" width="19" height="10.8" rx="3" fill="none" strokeWidth="1.2" stroke="currentColor"/><rect x="2.2" y="2.2" width="13" height="7.6" rx="1.6" fill="currentColor"/><path d="M21.4 4.2v3.6a2.2 2.2 0 0 0 0-3.6Z" fill="currentColor"/></svg>
              </span>
            </div>

            {/* Oura's shape: the mark sits alone at the top of the screen and
                the day introduces itself underneath. The wordmark is the real
                component, so it is built the same way here as in the bar. */}
            <div className="ha-nav">
              <span className="sr-only">Ciatta</span>
              <Wordmark size="sm" />
            </div>

            {/* the greeting names the woman, and the screen names itself
                beside it rather than above the whole thing */}
            <div className="ha-greet hs-fade" data-shown={step >= S.ASSEMBLE ? 'y' : 'n'}>
              <p className="ha-hello">Good afternoon, Maya.</p>
              <span className="ha-when">Today</span>
            </div>

            <div className="ha-day hs-fade" data-shown={step >= S.DAY ? 'y' : 'n'}>
              <div className="ha-day-head">
                <span>Your day so far</span>
                <span>Menstrual · day 5</span>
              </div>
              <Day drawn={step >= S.DAY} now={step >= S.FIGURES} />
              <div className="ha-axis">
                <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
              </div>
            </div>

            <ul className="ha-metrics hs-fade" data-shown={step >= S.FIGURES ? 'y' : 'n'}>
              {METRICS.map(([k, v], i) => (
                <li key={k} style={{ transitionDelay: `${i * 120}ms` }}>
                  <span>{k}</span>
                  <b>{v}</b>
                </li>
              ))}
            </ul>

            <div className="ha-insight hs-fade" data-shown={step >= S.FINDING ? 'y' : 'n'}>
              <span className="ha-tag">Today</span>
              <p>Your afternoon pain has been higher following nights under 7 hours.</p>
              <span className="ha-basis">You’ve seen this on 3 days this month.</span>
              <span className="ha-basis hs-second" data-shown={step >= S.TRY ? 'y' : 'n'}>
                Two of those days also followed unusually long workdays.
              </span>
            </div>

            <div className="ha-try hs-fade" data-shown={step >= S.TRY ? 'y' : 'n'}>
              <div>
                <b>Wind down by 10:30pm</b>
                <i>Your last 3 nights started after 11:40pm.</i>
              </div>
              <span>For today</span>
            </div>
          </div>
        </div>
      </div>

      {!reduced && (
        <div className="hs-controls">
          <button
            type="button"
            className="hs-btn"
            onClick={() => (done ? replay() : setPlaying((p) => !p))}
          >
            <span className="sr-only">
              {done ? 'Replay the story' : playing ? 'Pause the story' : 'Play the story'}
            </span>
            <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              {done ? (
                <>
                  <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.15" />
                  <path d="M13.6 2.4v3.2h-3.2" />
                </>
              ) : playing ? (
                <><path d="M6 3.5v9M10 3.5v9" /></>
              ) : (
                <path d="M5.5 3.4 12.5 8l-7 4.6V3.4Z" fill="currentColor" />
              )}
            </svg>
          </button>
          <span className="hs-progress" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (step / S.DONE) * 100)}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}

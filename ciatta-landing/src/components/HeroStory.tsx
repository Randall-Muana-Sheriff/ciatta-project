import { useEffect, useRef, useState } from 'react';

/**
 * The hero's interactive product story.
 *
 * Three things arrive — a ring, a portal, a photograph of lunch — and settle
 * into one screen, which then comes alive: the day draws itself, the figures
 * land, the finding resolves, and one thing worth trying arrives last.
 *
 * What it must not do is narrate Ciatta's reasoning. The steps a woman sees
 * are the sources arriving and the day becoming legible; the work in between
 * is Ciatta's problem, not hers, so nothing here is labelled with it.
 *
 * It runs on a timeline she controls: play, pause, and replay when it ends.
 * Under Reduce Motion it never runs at all — the finished screen is simply
 * there, which is the same information without the performance.
 */

type Source = {
  key: string;
  name: string;
  state: string;
  items: string[];
  photo?: string;
  meta?: string;
};

const SOURCES: Source[] = [
  { key: 'oura', name: 'Oura', state: 'Connected', items: ['Sleep', 'HRV', 'Temperature', 'Activity'] },
  { key: 'portal', name: 'St. Luke’s MyChart', state: 'Connected', items: ['Lab results', 'Medications', 'Visit history'] },
  { key: 'meal', name: 'Lunch', state: 'Food · Today', items: [], photo: '/images/story/meal.jpg', meta: 'Added from your camera' },
];

/* The timeline, in milliseconds from the start. Each step is a state the
   screen can be paused in and read. */
const STEPS = [
  { at: 0, step: 0 },      // nothing yet
  { at: 500, step: 1 },    // the ring
  { at: 2100, step: 2 },   // the portal
  { at: 3700, step: 3 },   // the photograph
  { at: 5300, step: 4 },   // everything moves into the screen
  { at: 6600, step: 5 },   // the day draws
  { at: 8000, step: 6 },   // the figures land
  { at: 9200, step: 7 },   // the finding resolves
  { at: 10600, step: 8 },  // what to try, last
  { at: 11800, step: 9 },  // done
] as const;

const LAST = STEPS[STEPS.length - 1];

const ENERGY: [number, number][] = [
  [6, 52], [8, 61], [10, 58], [12, 44], [14, 38], [16, 33], [18, 41], [20, 47], [22, 40],
];
const PAIN: [number, number][] = [[11, 2], [15.5, 3], [20, 1]];
const NOW = 16.3;

function Day({ drawn }: { drawn: boolean }) {
  const W = 132;
  const H = 34;
  const x = (h: number) => (h / 24) * W;
  const y = (v: number) => H - (v / 100) * H;
  const line = ENERGY.map(([h, v], i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="ha-chart" viewBox={`0 -3 ${W} ${H + 8}`} role="img"
         aria-label="Maya's day: sleep overnight, energy through the day, and pain logged three times.">
      <rect x="0" y="-3" width={x(6.43)} height={H + 3} fill="#FFFFFF" opacity="0.14" rx="1.5" />
      <rect x={x(23.67)} y="-3" width={W - x(23.67)} height={H + 3} fill="#FFFFFF" opacity="0.14" rx="1.5" />
      <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="#FFFFFF" strokeOpacity="0.3" strokeDasharray="2 2" />
      <path
        className={drawn ? 'hs-line is-drawn' : 'hs-line'}
        d={line} fill="none" stroke="#FFFFFF" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {PAIN.map(([h, sev], i) => (
        <circle key={h} className="hs-dot" style={{ transitionDelay: `${260 + i * 140}ms` }}
                cx={x(h)} cy={y(20)} r={1.6 + sev * 0.9} fill="#FFFFFF" opacity="0.92" />
      ))}
      <line className="hs-now" x1={x(NOW)} x2={x(NOW)} y1={-3} y2={H} stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
    </svg>
  );
}

const METRICS: [string, string][] = [['Sleep', '6h 46m'], ['HRV', '38 ms'], ['Pain', '3 logs']];

export function HeroStory() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [step, setStep] = useState(reduced ? 9 : 0);
  const [playing, setPlaying] = useState(!reduced);
  const timer = useRef<number | null>(null);
  const clock = useRef(0);

  useEffect(() => {
    if (reduced || !playing) return;
    const started = performance.now() - clock.current;
    const tick = () => {
      const t = performance.now() - started;
      clock.current = t;
      const next = STEPS.filter((s) => s.at <= t).pop();
      if (next) setStep(next.step);
      if (t >= LAST.at) {
        setPlaying(false);
        return;
      }
      timer.current = window.requestAnimationFrame(tick);
    };
    timer.current = window.requestAnimationFrame(tick);
    return () => {
      if (timer.current) window.cancelAnimationFrame(timer.current);
    };
  }, [playing, reduced]);

  const done = step >= 9;
  const replay = () => {
    clock.current = 0;
    setStep(0);
    setPlaying(true);
  };

  return (
    <div className="hs" data-step={step}>
      <div className="hs-stage">
        <ul className="hs-sources">
          {SOURCES.map((s, i) => (
            <li key={s.key} className={`hs-source is-${s.key}`} data-shown={step > i ? 'y' : 'n'} aria-hidden="true">
              {s.photo ? (
                <img src={s.photo} alt="" width={120} height={90} loading="lazy" decoding="async" />
              ) : (
                <span className="hs-dotlight" />
              )}
              <span className="hs-source-b">
                <b>{s.name}</b>
                <i>{s.state}</i>
              </span>
              {s.items.length > 0 && (
                <span className="hs-chips">
                  {s.items.map((it, j) => (
                    <em key={it} style={{ transitionDelay: `${j * 110}ms` }}>{it}</em>
                  ))}
                </span>
              )}
              {s.meta && <span className="hs-meta">{s.meta}</span>}
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

            <div className="ha-nav">Today</div>

            <p className="ha-hello hs-fade" data-shown={step >= 4 ? 'y' : 'n'}>Good afternoon, Maya.</p>

            <div className="ha-day hs-fade" data-shown={step >= 5 ? 'y' : 'n'}>
              <div className="ha-day-head">
                <span>Your day so far</span>
                <span>Menstrual · day 5</span>
              </div>
              <Day drawn={step >= 5} />
              <div className="ha-axis">
                <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
              </div>
            </div>

            <ul className="ha-metrics hs-fade" data-shown={step >= 6 ? 'y' : 'n'}>
              {METRICS.map(([k, v], i) => (
                <li key={k} style={{ transitionDelay: `${i * 120}ms` }}>
                  <span>{k}</span>
                  <b>{v}</b>
                </li>
              ))}
            </ul>

            <div className="ha-insight hs-fade" data-shown={step >= 7 ? 'y' : 'n'}>
              <span className="ha-tag">Today</span>
              <p>Your afternoon pain has been higher following nights under 7 hours.</p>
              <span className="ha-basis">You’ve seen this on 3 days this month.</span>
              <span className="ha-basis hs-second" data-shown={step >= 8 ? 'y' : 'n'}>
                Two of those days also followed unusually long workdays.
              </span>
            </div>

            <div className="ha-try hs-fade" data-shown={step >= 8 ? 'y' : 'n'}>
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
            <i style={{ width: `${Math.min(100, (step / 9) * 100)}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}

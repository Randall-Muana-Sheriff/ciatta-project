import { Wordmark } from './Wordmark';

/**
 * Maya's Today screen, and the day drawn on it.
 *
 * It lives here rather than inside the hero because the hero is not the only
 * place it appears: the step below it that says "see what changed, and what
 * sat beside it" is about this screen, and showing a second drawing of the
 * same screen there would be a drawing of a screen rather than the screen.
 *
 * `step` is how far through the hero's story it is. Anything at or past
 * S.DONE is the finished screen, which is what every other use of it wants.
 */

/* -- how far through the day's arrival each part is ------------------------ */

export const S = {
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


export function TodayScreen({ step = S.DONE }: { step?: number }) {
  return (
    <>
            {/* Oura's shape: the mark sits alone at the top of the screen and
                the day introduces itself underneath. The wordmark is the real
                component, so it is built the same way here as in the bar. */}
            <div className="ha-nav">
              <span className="sr-only">Ciatta</span>
              <Wordmark size="sm" />
            </div>

            <p className="ha-hello hs-fade" data-shown={step >= S.ASSEMBLE ? 'y' : 'n'}>Good afternoon, Maya.</p>

            <div className="ha-day hs-fade" data-shown={step >= S.DAY ? 'y' : 'n'}>
              <div className="ha-day-head">
                <span>Today’s patterns</span>
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
              <span className="ha-tag">Insights</span>
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
    </>
  );
}

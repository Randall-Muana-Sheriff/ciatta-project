/**
 * The app, drawn for the hero and nothing else.
 *
 * The screens further down the page size themselves in container-query units
 * so one component can be drawn at any scale. That is the right trade there
 * and the wrong one here: in the hero this has to render on every engine, on
 * the first paint, over a moving image, and a chain of container units,
 * custom-property widths and derived heights gave Safari on iOS a reason not
 * to draw anything at all.
 *
 * So this is the same day, written plainly: fixed rem sizes, one SVG with a
 * viewBox, no container queries and no computed geometry. It carries what the
 * hero needs to prove — the day, what Ciatta made of it, and what it suggests
 * — and nothing else. It is the top of a screen rather than a whole one, so
 * it carries no tab bar and fades out at the foot instead of ending.
 */

const ENERGY: [number, number][] = [
  [6, 52], [8, 61], [10, 58], [12, 44], [14, 38], [16, 33], [18, 41], [20, 47], [22, 40],
];
const PAIN: [number, number][] = [[11, 2], [15.5, 3], [20, 1]];
const NOW = 16.3;

function DayFigure() {
  const W = 132;
  const H = 34;
  const x = (h: number) => (h / 24) * W;
  const y = (v: number) => H - (v / 100) * H;
  const line = ENERGY.map(([h, v], i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="ha-chart" viewBox={`0 -3 ${W} ${H + 8}`} role="img"
         aria-label="Maya's day: sleep overnight, energy falling through the afternoon, and pain logged three times.">
      <rect x="0" y="-3" width={x(6.43)} height={H + 3} fill="#FFFFFF" opacity="0.14" rx="1.5" />
      <rect x={x(23.67)} y="-3" width={W - x(23.67)} height={H + 3} fill="#FFFFFF" opacity="0.14" rx="1.5" />
      <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="#FFFFFF" strokeOpacity="0.3" strokeDasharray="2 2" />
      <path d={line} fill="none" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {PAIN.map(([h, sev]) => (
        <circle key={h} cx={x(h)} cy={y(20)} r={1.6 + sev * 0.9} fill="#FFFFFF" opacity="0.92" />
      ))}
      <line x1={x(NOW)} x2={x(NOW)} y1={-3} y2={H} stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
    </svg>
  );
}

const METRICS: [string, string][] = [
  ['Sleep', '6h 46m'],
  ['HRV', '38 ms'],
  ['Pain', '3 logs'],
];

export function HeroApp() {
  return (
    <div className="ha-device" aria-hidden="true">
      <div className="ha">
        {/* the device's own furniture: the island, the clock and the three
            indicators, at iPhone 17 Pro proportions */}
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

        <p className="ha-hello">Good afternoon, Maya.</p>

        <div className="ha-after">
        <span>Since you tried an earlier wind-down</span>
        <p>Sleep closer to your usual on 5 of 7 nights.</p>
      </div>

        <div className="ha-day">
        <div className="ha-day-head">
          <span>Your day so far</span>
          <span>Menstrual · day 5</span>
        </div>
        <DayFigure />
        <div className="ha-axis">
          <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
        </div>
      </div>

        <ul className="ha-metrics">
        {METRICS.map(([k, v]) => (
          <li key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </li>
        ))}
      </ul>

        <div className="ha-insight">
        <span className="ha-tag">What may be connected</span>
        <p>Afternoon pain has been higher after nights under 7 hours.</p>
        <span className="ha-basis">Seen 3 times this month</span>
      </div>

        <div className="ha-try">
          <div>
            <b>Wind down by 10:30pm</b>
            <i>Your last 3 nights began after 11:40pm</i>
          </div>
          <span>Tonight</span>
        </div>
      </div>
    </div>
  );
}

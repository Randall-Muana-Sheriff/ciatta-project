import { LabScreen } from './ProductShowcase';

/**
 * "Your lab results shouldn't live in a PDF."
 *
 * Three states of the same result, left to right: the document as it arrived,
 * the values read out of it, and the same value across every panel she has.
 * Then the four registers the product already uses — measured, observed,
 * context, and the question those leave her with — set as a list rather than
 * as a verdict. Ferritin 32, 24, 18 agrees with the 14 Mar Quest panel the
 * rest of the site documents.
 */

const SERIES: [string, number][] = [
  ['12 Aug', 32],
  ['14 Mar', 24],
  ['2 Sep', 18],
];

const ALONGSIDE: [string, string][] = [
  ['Fatigue', 'Reported more often'],
  ['Sleep', 'Lower than your usual'],
  ['Bleeding', 'Heavier, reported twice'],
  ['Cycle', 'Shortened by three days'],
];

const READ: [string, string][] = [
  ['Measured', '18 ng/mL, 2 Sep. Reference range 15 to 150.'],
  ['Observed', 'Ferritin declined across available results.'],
  ['Context', 'Fatigue and heavier bleeding were reported during the same period.'],
  ['Question to discuss', 'Could these changes be worth discussing together?'],
];

/** The three values, plotted on one scale, the last one current. */
function Trend() {
  const values = SERIES.map(([, v]) => v);
  const hi = Math.max(...values) + 6;
  const lo = Math.min(...values) - 6;
  const x = (i: number) => (i / (SERIES.length - 1)) * 100;
  const y = (v: number) => 40 - ((v - lo) / (hi - lo)) * 40;
  const d = SERIES.map(([, v], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div className="lb-trend">
      <svg viewBox="-4 -5 108 50" role="img" aria-label={SERIES.map(([d2, v]) => `${d2}, ${v} nanograms per millilitre`).join('; ')}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        {SERIES.map(([date, v], i) => (
          <circle
            key={date}
            cx={x(i)}
            cy={y(v)}
            r={i === SERIES.length - 1 ? 2.8 : 1.8}
            fill={i === SERIES.length - 1 ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <dl className="lb-points">
        {SERIES.map(([date, v], i) => (
          <div key={date} className={i === SERIES.length - 1 ? 'is-last' : undefined}>
            <dt>{date}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LabsSection() {
  return (
    <section className="section labs" aria-labelledby="labs-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="labs-heading" className="band-title">
            Your lab results shouldn’t live in a PDF.
          </h2>
          <p className="band-sub">
            Upload the document your provider sent. Ciatta reads the values out
            of it and keeps each one beside every other time it was measured.
          </p>
        </div>

        {/* the document, what was read from it, and the same value over time */}
        <ol className="lb-steps">
          <li>
            <span className="lb-step">Uploaded</span>
            <div className="lb-doc">
              <span className="lb-doc-ico" aria-hidden="true">PDF</span>
              <span className="lb-doc-b">
                <b>Quest Diagnostics</b>
                <i>Full blood panel · 2 Sep 2026</i>
              </span>
            </div>
          </li>
          <li>
            <span className="lb-step">Results read from it</span>
            <ul className="lb-values">
              <li><b>Ferritin</b><span>18 ng/mL</span></li>
              <li><b>TSH</b><span>2.1 mIU/L</span></li>
              <li><b>Vitamin D</b><span>31 ng/mL</span></li>
            </ul>
          </li>
          <li>
            <span className="lb-step">Ferritin, every result you have</span>
            <Trend />
          </li>
        </ol>

        <div className="sec-phone">
          <div className="product sec-phone-device">
            <LabScreen />
          </div>

          <div className="sec-phone-read">
            <div className="lb-around">
              <h3>What changed around the same time</h3>
              <dl>
                {ALONGSIDE.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <dl className="lb-registers">
              {READ.map(([label, line]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{line}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useRef, useState } from 'react';
import {
  CycleScreen, InsightScreen, MedsScreen, RecordsScreen, SleepScreen, SymptomsScreen, ToldScreen,
} from './ProductShowcase';

/**
 * "See it, connect it, and understand why." — modelled on the section of the
 * same shape on hioctohealth.com: a centred heading and lede, a row of six
 * photographic tabs, and one large panel that changes when a tab is chosen.
 * Copy over the photograph on the left, a card of real figures on the right.
 *
 * Octo's version puts six health *categories* on the tabs. Ciatta has no
 * categories to sell, so the six are the six kinds of thing its record holds,
 * which is the same six the app screens behind the plus walk through. That keeps the
 * page honest: every figure on every card comes from the one record the
 * screens already document — cycles 29/28/27/26 days, sleep averaging
 * 7h 18m with its lowest weeks on 26 Jan and 23 Feb, levothyroxine 50 mcg
 * from 8 Jan and 75 from 3 Mar, and the 14 Mar Quest panel. Today is 1 Apr
 * 2026, as it is everywhere else on this site.
 *
 * Octo's thumbnails are plain clickable images. These are a real tablist with
 * arrow-key movement, because six photographs that swap a panel are tabs
 * whether or not they are built as tabs.
 *
 * The app screens sit behind a plus on the panel, the way WHOOP keeps the
 * detail of "Know what your body needs, every day" behind a plus on each card:
 * the panel says what Ciatta shows, and the plus shows it. The insight reads
 * cycle and sleep together, so it opens from both.
 */

type Card =
  /** A measurement that moved. Points plot in order; the last is current. */
  | { kind: 'series'; head: string; unit: string; points: [string, number, string][] }
  /** A value against the range it is reported in. Octo's biomarker card. */
  | { kind: 'range'; head: string; rows: [string, number, number, number, string][] }
  /** Things that happened, dated. What a chart cannot hold. */
  | { kind: 'log'; head: string; rows: [string, string, string][] };

type Topic = {
  key: string;
  pill: string;
  /** The tab's label where the full one will not sit on one line. */
  tab?: string;
  title: string;
  lede: string;
  ask: string;
  answer: string;
  card: Card;
  alt: string;
  /** The app screens behind the plus, the topic's own first. */
  screens: { name: string; Screen: () => React.ReactNode }[];
};

const TOPICS: Topic[] = [
  {
    key: 'cycle',
    pill: 'Cycle',
    title: 'See your cycle change',
    lede:
      'A cycle that shortens by a day, four times running, is not four separate facts. It is one pattern, and you can only see it if the four are kept together.',
    ask: 'Why do my cycles keep getting shorter?',
    answer:
      'Four in a row, each a day shorter: 29, 28, 27, 26. The two shortest each began within a week of your lowest-sleep weeks.',
    alt: 'A woman sitting cross-legged on a mat in a bare, bright room.',
    screens: [{ name: 'Cycle', Screen: CycleScreen }, { name: 'Personalized insight', Screen: InsightScreen }],
    card: {
      kind: 'series',
      head: 'Cycle length',
      unit: 'days',
      points: [
        ['8 Dec', 29, '29'],
        ['6 Jan', 28, '28'],
        ['3 Feb', 27, '27'],
        ['2 Mar', 26, '26'],
      ],
    },
  },
  {
    key: 'sleep',
    pill: 'Sleep',
    title: 'See what a bad week costs',
    lede:
      'One short night is nothing. A week of them, twice in three months, is something your record can put a date on.',
    ask: 'Does a bad week of sleep actually show up anywhere?',
    answer:
      'Twice this year. The weeks of 26 Jan and 23 Feb were your lowest, and your two shortest cycles both began inside them.',
    alt: 'A figure silhouetted against a low sun, arms raised overhead.',
    screens: [{ name: 'Sleep', Screen: SleepScreen }, { name: 'Personalized insight', Screen: InsightScreen }],
    card: {
      kind: 'series',
      head: 'Sleep · weekly average',
      unit: 'hours',
      points: [
        ['5 Jan', 7.6, '7h 36m'],
        ['26 Jan', 6.03, '6h 02m'],
        ['16 Feb', 7.4, '7h 24m'],
        ['23 Feb', 6.23, '6h 14m'],
        ['16 Mar', 7.5, '7h 30m'],
      ],
    },
  },
  {
    key: 'symptoms',
    pill: 'Symptoms',
    title: 'Put a date on what you feel',
    lede:
      'What you feel is part of the record too. Dated as you wrote it, it lines up against everything else that happened that week.',
    ask: 'Is the tiredness in my head?',
    answer:
      'You logged low energy in the same two weeks your sleep was lowest. It is in your record, dated, before anyone decides anything.',
    alt: 'A woman arching backwards with one arm extended, against a plain wall.',
    screens: [{ name: 'Symptoms', Screen: SymptomsScreen }],
    card: {
      kind: 'log',
      head: 'Symptoms',
      rows: [
        ['26 Jan', 'Energy low · four days', 'You told Ciatta'],
        ['23 Feb', 'Energy low · three days', 'You told Ciatta'],
        ['28 Mar', 'Cycle began · day 5 today', 'You told Ciatta'],
      ],
    },
  },
  {
    key: 'medications',
    pill: 'Medications & supplements',
    tab: 'Medications',
    title: 'Know what changed, and when',
    lede:
      'A dose change is exactly the kind of thing you cannot recall in June. Ciatta keeps the date, and keeps what happened after it.',
    ask: 'Has anything changed that I should mention?',
    answer:
      'Your levothyroxine went from 50 to 75 mcg on 3 Mar. Your TSH was measured eleven days later, on 14 Mar.',
    alt: 'A flat-lay of small hand weights and a jar on a pale surface.',
    screens: [{ name: 'Medications & Supplements', Screen: MedsScreen }],
    card: {
      kind: 'log',
      head: 'Levothyroxine',
      rows: [
        ['8 Jan', '50 mcg · started', 'Imported'],
        ['3 Mar', '75 mcg · changed', 'Imported'],
        ['1 Apr', '75 mcg · current', 'Imported'],
      ],
    },
  },
  {
    key: 'results',
    pill: 'Results & documents',
    tab: 'Results',
    title: 'Read your labs in context',
    lede:
      'In range is not the same as nothing to ask about. Ciatta shows where in the range you sit, and what else in your record sits near it.',
    ask: 'My labs came back normal. So why do I feel like this?',
    answer:
      'Ferritin 24 is inside the range and close to its floor. That is not a diagnosis. It is a number worth asking about.',
    alt: 'A woman with cropped white hair sitting outdoors, holding a cup.',
    screens: [{ name: 'Health Records', Screen: RecordsScreen }],
    card: {
      kind: 'range',
      head: '14 Mar · Quest',
      rows: [
        ['Ferritin', 24, 15, 150, 'µg/L'],
        ['TSH', 2.1, 0.4, 4.0, 'mIU/L'],
        ['Vitamin D', 31, 30, 100, 'ng/mL'],
      ],
    },
  },
  {
    key: 'notes',
    pill: 'Your own words',
    title: 'Keep what no device saw',
    lede:
      'A device records the night. It does not record the week you had, so you do — once, and it stays exactly as you wrote it.',
    ask: 'Will I still remember this at my appointment in June?',
    answer:
      'You wrote it on 12 Jan, and it is still dated 12 Jan. Nothing a device records overwrites what you said.',
    alt: 'A woman cooking at a kitchen counter in daylight.',
    screens: [{ name: 'What you told Ciatta', Screen: ToldScreen }],
    card: {
      kind: 'log',
      head: 'What you told Ciatta',
      rows: [
        ['12 Jan', '“A stressful stretch at work.”', 'You told Ciatta'],
        ['26 Jan', '“Waking several times a night.”', 'You told Ciatta'],
        ['3 Mar', '“My doctor changed my medication.”', 'You told Ciatta'],
      ],
    },
  },
];

/** The plot. One scale, drawn from the data, with the last point emphasised. */
function Series({ card }: { card: Extract<Card, { kind: 'series' }> }) {
  const ys = card.points.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = (hi - lo) * 0.35 || 1;
  const top = hi + pad;
  const bottom = lo - pad;
  const W = 100;
  const H = 40;
  const x = (i: number) => (card.points.length === 1 ? W / 2 : (i / (card.points.length - 1)) * W);
  const y = (v: number) => H - ((v - bottom) / (top - bottom)) * H;
  const d = card.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p[1]).toFixed(2)}`).join(' ');
  const last = card.points.length - 1;

  return (
    <>
      <svg className="ex-plot" viewBox={`-3 -4 ${W + 6} ${H + 8}`} role="img"
           aria-label={card.points.map((p) => `${p[0]}, ${p[2]} ${card.unit}`).join('; ')}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.1"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        {card.points.map((p, i) => (
          <circle key={p[0]} cx={x(i)} cy={y(p[1])} r={i === last ? 2.6 : 1.7}
                  fill={i === last ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.1" />
        ))}
      </svg>
      <dl className="ex-points">
        {card.points.map((p, i) => (
          <div key={p[0]} className={i === last ? 'is-last' : undefined}>
            <dt>{p[0]}</dt>
            <dd>{p[2]}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** A value on the range it was reported in. The mark sits where the value is. */
function Ranges({ card }: { card: Extract<Card, { kind: 'range' }> }) {
  return (
    <ul className="ex-ranges">
      {card.rows.map(([label, value, lo, hi, unit]) => {
        const at = Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100));
        return (
          <li key={label}>
            <div className="ex-range-head">
              <span>{label}</span>
              <b>{value}<i>{unit}</i></b>
            </div>
            <div className="ex-range-bar">
              <span className="ex-range-mark" style={{ left: `${at}%` }} />
            </div>
            <div className="ex-range-foot">
              <span>{lo}</span>
              <span>reference range</span>
              <span>{hi}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Dated entries, newest last, with where each one came from. */
function Log({ card }: { card: Extract<Card, { kind: 'log' }> }) {
  return (
    <ol className="ex-log">
      {card.rows.map(([date, what, src]) => (
        <li key={date + what}>
          <span className="ex-log-date">{date}</span>
          <span className="ex-log-what">{what}</span>
          <span className="ex-log-src">{src}</span>
        </li>
      ))}
    </ol>
  );
}

export function ExploreSection() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const sheet = useRef<HTMLDialogElement>(null);
  const t = TOPICS[active];

  /**
   * The rail scrolls below about 1100px, so a tab can be chosen while it is
   * half outside the scrollport — by arrowing past the edge, or by tapping a
   * tab that is only partly visible. Either way it is brought fully into view,
   * which is also what stops the selection ring being clipped.
   */
  function select(i: number, moveFocus = false) {
    setActive(i);
    const el = tabs.current[i];
    if (moveFocus) el?.focus();
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    select((active + delta + TOPICS.length) % TOPICS.length, true);
  }

  return (
    <section className="section explore" aria-labelledby="explore-heading">
      <div className="shell">
        <div className="band-head">
        <h2 id="explore-heading" className="band-title">
          See it, connect it, and understand why.
        </h2>
        <p className="band-sub">
          A tracking app watches one thing and stops there. Ciatta holds six
          parts of your record and shows you what they say together.
        </p>
        </div>

        <div className="ex-tabs" role="tablist" aria-label="Parts of your record" onKeyDown={onKeyDown}>
          {TOPICS.map((x, i) => (
            <button
              key={x.key}
              ref={(el) => { tabs.current[i] = el; }}
              type="button"
              role="tab"
              id={`ex-tab-${x.key}`}
              aria-selected={i === active}
              aria-controls="ex-panel"
              tabIndex={i === active ? 0 : -1}
              className={i === active ? 'ex-tab is-on' : 'ex-tab'}
              onClick={() => select(i)}
            >
              <img src={`/images/explore/${x.key}-thumb.jpg`} alt="" width={480} height={400}
                   loading="lazy" decoding="async" />
              <span className="ex-tab-scrim" aria-hidden="true" />
              <span className="ex-tab-pill">{x.tab ?? x.pill}</span>
              <span className="ex-tab-cap">{x.title}</span>
            </button>
          ))}
        </div>

        <div className="ex-panel" id="ex-panel" role="tabpanel" aria-labelledby={`ex-tab-${t.key}`} tabIndex={-1}>
          <img className="ex-panel-img" src={`/images/explore/${t.key}.jpg`} alt={t.alt}
               width={1800} height={900} loading="lazy" decoding="async" />
          <div className="ex-panel-scrim" aria-hidden="true" />

          <button type="button" className="ex-plus" aria-haspopup="dialog"
                  aria-label={`See ${t.screens.length > 1 ? 'the screens' : 'the screen'} in the app: ${t.screens.map((x) => x.name).join(' and ')}`}
                  onClick={() => sheet.current?.showModal()}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
          </button>

          <div className="ex-copy">
            <span className="ex-pill">{t.pill}</span>
            <h3 className="ex-title">{t.title}</h3>
            <p className="ex-lede">{t.lede}</p>
            <div className="ex-chat">
              <p className="ex-ask">{t.ask}</p>
              <div className="ex-ans">
                <span className="ex-ans-mark" aria-hidden="true" />
                <p>{t.answer}</p>
              </div>
            </div>
          </div>

          <figure className="ex-card">
            <figcaption className="ex-card-head">
              <span>{t.card.head}</span>
              {t.card.kind === 'series' && <i>{t.card.unit}</i>}
            </figcaption>
            <div className="ex-card-body">
              {t.card.kind === 'series' && <Series card={t.card} />}
              {t.card.kind === 'range' && <Ranges card={t.card} />}
              {t.card.kind === 'log' && <Log card={t.card} />}
            </div>
            <p className="ex-card-note">
              Your own record, read in context. Ciatta does not diagnose or
              prescribe, and this is not a second opinion.
            </p>
          </figure>
        </div>

        {/* A native modal dialog: focus is held inside it, Escape closes it,
            and a click on the backdrop (the dialog element itself) does too. */}
        <dialog ref={sheet} className="ex-sheet" aria-labelledby="ex-sheet-title"
                onClick={(e) => { if (e.target === e.currentTarget) sheet.current?.close(); }}>
          <div className="ex-sheet-in">
            <div className="ex-sheet-head">
              <div>
                <span className="ex-sheet-pill">{t.pill}</span>
                <h3 id="ex-sheet-title" className="ex-sheet-title">{t.title}</h3>
              </div>
              <button type="button" className="ex-sheet-close" aria-label="Close"
                      onClick={() => sheet.current?.close()}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
              </button>
            </div>
            <div className="ex-sheet-screens">
              {t.screens.map(({ name, Screen }) => (
                <figure key={name} className="ex-sheet-screen">
                  <Screen />
                  <figcaption>{name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </dialog>
      </div>
    </section>
  );
}

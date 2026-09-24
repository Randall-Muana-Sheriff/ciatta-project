import { useRef, useState } from 'react';

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
  /** What that part lets her see, on the tab itself. */
  cap: string;
  title: string;
  lede: string;
  ask: string;
  answer: string;
  card: Card;
  alt: string;
  /** The app screens behind the plus, the topic's own first. */
};

const TOPICS: Topic[] = [
  {
    key: 'cycle',
    pill: 'Cycle',
    tab: 'Cycle',
    cap: 'See what changes across your cycle.',
    title: 'See your cycle change',
    lede:
      'A cycle that shortens by a day, four times running, is not four separate facts. It is one pattern, and you can only see it if the four are kept together.',
    ask: 'Why do my cycles keep getting shorter?',
    answer:
      'Four in a row, each a day shorter: 29, 28, 27, 26. The two shortest each began within a week of your lowest-sleep weeks.',
    alt: 'A woman sitting cross-legged on a mat in a bare, bright room.',
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
    tab: 'Sleep',
    cap: 'See sleep beside what surrounded it.',
    title: 'See what a bad week costs',
    lede:
      'One short night is nothing. A week of them, twice in three months, is something your record can put a date on.',
    ask: 'Does a bad week of sleep actually show up anywhere?',
    answer:
      'Twice this year. The weeks of 26 Jan and 23 Feb were your lowest, and your two shortest cycles both began inside them.',
    alt: 'A figure silhouetted against a low sun, arms raised overhead.',
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
    tab: 'Symptoms',
    cap: 'Give what you feel a date.',
    title: 'Put a date on what you feel',
    lede:
      'What you feel is part of the record too. Dated as you wrote it, it lines up against everything else that happened that week.',
    ask: 'Is the tiredness in my head?',
    answer:
      'You logged low energy in the same two weeks your sleep was lowest. It is in your record, dated, before anyone decides anything.',
    alt: 'A woman arching backwards with one arm extended, against a plain wall.',
    card: {
      kind: 'log',
      head: 'Symptoms',
      rows: [
        ['26 Jan', 'Pain 8/10 · energy low · four days', 'You told Ciatta'],
        ['23 Feb', 'Pain 8/10 · energy low · three days', 'You told Ciatta'],
        ['28 Mar', 'Cycle began · day 5 today', 'You told Ciatta'],
      ],
    },
  },
  {
    key: 'medications',
    pill: 'Medications & supplements',
    tab: 'Medications',
    cap: 'Know what changed, and when.',
    title: 'Know what changed, and when',
    lede:
      'A dose change is exactly the kind of thing you cannot recall in June. Ciatta keeps the date, and keeps what happened after it.',
    ask: 'Has anything changed that I should mention?',
    answer:
      'Your levothyroxine went from 50 to 75 mcg on 3 Mar. Your TSH was measured eleven days later, on 14 Mar.',
    alt: 'A flat-lay of small hand weights and a jar on a pale surface.',
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
    pill: 'Labs & results',
    tab: 'Labs',
    cap: 'See results across time, not alone.',
    title: 'Read your labs in context',
    lede:
      'In range is not the same as nothing to ask about. Ciatta shows where in the range you sit, and what else in your record sits near it.',
    ask: 'My labs came back normal. So why do I feel like this?',
    answer:
      'Ferritin 24 is inside the range and close to its floor. That is not a diagnosis. It is a number worth asking about.',
    alt: 'A woman with cropped white hair sitting outdoors, holding a cup.',
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
    key: 'surgery',
    pill: 'Surgery & procedures',
    tab: 'Surgery',
    cap: 'See before, during, and after.',
    title: 'See what an intervention changed',
    lede:
      'A procedure is a line drawn through your record. What matters is what your own measurements and symptoms did on either side of it, and that only exists if the record runs through it.',
    ask: 'Did the procedure change anything?',
    answer:
      'Your symptom days fell from 14 in the six weeks before to 5 in the six weeks after. Sleep returned to your usual in week 4.',
    alt: 'A woman sitting in bed in an attic room, drinking from a cup with a book open beside her.',
    card: {
      kind: 'log',
      head: 'Laparoscopy · 12 Jan',
      rows: [
        ['1 Dec – 11 Jan', 'Symptom days 14', 'Before'],
        ['12 Jan', 'Procedure', 'Imported'],
        ['13 Jan – 23 Feb', 'Symptom days 5', 'After'],
      ],
    },
  },
  /* The everyday context the statement at the top of the page promises. It
     is the one part of the record that is not about her at all — it is what
     was around her — and it is why a bad week sometimes has an explanation
     that is nothing to do with her body.

     The answer carries the site's own caution on its face rather than in a
     footnote, because "symptoms on the high-pollen days" is exactly the
     kind of overlap a person reads as cause. */
  /* Daily life is the layer between her body and the world: what she was
     doing, where she was, how the week was shaped. It is separate from
     Environment because one is what she did and the other is what was around
     her, and separate from Your own words because these are facts about a
     week rather than how the week felt.

     The sources stay honest. Ciatta does not claim a calendar integration
     anywhere else on this site, so the rows are labelled by how the record
     actually gets them — connected, or told — and the lede says the same. */
  {
    key: 'daily',
    pill: 'Daily life',
    tab: 'Daily life',
    cap: 'See how the week was shaped.',
    title: 'See what your days were actually like',
    lede:
      'Work and travel, training and rest, meals, and a schedule that moved. Some of it arrives from what you connect and some of it you tell Ciatta, and either way it is part of the week a symptom landed in.',
    ask: 'What was that week actually like?',
    answer:
      'Your heaviest symptom days sat in the week you crossed three time zones, and in the stretch with the latest finishes. A week can explain a lot without being the cause of it.',
    alt: 'A woman cooking at a kitchen island, bread and fruit on the counter beside her.',
    card: {
      kind: 'log',
      head: 'Your weeks · March',
      rows: [
        ['4–8 Mar', 'Late finishes, 4 nights', 'Told'],
        ['11–13 Mar', 'Travel, 3 time zones', 'Told'],
        ['14 Mar', 'Nine meetings, no break', 'Told'],
        ['15–17 Mar', 'Training resumed', 'Measured'],
      ],
    },
  },
  {
    key: 'environment',
    pill: 'Environment & exposures',
    tab: 'Environment',
    cap: 'See what was around you.',
    title: 'See what was going on around you',
    lede:
      'Air quality and pollution, pollen and allergens, temperature and humidity, wildfire smoke, damp and mould where it can be known, and how much daylight you were getting. Weather is one part of this, not the whole of it, and none of it is about your body. It is the background a bad week happened against.',
    ask: 'Was it me, or was it what was around me?',
    answer:
      'Your symptom days this month sat on the three highest-pollen days, and across the heat and poor air of 2–8 Aug. Things that move together are not necessarily one causing the other.',
    alt: 'Haze and cloud over a ridge at dusk, the light going orange behind it.',
    card: {
      kind: 'log',
      head: 'Around you · August',
      rows: [
        ['2–4 Aug', 'Heat 32°C · humidity 78%', 'Imported'],
        ['7 Aug', 'Air quality poor · AQI 142', 'Imported'],
        ['11 Aug', 'Pollen very high', 'Imported'],
        ['16 Aug', 'Daylight down 48 min since July', 'Imported'],
        ['19 Aug', 'Wildfire smoke nearby', 'Imported'],
      ],
    },
  },
  /* Last, on purpose. The record reads outward from her body to her
     care, then to her days and what was around them — and it ends on
     the only part nothing can measure: what she says herself. */
  {
    key: 'notes',
    pill: 'Your own words',
    tab: 'Your own words',
    cap: 'Keep what no device could record.',
    title: 'Keep what no device saw',
    lede:
      'A device records the night. It does not record the week you had, so you do: once, and it stays exactly as you wrote it.',
    ask: 'Will I still remember this at my appointment in June?',
    answer:
      'You wrote it on 12 Jan, and it is still dated 12 Jan. Nothing a device records overwrites what you said.',
    alt: 'A woman cooking at a kitchen counter in daylight.',
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
          All the pieces. One picture.
        </h2>
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
              {/* A topic whose photograph has not been supplied yet must not
                  put a broken image on the page: the tab keeps its scrim,
                  its pill and its caption, and simply has no picture behind
                  them until the file lands. */}
              <img src={`/images/explore/${x.key}-thumb.jpg`} alt="" width={480} height={400}
                   loading="lazy" decoding="async"
                   onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              <span className="ex-tab-scrim" aria-hidden="true" />
              <span className="ex-tab-pill">{x.tab ?? x.pill}</span>
              <span className="ex-tab-cap">{x.cap}</span>
            </button>
          ))}
        </div>

        <div className="ex-panel" id="ex-panel" role="tabpanel" aria-labelledby={`ex-tab-${t.key}`} tabIndex={-1}>
          <img className="ex-panel-img" src={`/images/explore/${t.key}.jpg`} alt={t.alt}
               width={1800} height={900} loading="lazy" decoding="async"
               onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          <div className="ex-panel-scrim" aria-hidden="true" />

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
          </figure>
        </div>

      </div>
    </section>
  );
}

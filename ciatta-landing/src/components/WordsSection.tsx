/**
 * "Some things only you can tell us."
 *
 * The quiet section: one photograph carrying the feeling, her own words
 * beside it dated as she wrote them, and the line that says what happens to
 * them. Nothing here is a chart, because nothing here was measured.
 */

const ENTRIES: [string, string][] = [
  ['12 Jan', 'A stressful stretch at work.'],
  ['26 Jan', 'Waking several times a night.'],
  ['3 Mar', 'My doctor changed my medication.'],
];

export function WordsSection() {
  return (
    <section className="section words" aria-labelledby="words-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="words-heading" className="band-title">
            Some things only you can tell us.
          </h2>
        </div>

        <div className="wd-body">
          <figure className="wd-photo">
            <img
              src="/images/get/own-words.jpg"
              alt="A woman sitting up in bed in a bright room, first thing in the morning."
              width={900}
              height={1200}
              loading="lazy"
              decoding="async"
            />
          </figure>

          <div className="wd-copy">
            <p className="wd-lede">A wearable can tell you how you slept.</p>
            <p className="wd-lede">
              It can’t tell you that you spent the week in pain, skipped lunch,
              traveled for work, or started feeling different after a
              medication change.
            </p>
            <p className="wd-lede is-turn">Ciatta keeps both.</p>

            <ol className="wd-entries">
              {ENTRIES.map(([date, said]) => (
                <li key={date}>
                  <span className="wd-date">{date}</span>
                  <blockquote>
                    <p>“{said}”</p>
                  </blockquote>
                </li>
              ))}
            </ol>

            <p className="wd-close">Your words become part of the timeline.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

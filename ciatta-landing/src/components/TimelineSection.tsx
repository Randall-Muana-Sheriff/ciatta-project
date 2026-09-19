/**
 * "One moment rarely tells the whole story."
 *
 * Time, drawn as time: one rule running left to right with eight dated
 * moments on it, the kinds of moment a record has to survive. On a phone the
 * rule becomes vertical rather than shrinking into illegibility, because a
 * timeline that has to be scrolled sideways is a timeline nobody reads.
 */

const MOMENTS: [string, string, string][] = [
  ['Oct', 'Symptoms', 'Pain reported more often'],
  ['Nov', 'Lab', 'Ferritin 32'],
  ['8 Jan', 'Medication', 'Levothyroxine started'],
  ['3 Feb', 'Cycle', 'Shortened to 27 days'],
  ['26 Feb', 'Treatment', 'Dose changed'],
  ['12 Mar', 'Surgery', 'Laparoscopy'],
  ['Apr', 'Recovery', 'Symptom days fell'],
  ['Now', 'What happened next', 'Sleep closer to usual'],
];

export function TimelineSection() {
  return (
    <section className="section timeline" aria-labelledby="timeline-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="timeline-heading" className="band-title">
            One moment rarely tells the whole story.
          </h2>
          <p className="band-sub">
            Ciatta keeps your health timeline intact, so you can see what
            changed before and after the moments that mattered.
          </p>
        </div>

        <ol className="tl-line">
          {MOMENTS.map(([when, kind, what]) => (
            <li key={when + kind}>
              <span className="tl-tick" aria-hidden="true" />
              <span className="tl-when">{when}</span>
              <span className="tl-kind">{kind}</span>
              <span className="tl-what">{what}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

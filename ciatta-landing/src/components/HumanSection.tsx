/**
 * "You shouldn't have to become your own medical historian."
 *
 * Its own section again, and now with a photograph of its own, cut from the
 * same art direction as the four tiles above it: warm, low, directional
 * light, a woman mid-thought rather than posed, and the line set over her in
 * white the way the tiles set theirs.
 *
 * The work she is currently doing sits on the photograph as six separate
 * pills rather than under it as a list, because that is how it reaches her:
 * not in order, not one at a time, and never finished. The line that says
 * Nothing sits under the frame: the section is the photograph and what is
 * on it.
 */

const WORK: string[] = [
  'Remembering symptoms.',
  'Searching old lab results.',
  'Explaining what changed.',
  'Reconstructing medication history.',
  'Trying to remember what happened after treatment.',
  'Connecting one appointment to the next.',
];

export function HumanSection() {
  return (
    <section className="section human" aria-labelledby="human-heading">
      <div className="shell">
        <figure className="hm-figure">
          <img
            src="/images/value/remember.jpg"
            alt="A woman at a window in low morning light, holding a cup, looking out."
            width={1440} height={900} loading="lazy" decoding="async"
          />
          <span className="hm-figure-scrim" aria-hidden="true" />
          {/* the work, scattered over her the way it actually arrives: not a
              tidy list, six separate things at once */}
          <ul className="hm-pills" aria-label="What you are currently doing yourself">
            {WORK.map((line) => (
              <li className="hm-pill" key={line}>{line}</li>
            ))}
          </ul>

          <h2 id="human-heading" className="band-title hm-title">
            You shouldn’t have to become your own medical historian.
          </h2>
        </figure>

      </div>
    </section>
  );
}

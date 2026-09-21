/**
 * "You shouldn't have to become your own medical historian."
 *
 * Its own section again, and now with a photograph of its own, cut from the
 * same art direction as the four tiles above it: warm, low, directional
 * light, a woman mid-thought rather than posed, and the line set over her in
 * white the way the tiles set theirs.
 *
 * What sits under the photograph is the plainest thing on the page and
 * deliberately the least designed: the work she is currently doing, listed,
 * and then the one line that says Ciatta does it instead.
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
          <h2 id="human-heading" className="band-title hm-title">
            You shouldn’t have to become your own medical historian.
          </h2>
        </figure>

        <div className="hm-body">
          <ul className="hm-work">
            {WORK.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="hm-turn">Ciatta keeps the story together.</p>
        </div>
      </div>
    </section>
  );
}

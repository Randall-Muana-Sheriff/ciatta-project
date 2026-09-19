/**
 * "You shouldn't have to become your own medical historian."
 *
 * The plainest section on the page and deliberately the least designed: the
 * work she is currently doing, listed, and then the line that says Ciatta
 * does it instead. Type on paper, one rule, nothing else.
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
        <div className="band-head">
          <h2 id="human-heading" className="band-title">
            You shouldn’t have to become your own medical historian.
          </h2>
        </div>

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

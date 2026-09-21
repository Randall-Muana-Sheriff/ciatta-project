/**
 * "You shouldn't have to become your own medical historian."
 *
 * The plainest block on the page and deliberately the least designed: the
 * work she is currently doing, listed, and then the line that says Ciatta
 * does it instead. Type on paper, one rule, nothing else.
 *
 * It is a block rather than a section because it sits inside the one about
 * the woman it describes. The four tiles above it say what she already does;
 * this says what it costs her, and what Ciatta does with that.
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
    <div className="human">
      <h3 id="human-heading" className="band-title hm-title">
        You shouldn’t have to become your own medical historian.
      </h3>

      <div className="hm-body">
        <ul className="hm-work">
          {WORK.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="hm-turn">Ciatta keeps the story together.</p>
      </div>
    </div>
  );
}

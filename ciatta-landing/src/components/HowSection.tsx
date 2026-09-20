/**
 * "What is your body telling you?" — how Ciatta works, directly under the hero.
 *
 * Built to the shape findmypattern.com gives the same job: a question as the
 * headline, one sentence under it, and then the work itself as four numbered
 * steps. The shape is theirs; the steps are Ciatta's, and each one describes
 * something the product actually does rather than a benefit it claims.
 *
 * Nothing here is a card. Four columns on a rule, numbered, in the page's own
 * black type on paper, so the section reads as the opening of the argument
 * rather than as a feature grid.
 */

const STEPS: [string, string, string][] = [
  [
    '01',
    'Bring it together',
    'Import results from your providers, upload the documents they send, connect the app or wearable you already use, and add the things only you can say.',
  ],
  [
    '02',
    'See what changed',
    'Ciatta reads your record in order and shows what moved against your own usual, with the date it moved and where the figure came from.',
  ],
  [
    '03',
    'See what it sits beside',
    'Every change is read beside the week it happened in: your cycle, your care, your workload, your own words. Ciatta names what may be connected, and what that is based on.',
  ],
  [
    '04',
    'Decide what to do next',
    'Try one thing, see what happened after, and take what changed into your next appointment as one page rather than six months of memory.',
  ],
];

export function HowSection() {
  return (
    <section className="section how" aria-labelledby="how-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="how-heading" className="band-title">
            What is your body telling you?
          </h2>
          <p className="band-sub">
            The story of your health unfolds over time. Ciatta brings the pieces
            together and reads them in order, so the changes, and what sits
            beside them, are yours to see.
          </p>
        </div>

        <ol className="hw-steps">
          {STEPS.map(([n, title, body]) => (
            <li key={n}>
              <span className="hw-n">{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>

        <p className="hw-note">
          A connection is not a diagnosis. Ciatta shows what an observation is
          based on, and what is still too thin to call.
        </p>
      </div>
    </section>
  );
}

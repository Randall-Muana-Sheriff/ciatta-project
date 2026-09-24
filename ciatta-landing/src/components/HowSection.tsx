/**
 * How Ciatta works, on the home page: the loop, in five words.
 *
 * WHAT THIS USED TO BE, AND WHY IT IS NOT THAT ANY MORE.
 *
 * Four numbered steps, each one carrying a full drawing: the sources arriving
 * as a hub with animated lines, the Today screen, the suggestions screen, and
 * the brief screen. All of it accurate, and all of it already on the How it
 * works page, at more length, with the same screens. The home page was
 * spending most of its remaining height explaining the mechanism to someone
 * who had not yet been given a reason to care about the mechanism.
 *
 * So the home page keeps the shape of the thing — Connect, See, Act, Learn,
 * Prepare — and the page that exists to explain it keeps the explanation. One
 * line per stage, and a link for anyone who wants the long version. The
 * screens live there now and appear once.
 *
 * It is written as a loop rather than a list because it is one: what happened
 * after a change is what the next change gets read against. The last stage
 * does not end the sequence, and the rule under the row says so in a sentence
 * rather than with an arrow curling back on itself.
 */

/* Five stages, one line each. Each line says what Ciatta does at that stage
   in the words the rest of the site uses for it, and nothing here promises a
   source or a capability that is not already claimed elsewhere on the site. */
const LOOP: [string, string][] = [
  ['Connect',
   'Your wearable, your portal, the documents you were sent, and what you tell it yourself.'],
  ['See',
   'What changed, and what your record holds from around the same time.'],
  ['Act',
   'Something to try or something to raise, each one carrying the pattern it came from.'],
  ['Learn',
   'What happened after you tried it, kept, and read against the next change.'],
  ['Prepare',
   'One page for an appointment: what changed, what you tried, and what is worth asking.'],
];

export function HowSection() {
  return (
    <section className="section how-loop" aria-labelledby="how-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="how-heading" className="band-title">How Ciatta works</h2>
          <p className="band-sub">
            Five stages, and the fifth is not the end of it: what happened
            after you tried something is what the next change gets read
            against.
          </p>
        </div>

        {/* Not a reveal target. The list is the whole section, and a section
            whose entire content depends on the reveal firing is a section
            that can fail to exist. */}
        <ol className="lp-rows">
          {LOOP.map(([name, line], i) => (
            <li key={name}>
              <span className="lp-n">{String(i + 1).padStart(2, '0')}</span>
              <b>{name}</b>
              <span className="lp-line">{line}</span>
            </li>
          ))}
        </ol>

        <p className="lp-more">
          <a href="/how-it-works/">See how it works, in full</a>
        </p>
      </div>
    </section>
  );
}

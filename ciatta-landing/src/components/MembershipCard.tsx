import { ReserveButton } from './ReserveButton';

/**
 * The membership card, on both pages that ask for a pre-order.
 *
 * It lives in one file because it is the same offer in both places, and an
 * offer that drifts between two copies of itself is how a page ends up
 * quoting two prices. The price, the six things, and the sentence about what
 * happens to a card are written once here.
 *
 * `.shell` and `.m-wrap` are the same rule, so the markup suits the home
 * page and the membership page without either needing to know about the
 * other.
 *
 * Two columns: what membership means on the left, the card itself on the
 * right. The offer and the explanation of the offer sit at the same height
 * rather than one scrolling past the other, which is the difference between
 * reading the sentence about not being charged and arriving at a price with
 * no sentence attached. It stacks below a laptop, text first.
 *
 * A NOTE ON THE YEAR. The annual price is not a discounted monthly plan and
 * is never written as one: no "works out at", no per-month equivalent, no
 * struck-through figure. A membership is a membership, one payment, and the
 * heading says so in four words. The sentence that used to argue the case
 * underneath it has gone; "One membership. One year." does not need help.
 */

/**
 * What membership includes. Each is a thing Ciatta does with her record, in
 * the order she meets them: bring it together, read it, say what it means,
 * act on it, and take it to a clinician.
 *
 * Five, not six. "Learn What Works" was a sixth row saying what two of the
 * others already imply, so its halves went where they belong: what changes
 * over time is part of seeing a pattern, and tracking what you tried and
 * what happened next is part of acting on one. A list of five things you get
 * is read; a list of six where one restates two others is skimmed.
 */
const INCLUDED: [string, string][] = [
  ['Connect Your Health',
   'Bring your health data, experiences, and care together.'],
  ['See Your Patterns',
   'Spot meaningful trends and relationships across your health, and what changes over time.'],
  /* "Recommendations" is a word the site already uses and already qualifies:
     the footer of every page says Ciatta provides "health information,
     observations and recommendations for exploration", and that it does not
     diagnose, treat or prevent. So it is safe to say here, and it is the
     more honest description of what Ciatta actually returns. */
  ['Get Personalized Insights',
   'Turn your health history and the evidence into individualized insights and recommendations.'],
  ['Take Informed Action',
   'Try personalized routines, plans and everyday changes, then track what you tried and what happened next.'],
  /* Ciatta Care sits here, inside this row, rather than as a second tier
     further down the page. It is the part of membership that does the work
     around an appointment, so it belongs under the row about appointments —
     not beside the price, where it reads as an upsell. */
  ['Prepare for Care',
   'Organize your health story, prepare questions, and arrive informed. Ciatta Care handles the work around a visit: messages, referrals, and what needs to happen next.'],
];

/**
 * `heading` is the left column's line. The home page and the membership page
 * want different ones — the home page has to make the case in the heading,
 * the membership page has already made it in its own H1 — so it is a prop
 * rather than two copies of this card.
 */
export function MembershipCard({
  heading = 'One membership. One year.',
}: { heading?: string } = {}) {
  return (
    <section className="section mb-join" id="membership" aria-labelledby="plan-heading">
      <div className="shell mb-split">
        <div className="band-head">
          {/* Four words. The heading was a whole sentence of argument —
              "Your health doesn't reset every month." — which is the right
              thought but the wrong place for it: it opened the same way as
              the statement section further up the page ("Your health doesn't
              happen in pieces."), so the home page had two headings starting
              on the same three words. The argument moves into the paragraph,
              where it reads as a reason rather than as a slogan. */}
          <h2 className="m-h2" id="plan-heading">{heading}</h2>
        </div>

        <div className="mb-card">
          <div className="mb-card-name">
            <span className="mb-card-brand">Ciatta</span>
            <span className="mb-card-tier">Core</span>
          </div>
          <p className="mb-card-tag">Your health, continuously connected.</p>

          {/* One payment a year, the way a membership works: the figure you
              see is the figure you pay, once. It is never set beside a
              monthly equivalent, because that would frame the year as a
              discount on a subscription rather than as the thing itself. */}
          <p className="mb-card-price">
            <b>$89</b> <span>/ year</span>
          </p>
          {/* The regular price, said plainly rather than struck through: a
              strikethrough is a sale, and this is not one. $89 is what a place
              reserved before Ciatta opens is held at. */}
          <p className="mb-card-was">
            Founding price. <span>$119 / year after launch.</span>
          </p>

          {/* All six, open. They were a <details> accordion for a while, six
              headings with their sentences a tap away, and the argument for
              that was the wall of type six titles and six sentences make in
              a narrow column. The card is wider now, and the plainer reading
              is that someone deciding whether to reserve a place should not
              have to tap six times to find out what they are reserving. */}
          <ul className="mb-card-list">
            {INCLUDED.map(([title, body]) => (
              <li key={title}>
                <i aria-hidden="true" />
                <span>
                  <b>{title}</b>
                  <em>{body}</em>
                </span>
              </li>
            ))}
          </ul>

          <ReserveButton label="Reserve your place" />
          {/* This button goes to Stripe Checkout in setup mode, which does
              collect a card. It says so. The email forms elsewhere on the
              site take no card and still say "No card", because there the
              sentence is true. */}
          {/* The date, under the button, where the question "so when?" lands.
              It replaced "Card saved · Nothing charged", which was written
              for a Stripe Checkout that is not switched on: with no keys set
              the button falls back to the email form, which takes no card at
              all, so the line was describing something that does not happen
              yet. What a card is used for is still said in the Questions
              below and in clause 6 of the Terms, and it belongs back here
              the day Stripe goes live. */}
          <p className="mb-card-foot">Opens Q3 of 2027</p>
        </div>
      </div>
    </section>
  );
}

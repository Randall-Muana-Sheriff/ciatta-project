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
 * is never written as one — no "works out at", no per-month equivalent, no
 * struck-through figure. A membership is a membership: one payment, and
 * continuous access to what Ciatta learns with you across the year. The copy
 * on the left says why, and it is the product thesis rather than a pricing
 * tactic: health does not reset every month, so the membership does not
 * either.
 */

/**
 * What membership includes. Each is a thing Ciatta does with her record, in
 * the order she meets them: bring it together, read it, say what it means,
 * act, take it to a clinician, and keep score of what worked.
 */
const INCLUDED: [string, string][] = [
  ['Connect Your Health',
   'Bring your health data, experiences, and care together.'],
  ['See Your Patterns',
   'Spot meaningful trends and relationships across your health.'],
  ['Get Personalized Insights',
   'Turn your health history and evidence into relevant insights.'],
  ['Take Informed Action',
   'Try personalized routines, plans, and everyday changes.'],
  ['Prepare for Care',
   'Organize your health story, prepare questions, and arrive informed.'],
  ['Learn What Works',
   'Track what you try, what happens next, and what changes over time.'],
];

export function MembershipCard() {
  return (
    <section className="section mb-join" id="membership" aria-labelledby="plan-heading">
      <div className="shell mb-split">
        <div className="band-head">
          <h2 className="m-h2" id="plan-heading">
            Your health doesn’t reset every month.
          </h2>
          <p className="m-h2-sub">
            Your membership shouldn’t either. One membership, one payment, and
            continuous access to Ciatta’s health intelligence for the year —
            not a subscription that starts over every thirty days.
          </p>
          <p className="m-h2-sub">
            Membership opens in Quarter 3 of 2027. Reserving a place puts you
            on the early-access list: you are not charged, you are not
            subscribed to anything, and you decide then.
          </p>
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
            <b>$99</b> <span>/ year</span>
          </p>
          <p className="mb-card-when">
            One membership. Everything Ciatta learns with you, throughout the
            year.
          </p>

          <p className="mb-card-label">Membership includes</p>
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

          <ReserveButton label="Reserve" />
          <p className="mb-card-foot">
            <span>No card</span> <span>&middot; Nothing charged</span>
          </p>
        </div>
      </div>
    </section>
  );
}

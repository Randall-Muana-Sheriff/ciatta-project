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
 * Two columns: what reserving a place means on the left, the card itself on
 * the right. The offer and the explanation of the offer sit at the same
 * height rather than one scrolling past the other, which is the difference
 * between reading the sentence about not being charged and arriving at a
 * price with no sentence attached. It stacks below a laptop, text first.
 */

const INCLUDED: string[] = [
  'Your health, in one place',
  'See what is changing',
  'See what may be connected',
  'Get personalized insights',
  'Prepare for care',
  'Keep learning over time',
];

export function MembershipCard() {
  return (
    <section className="section mb-join" id="membership" aria-labelledby="plan-heading">
      <div className="shell mb-split">
        <div className="band-head">
          <h2 className="m-h2" id="plan-heading">Your membership starts here.</h2>
          <p className="m-h2-sub">
            Reserving a place puts you on the early-access list. You are not
            charged and you are not subscribed to anything: Ciatta Core will
            be $9.99 a month when membership opens in 2027, and you decide
            then.
          </p>
        </div>

        <div className="mb-card">
          <div className="mb-card-name">
            <span className="mb-card-brand">Ciatta</span>
            <span className="mb-card-tier">Core</span>
          </div>
          <p className="mb-card-tag">Your record, kept in order and read for you.</p>

          <ul className="mb-card-list">
            {INCLUDED.map((line) => (
              <li key={line}><i aria-hidden="true" /><span>{line}</span></li>
            ))}
          </ul>

          <p className="mb-card-price">
            <b>$9.99</b> <span>/ month</span>
          </p>
          <p className="mb-card-when">when membership opens</p>

          <ReserveButton label="Reserve" />
          <p className="mb-card-foot">
            <span>No card</span> <span>&middot; Nothing charged</span>
          </p>
        </div>
      </div>
    </section>
  );
}

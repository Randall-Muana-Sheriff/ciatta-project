import { ReserveButton } from './ReserveButton';

/**
 * The founding offer, in the hero.
 *
 * WHERE IT SITS IN THE HERO'S ARGUMENT. The hero already does two things:
 * it says what she knows ("You know something has changed.") and it shows
 * what Ciatta does (the screen). This is the third, and it is third on
 * purpose — it is the smallest thing in the frame, it arrives lower than the
 * headline, and it never competes with it. A hero whose loudest element is
 * a price is an advertisement.
 *
 * SHAPE, NOT STYLE. The arrangement is borrowed from the founding-member
 * card on clair.com: a small label above, a card floating at the lower right
 * over the product imagery, and inside it an eyebrow, a headline, one
 * sentence, three benefits, a rule, and the action. None of the rest is:
 * the type is Jost, the ground is the same translucent dark the record
 * tour's figure cards use, there are no icons, no gradient, no colour the
 * site does not already have, and no italic serif.
 *
 * WHAT IT DOES NOT CLAIM. It does not say the 500 have gone, or that anyone
 * else has joined, or that the offer closes on a date. "500 founding
 * memberships" is the size of the thing, stated once. There is no counter,
 * no countdown and no "only N left", because none of those could be
 * supported and the whole site is built on not saying what it cannot show.
 *
 * WHAT THE BUTTON DOES. The existing reservation flow, unchanged: Stripe
 * Checkout when the keys are set, and until then the email form, which is
 * free and takes no card. `fallbackId` points it at the hero's own form,
 * which sits ABOVE this card in the document — without it the button would
 * send someone the length of the page to the closing form.
 */

const INCLUDED: [string, string][] = [
  ['$89/year founding price',
   'Lock in founding pricing for as long as you remain a member.'],
  ['Early access',
   'Be among the first to experience Ciatta.'],
  ['Shape what’s next',
   'Help shape the product as Ciatta grows.'],
];

export function FoundingCard() {
  return (
    <div className="fm">
      {/* The label is part of the card, not a banner over the hero: it sits
          on the card's own right edge and shares its measure, so the two
          read as one object rather than as a badge dropped on a photograph. */}
      <p className="fm-badge">First 500 members</p>

      <div className="fm-card">
        <p className="fm-eyebrow">Founding member pricing</p>
        <h2 className="fm-title">Be among the first 500.</h2>
        <p className="fm-lede">
          Founding members lock in $89/year before Ciatta opens at the regular
          $119/year membership.
        </p>

        <dl className="fm-list">
          {INCLUDED.map(([name, line]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{line}</dd>
            </div>
          ))}
        </dl>

        {/* The size of the thing, said once, under a rule. Not a counter and
            not a countdown: nothing here claims any of them have gone. */}
        <p className="fm-cap">500 founding memberships</p>

        <ReserveButton className="fm-go" label="Reserve your place" fallbackId="waitlist-hero" />
        <p className="fm-note">Free to reserve &middot; No card required</p>
      </div>
    </div>
  );
}

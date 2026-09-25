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

/* The three lines became one.
 *
 * "$89/year, for as long as you stay" went because the sentence above it
 * already says stay at $89/year, not $119 — it was the price a third time
 * in a card of fifty words. The other two were a pair of fragments that
 * read better joined than stacked.
 */

export function FoundingCard() {
  return (
    <div className="fm">
      {/* No badge above the card. "FIRST 500 MEMBERS" sat over the
          photograph saying what "Be among the first 500." says an inch
          below it, and a floating pill is the one shape on a hero that
          always reads as an advert stuck to it. */}
      <div className="fm-card">
        <p className="fm-eyebrow">Founding member pricing</p>
        <h2 className="fm-title">Be among the first 500.</h2>
        <p className="fm-lede">
          Reserve before Ciatta opens and stay at $89/year, not $119.
        </p>

        <p className="fm-benefit">
          Early access when Ciatta opens, and a say in what comes next.
        </p>

        {/* Directly under the sentence it follows. The size of the offer
            used to sit between them, which put a fact about supply between
            the reason and the action. */}
        <ReserveButton className="fm-go" label="Reserve your place" fallbackId="waitlist-hero" />
        <p className="fm-note">Free to reserve &middot; No card required</p>
        {/* Last, and it stays on a phone where the button does not: it is
            the one line of the offer that is not a call to action. */}
        <p className="fm-cap">500 founding memberships</p>
      </div>
    </div>
  );
}

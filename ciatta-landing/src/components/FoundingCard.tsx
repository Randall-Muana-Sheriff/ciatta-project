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
 * THE CARD HAS NO BUTTON OF ITS OWN. It had one, and the hero's email form
 * sat a few hundred pixels away saying the same words, which is one offer
 * asked twice. The form is the action now and it comes in as `children`,
 * directly under the card, so the offer and the thing to do about it are one
 * block wherever that block lands — floating at the lower right on a laptop,
 * stacked at the foot of the first screen on a phone.
 *
 * That also means there is one reservation path again rather than two: the
 * form, which is free, takes no card and works today whether or not Stripe
 * is configured.
 */

/* The three lines became one.
 *
 * "$89/year, for as long as you stay" went because the sentence above it
 * already says stay at $89/year, not $119 — it was the price a third time
 * in a card of fifty words. The other two were a pair of fragments that
 * read better joined than stacked.
 */

export function FoundingCard({ children }: { children?: React.ReactNode }) {
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

        {/* Last line of the card. Not a counter and not a countdown:
            nothing here claims any of the 500 have gone. */}
        <p className="fm-cap">500 founding memberships</p>
      </div>

      {/* The action, directly under the card it follows. */}
      {children}
      <p className="fm-note">Free to reserve &middot; No card required</p>
    </div>
  );
}

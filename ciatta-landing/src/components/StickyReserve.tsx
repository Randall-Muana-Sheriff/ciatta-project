import { useEffect, useState } from 'react';

/**
 * The action, kept within reach once the hero's copy of it has scrolled away.
 *
 * WHOOP's shape: a slim bar across the foot of the window carrying the price
 * and the one thing to do about it. Ciatta's materials — paper, a hairline,
 * the same pill the header uses — because a bar that arrives in colours the
 * page does not use reads as an advert that got through.
 *
 * FOUR TIMES IT STAYS OUT OF THE WAY. A bar fixed to the bottom of the window
 * is the most intrusive thing on a page, so it earns its place by knowing
 * when not to be there:
 *
 *   · Not over the hero. The hero has the form itself, and a bar offering to
 *     do what the thing on screen already does is noise.
 *   · Not when a real one is on screen. Over the membership card, which has
 *     its own Reserve button, and over the closing form, which is the field
 *     this bar scrolls to, it would be the same call to action twice six
 *     inches apart. It steps aside and lets the real one work.
 *   · Not over the cookie banner. That is a consent notice, it is fixed to
 *     the same edge, and it is not something a marketing bar may cover.
 *   · Not while the quiz is open. A dialog has the page.
 *
 * It also never traps anyone: it is one line and a button, it does not
 * reappear once dismissed by scrolling back up to the hero, and every route
 * it offers exists elsewhere on the page.
 *
 * What it says is the reason to act today, which is the only thing that
 * belongs in a bar like this: the founding price, and that reserving is free.
 * No countdown, no places-left counter, no closing date.
 */

/**
 * What makes the bar redundant while it is on screen: the membership card,
 * which carries its own Reserve button, and the closing form, which is the
 * field this bar would send her to anyway.
 *
 * Only those two. "Why reserve now" was in this list and should not have
 * been — it is three facts about the price with no button in it, so the bar
 * was standing down for a section that offers no way to act. That plus the
 * closing heading left the bar visible for one short stretch of the page and
 * never again, which is the opposite of the point of it.
 */
const ASKS = '.mb-join, #waitlist-close';

export function StickyReserve() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.querySelector('.hero');
    const asks = Array.from(document.querySelectorAll(ASKS));

    let queued = false;
    const look = () => {
      queued = false;

      // A dialog or a consent notice outranks this.
      if (document.querySelector('.qp') || document.querySelector('.ck')) {
        setShow(false);
        return;
      }

      // Past the hero, which carries the form itself.
      const past = hero ? hero.getBoundingClientRect().bottom < 0 : window.scrollY > 600;

      // And not while the real ask is on screen.
      const h = window.innerHeight;
      const asking = asks.some((el) => {
        const r = el.getBoundingClientRect();
        return r.top < h && r.bottom > 0;
      });

      setShow(past && !asking);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(look);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    /* The cookie banner and the quiz dialog come and go without a scroll, so
       the bar watches the tree as well as the scroll position. */
    const mo = new MutationObserver(onScroll);
    mo.observe(document.body, { childList: true, subtree: false });
    look();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      mo.disconnect();
    };
  }, []);

  /* It finishes here rather than sending her somewhere. The closing form is
     the one that works today, so the button scrolls to it and puts the cursor
     in the field — the same landing the reserve button uses when Stripe is
     not configured, so there is one destination however she gets there. */
  function go() {
    const field = document.querySelector<HTMLInputElement>('#waitlist-close');
    if (!field) { window.location.href = '/member/#membership'; return; }
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => field.focus({ preventScroll: true }), 400);
  }

  if (!show) return null;

  return (
    <div className="sr-bar">
      <p className="sr-bar-line">
        <b>$89 founding price</b>
        <span>Free to reserve. No card.</span>
      </p>
      <button type="button" className="sr-bar-go" onClick={go}>Reserve your place</button>
    </div>
  );
}

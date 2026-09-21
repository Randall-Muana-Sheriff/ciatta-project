/**
 * The browsing effect: text arrives as you reach it.
 *
 * WHOOP's pages do one thing as you scroll — a line lifts a few pixels and
 * fades up as it comes into view, the parts of a block a beat apart so the
 * heading lands before its sentence. Nothing slides in from the side,
 * nothing scales, nothing bounces. It reads as the page settling rather
 * than as an effect, which is the only version of this worth having on a
 * page about someone's health.
 *
 * THE RULE THIS IS BUILT TO: it must fail visible.
 *
 * A reveal is opacity 0 until a class arrives. If the observer never runs —
 * old browser, a script error earlier on the page, a bot that does not
 * execute JavaScript — the page must not be blank. So:
 *
 *   - `data-reveal="on"` is set on <html> by this file, and the CSS that
 *     hides anything is nested under it. No JavaScript, nothing hidden.
 *   - The attribute is not set when the script starts. It is set inside the
 *     observer's own first callback — proof that the observer is alive and
 *     delivering. If IntersectionObserver is missing, throws, or never calls
 *     back, the attribute is never set and every word stays on the page.
 *   - Anything already on screen at that first callback is revealed in the
 *     same breath, so nothing above the fold flashes out and back.
 *   - A ten-second backstop as belt and braces.
 *
 * The first version of this used a four-second timer as the primary safety
 * net, which was wrong twice: it hid the page first and asked questions
 * later, and anyone who landed and read for four seconds before scrolling
 * got no animation at all, because everything had already been revealed
 * underneath them.
 *
 * It also respects prefers-reduced-motion, in CSS rather than here, so the
 * setting is honoured even if this file is what failed.
 */

/** What moves. Section-level text, never the hero and never a control. */
const TARGETS = [
  '.band-head > *',
  '.m-h2',
  '.m-h2-sub',
  '.hw2-item',
  '.hw2-steps > li',
  '.mb-card',
  '.who-tile p',
  '.hm-title',
  '.ex-title',
  '.ex-lede',
  '.qa-item',
  '.sf-foot',
  '.mb-time > *',
  '.split-lead > *',
  '.split-body > *',
  '.briefs-card',
  '.briefs-group-head > *',
  '.close-lines',
  '.ft-brand',
  '.ft-cols > div',
].join(',');

/**
 * The hero is never touched: it is the first screen, every word of it has to
 * be there on arrival, and it was measured to fit above the fold. The
 * statement has its own slide-over and would be animating twice.
 */
const EXCLUDE = '.hero, .hero *, .statement, .statement *, .ck, .ck *';

const REVEALED = 'is-in';

export function initReveal(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(TARGETS))
    .filter((el) => !el.matches(EXCLUDE) && !el.closest('.hero, .statement'));

  if (!nodes.length) return;

  const revealAll = () => nodes.forEach((el) => el.classList.add(REVEALED));

  // Nothing is hidden and nothing can be hidden: the attribute the CSS keys
  // on is never set, so every rule in that block stays inert.
  if (!('IntersectionObserver' in window)) return;

  // Stagger within a block, not across the page: the parts of one heading
  // group arrive a beat apart, and every group starts from zero.
  const seen = new Map<Element, number>();
  for (const el of nodes) {
    const group = el.parentElement ?? document.body;
    const i = seen.get(group) ?? 0;
    seen.set(group, i + 1);
    el.style.setProperty('--reveal-i', String(Math.min(i, 5)));
  }

  /* Observe only once the page has its real height.
     An IntersectionObserver fires an initial callback for every target at
     the moment it is observed, using the layout as it stands then. React has
     committed by the time this runs, but the film and the photographs have
     not been sized, so the document is a fraction of its final height and
     every section — including the footer, eight thousand pixels down — is
     inside the viewport. Observing there reveals the entire page at once,
     which is exactly what the first version of this did.

     So: wait for load, then two frames, and read a settled layout. */
  let armed = false;
  const io = new IntersectionObserver(
    (entries) => {
      // The first callback is the proof the observer works, and only then
      // does the CSS get permission to hide anything. Everything already on
      // screen is marked in the same pass, so it never flashes out.
      if (!armed) {
        armed = true;
        root.setAttribute('data-reveal', 'on');
      }
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add(REVEALED);
        io.unobserve(e.target);
      }
    },
    // A little before the edge, so a line is already settled by the time it
    // is properly in view rather than animating under the reader's eye.
    { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
  );

  const start = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      nodes.forEach((el) => io.observe(el));
    }));
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  // Belt and braces, long enough not to pre-empt the effect for someone who
  // lands and reads before scrolling.
  window.setTimeout(revealAll, 10000);
}

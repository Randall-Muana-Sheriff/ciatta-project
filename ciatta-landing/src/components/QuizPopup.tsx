import { useEffect, useRef, useState } from 'react';
import { QuizFlow } from './SymptomQuiz';

/**
 * The quiz, offered once, after the page has shown her something.
 *
 * WHY IT IS A POPUP AGAIN, AND WHAT THAT COSTS.
 *
 * A dialog that asks about someone's body is a real imposition, so this one
 * is built to the rules that make it bearable:
 *
 *   · It arrives at one moment only: when she has scrolled past "Your cycle
 *     changed", which is the first point on the page where she has been
 *     shown what Ciatta actually does rather than told. Before that there is
 *     nothing earned to ask on the back of.
 *   · Once, ever. Dismiss it and it is remembered and never shown again.
 *   · Four ways out: the close button, Escape, the backdrop, and the button
 *     under the card. None of them are hidden and none are delayed.
 *   · It never interrupts. It waits for a scroll to pass a line; it does not
 *     fire on a timer, on exit intent, or on a click somewhere else.
 *   · Under Reduce Motion it does not animate in, and it never opens at all
 *     if the browser cannot remember that it was dismissed.
 *
 * The page it interrupts keeps its own way in: /quiz/ is in the header and
 * the footer of every page, so nobody has to meet this to take the quiz and
 * anybody who dismissed it can still find it.
 *
 * WHAT IT REMEMBERS. One key, `ciatta.quiz.seen`, in this browser only. No
 * cookie, nothing sent anywhere, and no record of a single answer: the quiz
 * runs entirely in the page and nothing she taps leaves it.
 */

const KEY = 'ciatta.quiz.seen';

/** Storage can throw outright in a private window, so every touch is wrapped. */
function seen(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
}
function remember(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* nothing to do */ }
}

export function QuizPopup({ after }: { after: string }) {
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLDivElement | null>(null);
  const cameFrom = useRef<HTMLElement | null>(null);

  /* ---- when it opens ---------------------------------------------------
     A scroll listener rather than an IntersectionObserver, and that is not
     the obvious choice, so: an observer only fires when the intersection
     state CHANGES. Jump the page rather than scroll it — an anchor link, a
     deep link, a restored scroll position, a browser back — and the section
     goes from "below the viewport, not intersecting" to "above it, not
     intersecting" with no frame in between. The state never changed, so the
     callback never ran and the dialog never opened. Measured: a scroll
     straight past it produced no callback at all.

     What is actually being asked is simpler than an observer anyway: has the
     foot of that section gone past the top of the window. So that is the
     question, asked on scroll, throttled to a frame, and asked once on mount
     for anyone who arrived already past it. */
  useEffect(() => {
    if (seen()) return;
    const mark = document.querySelector(after);
    if (!mark) return;

    let queued = false;
    const look = () => {
      queued = false;
      if (mark.getBoundingClientRect().bottom > 0) return;
      window.removeEventListener('scroll', onScroll);
      cameFrom.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(look);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    look();
    return () => window.removeEventListener('scroll', onScroll);
  }, [after]);

  /* ---- while it is open ------------------------------------------------- */
  useEffect(() => {
    if (!open) return;

    const shut = () => close();

    // Escape, and a focus trap that keeps Tab inside the card.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); shut(); return; }
      if (e.key !== 'Tab' || !card.current) return;
      const can = card.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      );
      if (!can.length) return;
      const first = can[0];
      const last = can[can.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    // The page behind must not scroll under the dialog. Its position is put
    // back exactly, because a dialog that moves the page is worse than none.
    const y = window.scrollY;
    const body = document.body;
    const was = body.style.cssText;
    body.style.cssText += `position:fixed;top:${-y}px;left:0;right:0;width:100%;`;

    document.addEventListener('keydown', onKey);
    // Focus the card itself rather than the first control: the heading is
    // read out, and nothing is pressed by accident.
    card.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.cssText = was;
      window.scrollTo(0, y);
    };
  }, [open]);

  function close() {
    remember();
    setOpen(false);
    cameFrom.current?.focus?.();
  }

  if (!open) return null;

  return (
    <div className="qp" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div
        className="qp-card" role="dialog" aria-modal="true"
        aria-labelledby="qp-heading" tabIndex={-1} ref={card}
      >
        <button type="button" className="qp-x" onClick={close}>
          <span className="sr-only">Close</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor"
               strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <div className="qp-head">
          <h2 id="qp-heading" className="qp-title">
            What should you be paying attention to?
          </h2>
          <p className="qp-sub">
            Take 60 seconds to see what may be worth exploring in your health.
          </p>
        </div>

        <div className="qp-body">
          <QuizFlow />
        </div>

        {/* Said plainly, at the bottom, where someone looking for the way out
            looks. "Not now" rather than "No thanks": she is not refusing an
            offer, she is choosing when. */}
        <button type="button" className="qp-not" onClick={close}>Not now</button>
      </div>
    </div>
  );
}

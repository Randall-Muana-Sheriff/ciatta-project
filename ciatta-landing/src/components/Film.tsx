import { useEffect, useRef, useState } from 'react';
import { isPaused, onPause } from '../lib/film';

/**
 * A background film layer: the clip, a scrim over it, and a poster for anyone
 * who has asked not to be moved.
 *
 * Motion & Interaction v1.0 says "Nothing auto-advances or auto-plays." That
 * rule is written for the product, where the body is the only thing permitted
 * to move. A landing page is not the product, so the film runs, but the rule
 * is honoured where it actually protects someone: under Reduce Motion the
 * video is never mounted and the poster stands in its place. The system's own
 * principle covers it, since "every state has an end frame, and the end frame
 * is a complete design."
 *
 * `base` names the three files in /public/video: <base>.webm, <base>.mp4 and
 * <base>-poster.jpg. `className` and `scrim` let a section keep its own crop
 * and its own scrim weighting, because where the calm part of the frame sits
 * is a property of the clip, not of this component.
 *
 * `controlled` hands the clip to the hero's pause button. Only the home
 * hero passes it: the How it works and membership pages draw films with this
 * same component and have no button, and a switch on one page must not stop
 * a video on another.
 */
export function Film({
  base,
  className = 'hero-film',
  scrim = 'hero-scrim',
  width = 1600,
  height = 900,
  controlled = false,
}: {
  base: string;
  className?: string;
  scrim?: string;
  width?: number;
  height?: number;
  /** Obey the hero's pause button. */
  controlled?: boolean;
}) {
  // Assume reduced until proven otherwise, so a reduced-motion viewer never
  // catches a frame of playback during hydration.
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotionOk(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /* The element, so the switch can reach it. Pausing the <video> rather than
     unmounting it keeps the frame on screen: a paused film is a still, and a
     removed one is a hole in the page. */
  const film = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!controlled) return;
    const apply = (p: boolean) => {
      const el = film.current;
      if (!el) return;
      if (p) el.pause();
      else void el.play().catch(() => {});
    };
    apply(isPaused());
    return onPause(apply);
  }, [controlled, motionOk]);

  const poster = `/video/${base}-poster.jpg`;

  return (
    <div className={className} aria-hidden="true">
      {motionOk ? (
        <video ref={film} poster={poster} autoPlay muted loop playsInline preload="metadata">
          <source src={`/video/${base}.webm`} type="video/webm" />
          <source src={`/video/${base}.mp4`} type="video/mp4" />
        </video>
      ) : (
        <img src={poster} alt="" width={width} height={height} />
      )}
      <div className={scrim} />
    </div>
  );
}

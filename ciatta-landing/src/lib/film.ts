/**
 * One switch for everything moving in the hero.
 *
 * The hero has two moving things: the film behind it, and the phone story in
 * front of it. They are separate components in separate parts of the tree,
 * and until now only the story had a control. Pressing pause stopped the
 * story and left the film running, which is not what pause means.
 *
 * So the state lives here, outside both of them, in about twenty lines. A
 * React context would need a provider wrapped around the hero and would buy
 * nothing: this is one boolean, read by two components, on one page.
 *
 * Anything that wants to be governed by the hero's pause button subscribes.
 * Film does it only when it is asked to (`controlled`), because the same
 * component draws the films on the How it works and membership pages, and
 * those have no button and must not be stopped by one.
 */

let paused = false;
const listeners = new Set<(p: boolean) => void>();

export const isPaused = () => paused;

export function setPaused(next: boolean): void {
  if (next === paused) return;
  paused = next;
  for (const fn of listeners) fn(paused);
}

/** Subscribe. Returns the unsubscribe, for useEffect's cleanup. */
export function onPause(fn: (p: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/* -------------------------------------------------------------------------
   HOW FAR THROUGH THE FILM IS
   -------------------------------------------------------------------------
   The ring around the hero's button reports the clip's own position, so the
   figure has to travel from the <video> to the button, which are two
   components apart. Same twenty lines as the pause switch, for the same
   reason: one number, read by one component, on one page.

   0 to 1. The hero clip loops, so this sweeps and starts again, which is
   what a looping video actually does and what Apple's own inline controls
   show when their clips loop.
   ------------------------------------------------------------------------- */

let played = 0;
const watchers = new Set<(p: number) => void>();

export const progress = () => played;

export function setProgress(p: number): void {
  const next = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
  if (next === played) return;
  played = next;
  for (const fn of watchers) fn(played);
}

/** Subscribe. Returns the unsubscribe, for useEffect's cleanup. */
export function onProgress(fn: (p: number) => void): () => void {
  watchers.add(fn);
  return () => { watchers.delete(fn); };
}

import type { Episode } from './cycleLog';
import type { Intervention } from '../lib/engine';

// A load landing after she has already added or changed something locally
// (while that network round trip was in flight) must never make it look
// like that vanished, only to reappear next launch. These pure merges are
// what the cycle store's load effect applies instead of replacing local
// state outright. Pure and free of AsyncStorage or React, so they can be
// tested directly with no native mocking.

// The server copy wins per id (it is the saved truth for anything both
// sides know about), but anything only known locally (added or edited since
// the load started) is kept, appended after.
export function mergeEpisodes(loaded: Episode[], local: Episode[]): Episode[] {
  const ids = new Set(loaded.map((e) => e.id));
  return [...loaded, ...local.filter((e) => !ids.has(e.id))];
}

// Local wins per key: anything she flipped locally during the load stays as
// she left it; the saved map only fills in keys she has not touched.
export function mergeWatching(saved: Record<string, boolean> | undefined, local: Record<string, boolean>): Record<string, boolean> {
  return { ...(saved ?? {}), ...local };
}

// Local wins per id: an intervention accepted during the load is kept; the
// saved list only adds ones she does not already have.
export function mergeInterventions(saved: Intervention[] | undefined, local: Intervention[]): Intervention[] {
  const ids = new Set(local.map((v) => v.id));
  return [...local, ...(saved ?? []).filter((v) => !ids.has(v.id))];
}

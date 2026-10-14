// One signal for "her profile changed": a name, a personal detail, a
// Health Details list, a goal, her cycle condition. Anything that reads
// those (the Overview paragraph, the concierge's context, insights) listens
// and reads again, so a change made in one sheet shows everywhere at once.

import { useEffect, useState } from 'react';

let revision = 0;
const listeners = new Set<() => void>();

export const profileRevision = () => revision;

export function bumpProfile() {
  revision += 1;
  for (const l of [...listeners]) l();
}

export function onProfileChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The current revision, re rendering whenever it moves.
export function useProfileRevision(): number {
  const [r, setR] = useState(revision);
  useEffect(() => onProfileChange(() => setR(revision)), []);
  return r;
}

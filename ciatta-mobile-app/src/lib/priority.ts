// What Ciatta would put in front of you today, if it could only say one thing.
//
// Today shows the Understanding's seeing plus engine guidance. Priority is
// that guidance, never a client invented target.

import type { Domain } from './types';
import type { UnderstandingRow } from './queries';
import { displayCopy } from './displayCopy';

export interface TodayPriority {
  text: string;
  domain: Domain;
  measured: boolean;
  consider?: string;
}

export function derivePriority(featured: UnderstandingRow | null): TodayPriority | null {
  if (!featured?.guidance) return null;
  return {
    text: displayCopy(featured.guidance),
    domain: featured.domain,
    measured: true,
  };
}

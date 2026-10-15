// Which view of Today's patterns she last chose, Today or Journey. Shared
// by the card on Today and its detail screen, and kept for the session.

import { useEffect, useState } from 'react';

export const PATTERN_VIEWS = ['Today', 'Journey'] as const;
export type PatternView = (typeof PATTERN_VIEWS)[number];

let current: PatternView = 'Today';
const listeners = new Set<(v: PatternView) => void>();

export function usePatternView(): [PatternView, (v: PatternView) => void] {
  const [view, setView] = useState<PatternView>(current);
  useEffect(() => {
    listeners.add(setView);
    setView(current);
    return () => {
      listeners.delete(setView);
    };
  }, []);
  const choose = (v: PatternView) => {
    current = v;
    for (const l of listeners) l(v);
  };
  return [view, choose];
}

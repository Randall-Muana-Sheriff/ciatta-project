// Her reactions to insights: thumbs up, thumbs down, saved. Shown at once,
// saved behind, and read again when Today is back in view.

import { useCallback, useEffect, useState } from 'react';

import type { InsightReaction } from '../lib/insights';
import { useNav } from '../navigation';
import { useRepo } from './session';

const NONE: InsightReaction = { reaction: null, saved: false };

export function useInsightReactions() {
  const repo = useRepo();
  const nav = useNav();
  const [reactions, setReactions] = useState<Record<string, InsightReaction>>({});
  useEffect(() => {
    repo.loadInsightReactions().then(setReactions).catch(() => {});
  }, [repo, nav.depth]);
  const react = useCallback(
    (id: string, patch: Partial<InsightReaction>) => {
      setReactions((prev) => {
        const next = { ...(prev[id] ?? NONE), ...patch };
        repo.saveInsightReaction(id, next).catch(() => {});
        return { ...prev, [id]: next };
      });
    },
    [repo],
  );
  return { reactions, react, of: (id: string) => reactions[id] ?? NONE };
}

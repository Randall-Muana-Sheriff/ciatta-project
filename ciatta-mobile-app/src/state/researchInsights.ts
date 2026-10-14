// The research library and which insights connect to her record today.

import { useEffect, useMemo, useState } from 'react';

import { INSIGHTS, type InsightMatch, type InsightReaction, matchInsights, rankInsights, type ResearchInsight } from '../lib/insights';
import { useAgentContext } from './agentContext';
import { useRepo } from './session';
import { useProfileRevision } from './profileRevision';

// Ranked by her reactions when they are given, so what she likes and saves
// rises and what she turns down goes.
export function useResearchInsights(reactions: Record<string, InsightReaction> = {}): { matches: InsightMatch[]; library: ResearchInsight[] } {
  const repo = useRepo();
  const { context } = useAgentContext();
  const [library, setLibrary] = useState<ResearchInsight[]>(INSIGHTS);
  const [conditions, setConditions] = useState<string[]>([]);
  const revision = useProfileRevision();
  useEffect(() => {
    repo.loadResearchInsights().then(setLibrary).catch(() => {});
    repo.loadReported().then((r) => setConditions(r.conditions)).catch(() => {});
  }, [repo, revision]);
  const matches = useMemo(() => rankInsights(matchInsights(library, context, conditions, new Date()), reactions), [library, context, conditions, reactions]);
  return { matches, library };
}

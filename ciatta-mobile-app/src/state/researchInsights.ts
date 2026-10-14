// The research library and which insights connect to her record today.

import { useEffect, useMemo, useState } from 'react';

import { INSIGHTS, type InsightMatch, matchInsights, type ResearchInsight } from '../lib/insights';
import { useAgentContext } from './agentContext';
import { useRepo } from './session';

export function useResearchInsights(): { matches: InsightMatch[]; library: ResearchInsight[] } {
  const repo = useRepo();
  const { context } = useAgentContext();
  const [library, setLibrary] = useState<ResearchInsight[]>(INSIGHTS);
  const [conditions, setConditions] = useState<string[]>([]);
  useEffect(() => {
    repo.loadResearchInsights().then(setLibrary).catch(() => {});
    repo.loadReported().then((r) => setConditions(r.conditions)).catch(() => {});
  }, [repo]);
  const matches = useMemo(() => matchInsights(library, context, conditions, new Date()), [library, context, conditions]);
  return { matches, library };
}

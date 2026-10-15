// Her body, system by system: the body map and each system with what her
// record says about it. Shown on Today under the Explore toggle; Explore on
// a system asks Ciatta about it in the chat.

import { useEffect, useMemo, useState } from 'react';

import { askCare } from '../lib/careHandoff';
import { type BodyPoint, readBody } from '../lib/bodyMap';
import { drawsFromLabs } from '../lib/labs';
import { loggedPoints } from '../lib/systemLogs';
import { defaultTopic, explorePrompt } from '../lib/systemReview';
import { useNav } from '../navigation';
import { useAgentContext } from '../state/agentContext';
import { useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useLabs } from '../state/labs';
import { useData, useRepo } from '../state/session';
import { BodySystemView } from './BodySystemView';

export function BodyView() {
  const nav = useNav();
  const repo = useRepo();
  const { ranked } = useInsights();
  const { signals, profile } = useCycleInsights();
  const { context } = useAgentContext();
  const { days } = useData();
  const labs = useLabs();
  const [conditions, setConditions] = useState<string[]>([]);
  // What she told Ciatta, placed under the systems it is about. Read again
  // when Today is back in view, so something she just said shows.
  const [logged, setLogged] = useState<BodyPoint[]>([]);
  useEffect(() => {
    if (nav.depth > 0) return;
    let ignore = false;
    repo
      .loadJournal()
      .then((j) => !ignore && setLogged(loggedPoints(j, new Date())))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);
  useEffect(() => {
    repo
      .loadReported()
      .then((r) => setConditions(r.conditions))
      .catch(() => {});
  }, [repo]);
  const body = useMemo(() => {
    const read = readBody({ signals, days, ranked, draws: drawsFromLabs(labs) });
    return { ...read, systemic: [...read.systemic, ...logged] };
  }, [signals, days, ranked, labs, logged]);

  return (
    <BodySystemView
      reading={body}
      signals={signals}
      context={context}
      conditions={conditions}
      situations={profile.situations}
      onExplore={(system, topic) => {
        // With no topic chosen, what she is managing leads: for
        // Reproductive, endometriosis when it is on her record.
        askCare(explorePrompt(system, topic ?? defaultTopic(system, conditions)));
        nav.push('ciatta');
      }}
    />
  );
}

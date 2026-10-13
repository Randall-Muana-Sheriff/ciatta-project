import { useMemo } from 'react';

import { buildInsights } from '../lib/engine';
import { useCycle, useCycleInsights } from './cycleStore';
import { drawsFromLabs } from '../lib/labs';
import { useLabs } from './labs';
import { useData } from './session';

// The shared insight layer, as every screen sees it.
export function useInsights() {
  const { episodes, watching, interventions } = useCycle();
  const cycle = useCycleInsights();
  const { days, today } = useData();
  // Her own labs, from her providers and the reports she had read.
  const labs = useLabs();
  const draws = useMemo(() => drawsFromLabs(labs), [labs]);
  return useMemo(
    () =>
      buildInsights({
        days,
        episodes,
        windows: cycle.windows,
        summaries: cycle.summaries,
        signals: cycle.signals,
        cycleObservations: cycle.observations,
        draws,
        interventions,
        watching,
        opening: today.brief,
      }),
    [days, draws, today, episodes, watching, interventions, cycle],
  );
}

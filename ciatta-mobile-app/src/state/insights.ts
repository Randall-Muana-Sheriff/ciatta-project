import { useMemo } from 'react';

import { buildInsights } from '../lib/engine';
import { useCycle, useCycleInsights } from './cycleStore';
import { useData } from './session';

// The shared insight layer, as every screen sees it.
export function useInsights() {
  const { episodes, watching, interventions } = useCycle();
  const cycle = useCycleInsights();
  const { days, records, today } = useData();
  return useMemo(
    () =>
      buildInsights({
        days,
        episodes,
        windows: cycle.windows,
        summaries: cycle.summaries,
        signals: cycle.signals,
        cycleObservations: cycle.observations,
        draws: records?.draws ?? [],
        interventions,
        watching,
        opening: today.brief,
      }),
    [days, records, today, episodes, watching, interventions, cycle],
  );
}

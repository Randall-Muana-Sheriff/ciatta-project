import { useMemo } from 'react';

import { loadDays } from '../data/daily';
import { records, today } from '../data/sample';
import { buildInsights } from '../lib/engine';
import { useCycle, useCycleInsights } from './cycleStore';

// The shared insight layer, as every screen sees it.
export function useInsights() {
  const { episodes, watching, interventions } = useCycle();
  const cycle = useCycleInsights();
  return useMemo(
    () =>
      buildInsights({
        days: loadDays(),
        episodes,
        windows: cycle.windows,
        summaries: cycle.summaries,
        signals: cycle.signals,
        cycleObservations: cycle.observations,
        draws: records.draws,
        interventions,
        watching,
        opening: today.brief,
      }),
    [episodes, watching, interventions, cycle],
  );
}

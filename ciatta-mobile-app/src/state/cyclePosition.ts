// Where today sits in her cycle, and the phase in the corner of the cycle
// row: Today's patterns on Today, and the same row on its detail screen.

import { useMemo } from 'react';

import {
  clinicalPhase,
  clinicalPhaseLabel,
  countedWindows,
  cycleToday,
  estimatedPhase,
  estimatedPhaseLabel,
  medianLength,
} from '../lib/cycleModel';
import { useCycleInsights } from './cycleStore';

export function useCyclePosition() {
  const { windows, lens, profile, fertility } = useCycleInsights();
  // Where today sits in her cycle. Null when there is no open cycle or
  // when it has been left open too long to mean anything, and the header
  // then says nothing rather than guessing.
  //
  // Kept as the object rather than only its line, because Metrics shows the
  // two halves apart: the day is a number she can read like a step count,
  // and the phase is the part that means something.
  const cycleNow = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const predicted = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
    return cycleToday(open && !open.end ? open : null, predicted, new Date());
  }, [windows, lens, profile]);

  // The phase, in the corner of the cycle row.
  //
  // The clinical name when it has been earned: only a confirmed ovulation
  // counts, from a logged test or a temperature shift. Otherwise an
  // estimate, and the label says "Likely" so an estimate is never shown as
  // a position.
  const phaseText = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const confirmed =
      fertility?.confirmedThisCycle && open
        ? ([...(fertility.past ?? [])]
            .reverse()
            .find((o) => o.date >= open.start)?.date ?? null)
        : null;
    const today = new Date();
    const bleeding = !!open && !open.end && cycleNow != null && cycleNow.day <= 5 && cycleNow.phase === 'During period';
    const clinical = clinicalPhase({ date: today, bleeding, ovulation: confirmed });
    if (clinical) return clinicalPhaseLabel(clinical);
    // Nothing confirmed, so an estimate from the day and her own usual
    // length, labelled as one. An empty corner told her nothing about where
    // she is; "Likely follicular" tells her something and says how sure.
    if (!cycleNow) return null;
    return estimatedPhaseLabel(estimatedPhase(cycleNow.day, medianLength(countedWindows(windows, profile))));
  }, [windows, fertility, cycleNow, profile]);

  return { cycleNow, phaseText };
}

// Everything the agent reads, gathered from her record and read again
// whenever the asking screen is back in view, so a log, a lab or a referral
// she just added is in the next answer and the next card.
import { useEffect, useMemo, useState } from 'react';

import type { Reported } from '../data/repo';
import type { JournalView } from '../data/rows';
import { type AgentContext, buildContext } from '../lib/agent/proactive';
import type { Insurance } from '../lib/insurance';
import type { BaselineRow } from '../lib/metricDetail';
import type { Referral } from '../lib/referrals';
import { useNav } from '../navigation';
import { useCycleInsights } from './cycleStore';
import { useLabs } from './labs';
import { useData, useRepo } from './session';

export function useAgentContext(): { context: AgentContext; referrals: Referral[] } {
  const repo = useRepo();
  const nav = useNav();
  const { days } = useData();
  const { signals } = useCycleInsights();
  const labs = useLabs();
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  const [journal, setJournal] = useState<JournalView | null>(null);
  const [reported, setReported] = useState<Reported | null>(null);
  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  useEffect(() => {
    let ignore = false;
    const keep = <T,>(set: (v: T) => void) => (v: T) => {
      if (!ignore) set(v);
    };
    repo.loadBaselines().then(keep(setBaselines)).catch(() => {});
    repo.loadJournal().then(keep(setJournal)).catch(() => {});
    repo.loadReported().then(keep(setReported)).catch(() => {});
    repo.loadInsurance().then(keep(setInsurance)).catch(() => {});
    repo.loadReferrals().then(keep(setReferrals)).catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);

  const context = useMemo(
    () =>
      buildContext({
        days,
        baselines,
        labs,
        logs: (journal?.months ?? []).flatMap((m) => m.items),
        signals,
        reported,
        insurance,
        referrals,
        now: new Date(),
      }),
    [days, baselines, labs, journal, signals, reported, insurance, referrals],
  );
  return { context, referrals };
}

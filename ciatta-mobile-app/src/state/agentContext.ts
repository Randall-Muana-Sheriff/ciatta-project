// Everything the agent reads, gathered from her record and read again
// whenever the asking screen is back in view, so a log, a lab or a referral
// she just added is in the next answer and the next card.
import { useEffect, useMemo, useState } from 'react';

import type { Reported } from '../data/repo';
import type { JournalView } from '../data/rows';
import { type AgentContext, buildContext, latestVitals, type Vitals } from '../lib/agent/proactive';
import { upcomingVisits, visitWhen } from '../lib/calendarEvents';
import { countedWindows, cycleToday, estimatedPhase, estimatedPhaseLabel, medianLength } from '../lib/cycleModel';
import { DAY_READ, dayPatterns } from '../lib/dayPatterns';
import type { IntradayPoint } from '../data/repo';
import { useCycle } from './cycleStore';
import { useDeviceCalendar } from './deviceCalendar';
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
  const { signals, windows, profile, lens } = useCycleInsights();
  const { episodes } = useCycle();
  const [vitals, setVitals] = useState<Vitals>({ bp: null, spo2: null });
  const [intraday, setIntraday] = useState<IntradayPoint[]>([]);
  // Her calendar, read only when she already allowed it; never asked here.
  const week = useMemo(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + 8 * 86400000) };
  }, []);
  const calendar = useDeviceCalendar(week.from, week.to);
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
    repo.loadVitals().then((rows) => keep(setVitals)(latestVitals(rows))).catch(() => {});
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    repo.loadIntraday(midnight.toISOString(), DAY_READ).then(keep(setIntraday)).catch(() => {});
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
        vitals,
        episodes,
        cycle: (() => {
          const open = windows[windows.length - 1] ?? null;
          const usual = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
          const c = cycleToday(open && !open.end ? open : null, usual, new Date());
          if (!c) return null;
          return { day: c.day, phase: usual ? estimatedPhaseLabel(estimatedPhase(c.day, usual)) : null };
        })(),
        visit: (() => {
          const v = upcomingVisits(calendar.events, new Date(), 7)[0];
          return v ? { title: v.title, when: visitWhen(v, new Date()), location: v.location } : null;
        })(),
        today: dayPatterns(intraday, new Date()).series.map((x) => ({ label: x.label, range: x.range })),
      }),
    [days, baselines, labs, journal, signals, reported, insurance, referrals, vitals, episodes, windows, profile, lens, calendar.events, intraday],
  );
  return { context, referrals };
}

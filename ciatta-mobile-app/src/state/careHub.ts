// Everything Your Care shows, gathered once and read again whenever the
// Care tab is back in view, so a request she just marked sent or a lab
// that just arrived is there.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import { type Connection, loadClinicalRecords, loadConnections } from '../data/providers';
import type { JournalView } from '../data/rows';
import type { Reported } from '../data/repo';
import { interventions } from '../lib/agent/proactive';
import { upcomingVisits, visitWhen } from '../lib/calendarEvents';
import { type CareRequest, careTeam, type ClinicianRow, latestActivity, openPlan, openRequests, prescriptions } from '../lib/care';
import type { Meal } from '../lib/foodScan';
import { labDraws } from '../lib/labs';
import { nextAction } from '../lib/referrals';
import type { ClinicalRecord } from '../lib/providers/fhirMap';
import { useNav } from '../navigation';
import { useAgentContext } from './agentContext';
import { useCycle } from './cycleStore';
import { useDeviceCalendar } from './deviceCalendar';
import { useLabs } from './labs';
import { useRepo } from './session';

export function useCareHub() {
  const repo = useRepo();
  const nav = useNav();
  const { context, referrals } = useAgentContext();
  const { episodes } = useCycle();
  const labs = useLabs();
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [team, setTeam] = useState<ClinicianRow[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [clinical, setClinical] = useState<ClinicalRecord[]>([]);
  const [journal, setJournal] = useState<JournalView | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [reported, setReported] = useState<Reported | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (nav.depth > 1) return;
    let ignore = false;
    const keep = <T,>(set: (v: T) => void) => (v: T) => {
      if (!ignore) set(v);
    };
    repo.loadRequests().then(keep(setRequests)).catch(() => {});
    repo.loadCareTeam().then(keep(setTeam)).catch(() => {});
    repo.loadJournal().then(keep(setJournal)).catch(() => {});
    repo.loadReported().then(keep(setReported)).catch(() => {});
    repo.loadMeals(new Date(Date.now() - 14 * 86400000).toISOString()).then(keep(setMeals)).catch(() => {});
    loadConnections().then(keep(setConnections)).catch(() => {});
    loadClinicalRecords().then(keep(setClinical)).catch(() => {});
    AsyncStorage.getItem('ciatta.care.dismissed')
      .then((v) => v && keep(setDismissed)(new Set(JSON.parse(v) as string[])))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);

  const week = useMemo(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + 8 * 86400000) };
  }, []);
  const calendar = useDeviceCalendar(week.from, week.to);

  return useMemo(() => {
    const now = new Date();
    const open = openRequests(requests);
    const next = upcomingVisits(calendar.events, now, 7)[0];
    const logs = (journal?.months ?? []).flatMap((m) => m.items);
    return {
      requests,
      open,
      plan: openPlan({
        cards: interventions(context, now, dismissed),
        referrals: referrals.map((r) => ({ id: r.id, specialty: r.specialty, next: nextAction(r, !!context.insurance)?.text ?? null })),
        visit: next ? { title: next.title, when: visitWhen(next, now) } : null,
        requests: open.length,
      }),
      activity: latestActivity({
        labs: labs.map((l) => ({ name: l.name, on: l.on, source: l.source })),
        logs,
        episodes,
        meals,
        requests,
        referrals,
        now,
      }),
      rx: prescriptions({
        reported: reported?.medications ?? [],
        clinical,
        logged: context.meds.medications,
        missed: context.meds.month.find((m) => m.label === 'Missed a dose')?.days ?? 0,
      }),
      latestDraw: labDraws(labs)[0] ?? null,
      insurance: context.insurance,
      team: careTeam({
        added: team,
        providers: connections,
        referrals,
        visits: calendar.events.map((e) => e.title),
      }),
      name: null as string | null,
    };
  }, [requests, team, connections, clinical, journal, meals, reported, dismissed, context, referrals, labs, episodes, calendar.events]);
}

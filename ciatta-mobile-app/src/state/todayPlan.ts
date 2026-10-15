// Plans & Protocols: what she could do today, each item with its reason in
// her own numbers (lib/actionPlan), and what tapping one does. Read from
// the same state Today reads, so the plan is the one Today used to show.

import { useEffect, useMemo, useState } from 'react';

import { actionPlan, type PlanItem } from '../lib/actionPlan';
import { upcomingVisits, visitWhen } from '../lib/calendarEvents';
import { countedWindows, medianLength } from '../lib/cycleModel';
import { chooseMetric } from '../lib/metricHandoff';
import { type BaselineRow, type MetricKey, usualFor } from '../lib/metricDetail';
import { useNav } from '../navigation';
import { useCyclePosition } from './cyclePosition';
import { useCycle, useCycleInsights } from './cycleStore';
import { useDeviceCalendar } from './deviceCalendar';
import { useInsights } from './insights';
import { usePlanDone } from './planDone';
import { planNudges } from '../lib/planNudges';
import { phoneScheduler, remindersAllowed } from './notifications';
import { useData, useRepo } from './session';

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function useTodayPlan() {
  const nav = useNav();
  const repo = useRepo();
  const { accept, watching, setWatching, episodes } = useCycle();
  const { today: brief, ranked } = useInsights();
  const { windows, lens, profile } = useCycleInsights();
  const { days } = useData();
  const { cycleNow } = useCyclePosition();

  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  useEffect(() => {
    let ignore = false;
    repo
      .loadBaselines()
      .then((rows) => !ignore && setBaselines(rows))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);

  const week = useMemo(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + 8 * 86400000) };
  }, []);
  const calendar = useDeviceCalendar(week.from, week.to);
  const nextVisit = useMemo(() => upcomingVisits(calendar.events, new Date(), 7)[0] ?? null, [calendar.events]);

  const now = new Date();
  const todayKey = dayKey(now);
  const todayDay = days.find((d) => d.date === todayKey) ?? null;
  const usualOf = (key: 'sleep' | 'hrv' | 'rhr' | 'steps') => usualFor(key, baselines);
  const usualLength = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
  const loggedToday =
    episodes.some((e) => e.date === todayKey) ||
    (!!todayDay && ([todayDay.mood, todayDay.energy, todayDay.stress].some((v) => v != null) || todayDay.foods.length > 0));
  const plan = actionPlan({
    days,
    usual: {
      sleep: usualOf('sleep')?.median ?? null,
      hrv: usualOf('hrv'),
      rhr: usualOf('rhr'),
      steps: usualOf('steps')?.median ?? null,
    },
    cycle: cycleNow ? { day: cycleNow.day, usualLength, bleeding: cycleNow.phase === 'During period' } : null,
    loggedToday,
    visit: nextVisit ? { title: nextVisit.title, when: visitWhen(nextVisit, now) } : null,
    watchSuggested: brief.lead?.id === 'combined' && watching.nextCycle !== true,
    raise: ranked.find((i) => i.triage === 'Investigate')?.title ?? null,
    walkSuggested: !!brief.recommendation && !brief.walkPlanned,
    now,
  });
  const { done, toggle } = usePlanDone(now);

  // Plans through the day: today's items not yet done, each timed into a
  // free moment of her calendar, as notifications on this phone. Only for
  // her own record, and only once she has allowed notifications; this
  // never asks. Rescheduled whenever the plan or her calendar changes.
  const nudgeKey = plan.filter((p) => !done.includes(p.key)).map((p) => p.key).join(',') + '|' + calendar.events.length;
  useEffect(() => {
    if (repo.mode !== 'real') return;
    let cancelled = false;
    void (async () => {
      if (!(await remindersAllowed(false)) || cancelled) return;
      const ids = await phoneScheduler.list();
      await Promise.all(ids.filter((id) => id.startsWith('plan:')).map((id) => phoneScheduler.cancel(id)));
      const left = plan.filter((p) => !done.includes(p.key));
      for (const n of planNudges(left, calendar.events, new Date())) {
        if (cancelled) return;
        await phoneScheduler.schedule({ id: n.id, title: n.title, body: n.body, at: n.at.toISOString() });
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudgeKey, repo]);

  const openMetric = (key: MetricKey) => {
    chooseMetric(key);
    nav.push('metric');
  };
  const doItem = (item: PlanItem) => {
    switch (item.key) {
      case 'visit':
      case 'prepare':
        return nav.push('appointment');
      case 'period':
        return nav.push('cycle');
      case 'recover':
        return openMetric('hrv');
      case 'sleep':
        return openMetric('sleep');
      case 'walk':
        if (brief.recommendation && !brief.walkPlanned) accept('walk');
        return openMetric('steps');
      case 'watch':
        setWatching('nextCycle', true);
        return toggle('watch');
      // Flow and logging are told to Ciatta now.
      case 'flow':
      case 'log':
        return nav.push('ciatta');
    }
  };

  return { plan, done, toggle, doItem };
}

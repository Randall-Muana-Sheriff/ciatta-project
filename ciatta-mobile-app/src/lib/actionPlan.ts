// Today's plan: a short list of things she could do today, each with the
// reason in her own numbers, in the spirit of a daily action plan. Built
// fresh each day from her record and nothing else.
//
// Every item is earned: short sleep against her own usual, HRV under her
// usual range, a quiet yesterday, a period likely soon, a visit coming up,
// a pattern worth watching. Without her usual there is no comparison, so
// no item. Nothing here tells her to take, start or stop anything; the
// items are about rest, movement, readiness and logging, and the screen
// never presents them as medical advice.

import type { Day } from '../data/daily';
import { fmtCount, fmtHours } from './engine';

export type PlanKey = 'visit' | 'flow' | 'period' | 'recover' | 'sleep' | 'walk' | 'watch' | 'log';
export type PlanItem = { key: PlanKey; title: string; why: string };

type Band = { low: number; high: number };

export type PlanInput = {
  days: readonly Day[];
  usual: { sleep?: number | null; hrv?: Band | null; rhr?: Band | null; steps?: number | null };
  cycle: { day: number; usualLength: number | null; bleeding: boolean } | null;
  loggedToday: boolean;
  visit: { title: string; when: string } | null;
  // From the pattern engine: a combined pattern worth watching next cycle,
  // and a walk it recommended. Passed through so the example and a live
  // record share one plan.
  watchSuggested: boolean;
  walkSuggested: boolean;
  now: Date;
};

const MAX = 4;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function actionPlan(input: PlanInput): PlanItem[] {
  const { now, usual } = input;
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const today = byDate.get(iso(now)) ?? null;
  const yesterday = byDate.get(iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) ?? null;
  // The newest of today's and yesterday's, for readings taken overnight.
  const recent = <T,>(get: (d: Day) => T | null): T | null => (today ? get(today) : null) ?? (yesterday ? get(yesterday) : null);
  const items: PlanItem[] = [];

  if (input.visit) {
    items.push({ key: 'visit', title: `Prepare for ${input.visit.title}`, why: `${input.visit.when}. A brief from your record helps the time go further.` });
  }

  const c = input.cycle;
  if (c?.bleeding && c.day <= 7) {
    items.push({
      key: 'flow',
      title: 'Log today’s flow and any pain',
      why: `Day ${c.day} of your period. A log each day shows how this period compares with your others.`,
    });
  } else if (c && c.usualLength) {
    const left = c.usualLength - c.day;
    if (left >= 0 && left <= 3) {
      items.push({
        key: 'period',
        title: 'Have period products with you',
        why: `Your period is likely in about ${left === 0 ? 'a day' : `${left} ${left === 1 ? 'day' : 'days'}`}, from your usual ${c.usualLength} day cycle.`,
      });
    }
  }

  const hrv = recent((d) => d.hrv);
  const rhr = recent((d) => d.restingHR);
  if (hrv != null && usual.hrv && hrv < usual.hrv.low) {
    items.push({
      key: 'recover',
      title: 'Keep today’s effort gentle',
      why: `HRV ${Math.round(hrv)} ms, under your usual range of ${Math.round(usual.hrv.low)} to ${Math.round(usual.hrv.high)} ms.`,
    });
  } else if (rhr != null && usual.rhr && rhr > usual.rhr.high) {
    items.push({
      key: 'recover',
      title: 'Keep today’s effort gentle',
      why: `Resting heart rate ${Math.round(rhr)} bpm, over your usual range of ${Math.round(usual.rhr.low)} to ${Math.round(usual.rhr.high)} bpm.`,
    });
  }

  const slept = today?.sleepHours ?? null;
  if (slept != null && usual.sleep && slept < usual.sleep - 0.5) {
    items.push({ key: 'sleep', title: 'Wind down earlier tonight', why: `Last night ${fmtHours(slept)}, under your usual ${fmtHours(usual.sleep)}.` });
  }

  const steps = yesterday?.steps ?? null;
  if (steps != null && usual.steps && steps < usual.steps * 0.6) {
    items.push({ key: 'walk', title: 'Fit in a short walk', why: `Yesterday ${fmtCount(steps)} steps, well under your usual ${fmtCount(usual.steps)}.` });
  } else if (input.walkSuggested) {
    items.push({ key: 'walk', title: 'Try a short walk today', why: 'Your recent pattern suggests movement may help. Only if it feels right.' });
  }

  if (input.watchSuggested) {
    items.push({ key: 'watch', title: 'Watch your next cycle', why: 'A pattern is forming. Ciatta will show whether it holds when your next cycle ends.' });
  }

  // The daily log: last, and only when there is room for it.
  if (!input.loggedToday && items.length < MAX) {
    items.push({ key: 'log', title: 'Log how today feels', why: 'Your daily log is what Ciatta finds patterns in.' });
  }
  return items.slice(0, MAX);
}

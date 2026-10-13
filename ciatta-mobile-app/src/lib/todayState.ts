// Which Today she meets: the empty state, when her record holds nothing yet,
// with the way in to what Ciatta is for; or the content state, her own day.
//
// Empty means nothing of hers at all: no reading a device measured, nothing
// she logged, no logged cycle. A day row that exists but holds only nulls
// is still nothing. The parts are returned too, so a record that has begun
// can show what is missing in place rather than a grid of blanks.

import type { Day } from '../data/daily';

export type TodayState = { state: 'empty' | 'content'; measured: boolean; logged: boolean; cycle: boolean };

const isMeasured = (d: Day) =>
  [d.sleepHours, d.steps, d.activeMinutes, d.restingHR, d.hrv, d.tempDeviation].some((v) => v != null) || d.workouts.length > 0;

const isLogged = (d: Day) =>
  [d.energy, d.mood, d.stress, d.caffeine, d.alcohol].some((v) => v != null) || d.foods.length > 0 || d.digestion.length > 0;

export function todayState(input: { days: readonly Day[]; windows: number; logs: number }): TodayState {
  const measured = input.days.some(isMeasured);
  const logged = input.logs > 0 || input.days.some(isLogged);
  const cycle = input.windows > 0;
  return { state: measured || logged || cycle ? 'content' : 'empty', measured, logged, cycle };
}

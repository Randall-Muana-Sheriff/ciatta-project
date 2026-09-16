import { addDays, sampleCycleStarts, daysBetween, isoDay, startOfDay } from './cycleLog';

// One row per day of everything outside the Cycle log: sleep, movement,
// recovery, check ins, and what was eaten or felt in the gut. Until Apple
// Health is connected, a deterministic sample stands in, shaped to match the
// Cycle sample record.

export type Workout = { type: string; minutes: number; intensity?: 'Low' | 'Moderate' | 'High' };

// Null in any of these four means that stage was never measured for the
// night, not that she spent no time in it.
export type SleepStages = { awake: number | null; rem: number | null; light: number | null; deep: number | null };

export type Day = {
  date: string;
  // Null when nothing measured sleep that night: a wearable not worn, a
  // permission never granted, a night with no data at all. Never a
  // fabricated zero, which would read as "you slept zero hours."
  sleepHours: number | null;
  // Minutes in each stage of the night before, and hours in bed.
  stages: SleepStages;
  timeInBed: number | null;
  steps: number | null;
  activeMinutes: number | null;
  workouts: Workout[];
  restingHR: number | null;
  hrv: number | null;
  // Nightly skin temperature change from usual, in °C. Null when not recorded.
  tempDeviation: number | null;
  // Check ins on a 1 to 5 scale.
  energy: number | null;
  mood: number | null;
  stress: number | null;
  caffeine: number;
  alcohol: number;
  foods: string[];
  digestion: string[];
  note?: string;
};

const LENGTH = 150;

// Short nights outside the recent stretch. All but one are followed by a
// low energy day, so fatigue after short sleep recurs without being certain.
const SHORT_NIGHTS = [118, 104, 97, 90, 83, 69, 55];
const TIRED_AFTER = new Set([118, 104, 97, 83, 69, 55]);
const DAIRY_BLOATING = [112, 76, 41];
const DAIRY_FINE = [99, 62];
const BLOATING_ONLY = [88];

// A short walk was planned 34 days ago; the walks and what followed are in
// the record.
export const WALK_PLAN_AGO = 34;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleDays(now = new Date()): Day[] {
  const r = rng(20260914);
  const stageRng = rng(7);
  const tempRng = rng(11);
  const around = (mid: number, spread: number) => mid + (r() * 2 - 1) * spread;
  const today = startOfDay(now);
  const starts = sampleCycleStarts(now);
  // Hard workouts the day before two logged pelvic pain episodes.
  const hard = new Set([isoDay(addDays(starts[3], 1)), isoDay(addDays(starts[4], -4))]);
  const weekFactor = new Map<number, number>();
  const days: Day[] = [];
  // Every sample night has a real value, so this mirrors days[i].sleepHours
  // exactly; kept alongside it only so the pass below never has to read a
  // field the exported Day type allows to be null (real data can leave it
  // that way; the generator never does).
  const sleepAt: number[] = [];

  for (let ago = LENGTH - 1; ago >= 0; ago--) {
    const date = addDays(today, -ago);
    const week = Math.floor(ago / 7);
    if (!weekFactor.has(week)) weekFactor.set(week, 0.85 + r() * 0.3);
    const wf = weekFactor.get(week)!;
    const weekday = date.getDay();
    // The last three weeks, and the final week of the cycle that ended in
    // early August, carry the same combination of changes.
    const untilEarlierEnd = daysBetween(date, starts[3]);
    const stretch = ago <= 20 || (untilEarlierEnd >= 1 && untilEarlierEnd <= 7);

    let sleep = around(7.1, 0.35);
    let steps = around(8300, 1100) * wf;
    let active = around(38, 8) * wf;
    const workouts: Workout[] = [];
    if (weekday === 1) workouts.push({ type: 'Strength', minutes: 40, intensity: 'Moderate' });
    if (weekday === 3) workouts.push({ type: 'Run', minutes: 30, intensity: 'Moderate' });
    if (weekday === 6) workouts.push({ type: 'Walk', minutes: 55, intensity: 'Low' });
    let restingHR = around(58, 1.4);
    const hrv = around(52, 5);
    let stress = r() < 0.5 ? 2 : 3;
    let mood = r() < 0.6 ? 4 : 3;
    let energy = steps > 9000 ? 4 : steps < 7400 ? 3 : r() < 0.5 ? 3 : 4;
    const caffeine = r() < 0.7 ? 1 : 2;
    const alcohol = (weekday === 5 || weekday === 6) && r() < 0.4 ? 1 : 0;
    const foods: string[] = [];
    const digestion: string[] = [];
    let note: string | undefined;
    if (r() < 0.08) foods.push('Gluten');
    if (r() < 0.05) foods.push('Spicy food');

    if (stretch) {
      sleep = around(6.2, 0.3);
      steps = around(8300, 900) * 0.62;
      active = around(38, 6) * 0.6;
      workouts.length = 0;
      if (weekday === 6) workouts.push({ type: 'Walk', minutes: 25, intensity: 'Low' });
      stress = r() < 0.5 ? 4 : 5;
      mood = r() < 0.5 ? 3 : 2;
      energy = r() < 0.5 ? 2 : 3;
    }
    if (hard.has(isoDay(date))) workouts.push({ type: 'HIIT', minutes: 35, intensity: 'High' });
    if (ago <= 3) restingHR = around(64.5, 0.7);
    if (ago === 3) note = 'Exhausted this week.';
    if (SHORT_NIGHTS.includes(ago)) sleep = around(5.6, 0.15);
    if (ago === 36 || ago === 35) {
      energy = 2;
      steps *= 0.75;
    }
    if (ago <= WALK_PLAN_AGO && ago >= WALK_PLAN_AGO - 2) {
      workouts.push({ type: 'Walk', minutes: 30, intensity: 'Low' });
      steps *= 1.25;
      energy = r() < 0.5 ? 3 : 4;
    }
    if (DAIRY_BLOATING.includes(ago)) {
      foods.push('Dairy');
      digestion.push('Bloating');
    }
    if (DAIRY_FINE.includes(ago)) foods.push('Dairy');
    if (BLOATING_ONLY.includes(ago)) digestion.push('Bloating');

    // Stages come from their own seed so adding them leaves every other value unchanged.
    const asleep = Math.round(sleep * 20) / 20;
    const minutes = Math.round(asleep * 60);
    const deep = Math.round(minutes * (0.14 + stageRng() * 0.06));
    const rem = Math.round(minutes * (0.19 + stageRng() * 0.06));
    const awake = Math.round(stretch ? 28 + stageRng() * 24 : 10 + stageRng() * 16);

    // Temperature has its own seed so every other value stays the same. It
    // sits about 0.3 °C higher from 12 days before each logged cycle start,
    // the shift that confirms ovulation. The current cycle hasn't risen yet.
    const next = starts.find((s) => s > date);
    const risen = next != null && daysBetween(date, next) <= 12;
    const tempDeviation = Math.round(((risen ? 0.25 : -0.08) + (tempRng() * 2 - 1) * 0.05) * 100) / 100;

    days.push({
      date: isoDay(date),
      sleepHours: asleep,
      stages: { awake, rem, light: minutes - deep - rem, deep },
      timeInBed: Math.round(((minutes + awake + 8 + stageRng() * 12) / 60) * 100) / 100,
      steps: Math.round(steps),
      activeMinutes: Math.round(active),
      workouts,
      restingHR: Math.round(restingHR * 10) / 10,
      hrv: Math.round(hrv),
      tempDeviation,
      energy,
      mood,
      stress,
      caffeine,
      alcohol,
      foods,
      digestion,
      note,
    });
    sleepAt.push(asleep);
  }

  // Low energy the day after a short night.
  for (let i = 0; i < days.length - 1; i++) {
    const ago = LENGTH - 1 - i;
    if (TIRED_AFTER.has(ago) || (ago <= 21 && sleepAt[i] < 6)) days[i + 1].energy = 2;
  }
  return days;
}

let cache: { key: string; days: Day[] } | null = null;

// The one place daily data comes from. Apple Health replaces the sample here.
export function loadDays(now = new Date()): Day[] {
  const key = isoDay(now);
  if (!cache || cache.key !== key) cache = { key, days: sampleDays(now) };
  return cache.days;
}

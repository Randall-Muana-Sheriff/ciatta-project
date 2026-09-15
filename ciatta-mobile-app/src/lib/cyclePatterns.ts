import { daysBetween, type Episode, type EpisodeForm, parseDay } from '../data/cycleLog';
import { bandOf, type CycleWindow, type Phase, phaseOf, windowFor } from './cycleModel';

export { type CycleWindow, type Phase, PHASES } from './cycleModel';

// The reading of the Cycle record. It describes what recurred; it never
// names a cause or a condition. A pattern is only surfaced once it has shown
// up in at least MIN_CYCLES separate cycles.

const MIN_CYCLES = 3;
const MIN_BOWEL = 3;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// All day counts as 12 waking hours; an episode without times has no length.
export function hoursOf(e: Episode): number | null {
  if (e.allDay) return 12;
  if (e.start != null && e.end != null) return (e.end - e.start + 24) % 24 || 24;
  return null;
}

// One row per episode with the timing, body and context fields the
// intelligence layer compares against sleep, stress, activity, medication,
// treatment and cycle phase.
export type Signal = {
  episode: Episode;
  date: Date;
  cycle: CycleWindow | null;
  phase: Phase | null;
  daysSincePeriod: number | null;
  bowel: boolean;
  bowelPain: boolean;
  hours: number | null;
  pain: boolean;
  sleepDisrupted: boolean;
  stress: boolean;
};

export function signals(episodes: Episode[], windows: CycleWindow[], predicted: number | null = null): Signal[] {
  return episodes
    .map((episode) => {
      const date = parseDay(episode.date);
      const cycle = windowFor(date, windows);
      const said = [...episode.context, ...episode.noteContext];
      const bowel = episode.kinds.includes('Bowel movement');
      return {
        episode,
        date,
        cycle,
        phase: cycle ? phaseOf(date, cycle, predicted) : null,
        daysSincePeriod: cycle ? daysBetween(cycle.start, date) : null,
        hours: hoursOf(episode),
        pain: episode.kinds.includes('Pain'),
        bowel,
        bowelPain: (bowel && episode.bowelPain != null && episode.bowelPain !== 'None') || said.includes('Pain with bowel movements'),
        sleepDisrupted:
          said.includes('Poor sleep') ||
          episode.changes.includes('Could not sleep') ||
          episode.dayImpact.includes('Could not sleep') ||
          episode.affect.includes('Could not sleep') ||
          episode.symptoms.includes('Sleep disruption'),
        stress: said.includes('Stress'),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function tally(lists: readonly (readonly string[])[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of lists) for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type CycleSummary = {
  window: CycleWindow;
  painDays: number;
  hours: number | null;
  maxSeverity: number | null;
  severities: number[];
  flares: number;
};

export function cycleSummaries(sigs: Signal[], windows: CycleWindow[]): CycleSummary[] {
  return windows.map((window) => {
    const mine = sigs.filter((s) => s.cycle === window);
    const pain = mine.filter((s) => s.pain);
    const severities = pain.map((s) => s.episode.severity).filter((v): v is number => v != null);
    return {
      window,
      painDays: new Set(pain.map((s) => s.episode.date)).size,
      hours: avg(pain.map((s) => s.hours).filter((v): v is number => v != null)),
      maxSeverity: severities.length ? Math.max(...severities) : null,
      severities,
      flares: mine.filter((s) => s.episode.flareUpUserReported).length,
    };
  });
}

export type Observation = {
  id: 'beforePeriod' | 'flareSleep' | 'duration' | 'bowelPain';
  text: string;
  detail?: string;
  context?: string;
  // The same observation phrased to sit inside the daily brief.
  brief: string;
};

const round = (h: number) => Math.round(h);

const PHASE_PHRASE: Record<Phase, string> = {
  'During period': 'during your period',
  'Before period': 'in the days before your period',
  'After period': 'in the days after your period',
  'Between periods': 'between periods',
};

export function observations(sigs: Signal[], windows: CycleWindow[], summaries: CycleSummary[], now = new Date()): Observation[] {
  const out: Observation[] = [];

  // Pain in the days before a period, across completed cycles.
  const done = windows.filter((w) => w.end).slice(-5);
  const before = sigs.filter((s) => s.pain && s.phase === 'Before period');
  const beforeCycles = done.filter((w) => before.some((s) => s.cycle === w));
  if (beforeCycles.length >= MIN_CYCLES) {
    const where = tally(before.map((s) => s.episode.locations))[0]?.label;
    const place = where && where !== 'Whole body' && where !== 'Other' ? ` in your ${where.toLowerCase()}` : '';
    const span =
      beforeCycles.length === done.length
        ? `each of your last ${done.length} cycles`
        : `${beforeCycles.length} of your last ${done.length} cycles`;
    out.push({
      id: 'beforePeriod',
      text: `Pain${place} has appeared during the days before your period in ${span}.`,
      brief: `Pain${place} has shown up in the days before your period in ${span}.`,
    });
  }

  // Flare ups the person reported, alongside disrupted sleep.
  const flareCycles = windows.filter((w) => sigs.some((s) => s.cycle === w && s.episode.flareUpUserReported));
  const withSleep = flareCycles.filter((w) =>
    sigs.some((s) => s.cycle === w && s.episode.flareUpUserReported && s.sleepDisrupted),
  );
  if (withSleep.length >= MIN_CYCLES) {
    const span =
      withSleep.length === flareCycles.length
        ? `all ${flareCycles.length} cycles where you reported one`
        : `${withSleep.length} of the ${flareCycles.length} cycles where you reported one`;
    out.push({
      id: 'flareSleep',
      text: `Your reported flare ups have occurred during periods of disrupted sleep in ${span}.`,
      detail: 'These happened around the same time. That doesn’t mean one caused the other.',
      brief: `The flare ups you reported came during stretches of disrupted sleep in ${span}, though happening together doesn’t mean one caused the other.`,
    });
  }

  // How long pain episodes last, early cycles against the latest three.
  const timed = summaries.filter((c) => c.hours != null);
  if (timed.length >= 2 + MIN_CYCLES) {
    const early = timed.slice(0, 2);
    const recent = timed.slice(-MIN_CYCLES);
    const earlyH = avg(early.map((c) => c.hours!))!;
    const recentH = avg(recent.map((c) => c.hours!))!;
    if (recentH >= earlyH * 1.5 && recentH - earlyH >= 1) {
      const from = early[0].window.start;
      const recentPain = sigs.filter((s) => s.pain && recent.some((c) => c.window === s.cycle));
      const sleepCount = recentPain.filter((s) => s.sleepDisrupted).length;
      out.push({
        id: 'duration',
        text:
          from.getFullYear() === now.getFullYear()
            ? 'Your pain has been lasting longer than earlier in the year.'
            : 'Your pain has been lasting longer than it did a few cycles ago.',
        detail: `Your reported pain episodes averaged about ${round(earlyH)} hours in ${MONTHS[from.getMonth()]}. Over the last three cycles, they have averaged closer to ${round(recentH)} hours.`,
        context: sleepCount >= 2 ? `You also logged disrupted sleep during ${sleepCount} of these episodes.` : undefined,
        brief: `Your pain episodes have also been getting longer, from about ${round(earlyH)} hours in ${MONTHS[from.getMonth()]} to closer to ${round(recentH)} hours over the last three cycles${
          sleepCount >= 2 ? `, and you logged disrupted sleep during ${sleepCount} of those recent episodes` : ''
        }.`,
      });
    }
  }

  // Pain with bowel movements, by phase, or by days since a period when
  // there is no phase.
  const bowel = sigs.filter((s) => s.bowelPain);
  if (bowel.length >= MIN_BOWEL) {
    const where = (s: Signal) =>
      s.phase ? PHASE_PHRASE[s.phase] : s.daysSincePeriod != null ? bandOf(s.daysSincePeriod).phrase : 'with no period logged before it';
    const top = tally(bowel.map((s) => [where(s)]))[0];
    out.push({
      id: 'bowelPain',
      text: `Pain with bowel movements showed up most ${top.label}: ${top.count} of the ${bowel.length} times you logged it.`,
      brief: `Pain with bowel movements has come up most ${top.label}, ${top.count} of the ${bowel.length} times you logged it.`,
    });
  }

  return out;
}

// Pain days in the last 90 days, during a period and outside one.
export function painSplit(sigs: Signal[], now = new Date()): { during: number; outside: number } {
  const recent = sigs.filter((s) => s.pain && daysBetween(s.date, now) >= 0 && daysBetween(s.date, now) <= 90);
  const days = (xs: Signal[]) => new Set(xs.map((s) => s.episode.date)).size;
  return {
    during: days(recent.filter((s) => s.phase === 'During period')),
    outside: days(recent.filter((s) => s.phase !== 'During period')),
  };
}

// The usual shape of a pain episode, for "Log similar episode".
export function similarTemplate(episodes: Episode[]): Partial<EpisodeForm> | null {
  const recent = episodes
    .filter((e) => e.kinds.includes('Pain'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (!recent.length) return null;
  const common = (lists: string[][]) => {
    const t = tally(lists);
    const repeated = t.filter((x) => x.count >= 2).map((x) => x.label);
    return repeated.length ? repeated.slice(0, 3) : t.slice(0, 2).map((x) => x.label);
  };
  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  return {
    kinds: ['Pain'],
    locations: common(recent.map((e) => e.locations)),
    sensations: common(recent.map((e) => e.sensations)),
    severity: median(recent.map((e) => e.severity).filter((v): v is number => v != null)),
    start: median(recent.map((e) => e.start).filter((v): v is number => v != null)),
    end: median(recent.map((e) => e.end).filter((v): v is number => v != null)),
  };
}

export type MonthSummary = {
  painDays: number;
  locations: string[];
  maxSeverity: number | null;
  flares: number;
  stress: number;
  bowel: number;
  bowelPain: number;
};

export function monthSummary(sigs: Signal[], year: number, month: number): MonthSummary {
  const mine = sigs.filter((s) => s.date.getFullYear() === year && s.date.getMonth() === month);
  const pain = mine.filter((s) => s.pain);
  const severities = pain.map((s) => s.episode.severity).filter((v): v is number => v != null);
  return {
    painDays: new Set(pain.map((s) => s.episode.date)).size,
    locations: tally(pain.map((s) => s.episode.locations)).slice(0, 3).map((x) => x.label),
    maxSeverity: severities.length ? Math.max(...severities) : null,
    flares: mine.filter((s) => s.episode.flareUpUserReported).length,
    stress: mine.filter((s) => s.stress).length,
    bowel: mine.filter((s) => s.bowel).length,
    bowelPain: mine.filter((s) => s.bowel && s.bowelPain).length,
  };
}

// Last night, stage by stage, for the hypnogram: the sleep chart the
// industry draws (Fitbit, Oura, Apple Health, Whoop), stepped bands moving
// between Awake, REM, Light and Deep through the night.
//
// Built from the sleep stages Apple Health wrote, each with when it began
// and ended. A stage synced before the start was stored begins where the
// one before it ended; one with nothing before it is left out rather than
// given a start. "In bed" is not sleep and is not drawn. A phone alone
// records sleep without stages, which is drawn as asleep, not as a stage
// it is not.

export type Stage = 'awake' | 'rem' | 'light' | 'deep' | 'asleep';
export type SleepSample = { stage: string; end: string; start?: string };
export type Segment = { stage: Stage; from: string; to: string };
export type StageTotal = { stage: Stage; label: string; minutes: number; percent: number };
export type Night = { start: string; end: string; segments: Segment[]; totals: StageTotal[]; asleepMinutes: number; staged: boolean };

const STAGE: Record<string, Stage> = {
  awake: 'awake',
  asleep_rem: 'rem',
  asleep_core: 'light',
  asleep_deep: 'deep',
  asleep: 'asleep',
};

export const STAGE_LABEL: Record<Stage, string> = { awake: 'Awake', rem: 'REM', light: 'Light', deep: 'Deep', asleep: 'Asleep' };
// Top to bottom on the chart, as every hypnogram orders them.
export const STAGE_ORDER: Stage[] = ['awake', 'rem', 'light', 'deep'];

const NEW_NIGHT_MS = 3 * 3600000;

export function lastNight(samples: readonly SleepSample[]): Night | null {
  const sorted = samples
    .filter((x) => STAGE[x.stage] && !Number.isNaN(Date.parse(x.end)))
    .sort((a, b) => Date.parse(a.end) - Date.parse(b.end));

  const segments: Segment[] = [];
  let prevEnd: number | null = null;
  for (const x of sorted) {
    const to = Date.parse(x.end);
    const from = x.start && !Number.isNaN(Date.parse(x.start)) ? Date.parse(x.start) : prevEnd;
    prevEnd = to;
    if (from == null || from >= to) continue;
    segments.push({ stage: STAGE[x.stage], from: new Date(from).toISOString(), to: new Date(to).toISOString() });
  }
  if (!segments.length) return null;

  // The most recent night: walk back until a gap of three hours or more.
  let first = segments.length - 1;
  while (first > 0 && Date.parse(segments[first].from) - Date.parse(segments[first - 1].to) < NEW_NIGHT_MS) first -= 1;
  const night = segments.slice(first);

  const minutesOf = (seg: Segment) => (Date.parse(seg.to) - Date.parse(seg.from)) / 60000;
  const total = night.reduce((a, seg) => a + minutesOf(seg), 0);
  const staged = night.some((seg) => seg.stage !== 'asleep' && seg.stage !== 'awake');
  const order: Stage[] = staged ? STAGE_ORDER : ['awake', 'asleep'];
  const totals = order
    .map((stage) => {
      const minutes = Math.round(night.filter((seg) => seg.stage === stage).reduce((a, seg) => a + minutesOf(seg), 0));
      return { stage, label: STAGE_LABEL[stage], minutes, percent: total ? Math.round((minutes / total) * 100) : 0 };
    })
    .filter((t) => t.minutes > 0);

  return {
    start: night[0].from,
    end: night[night.length - 1].to,
    segments: night,
    totals,
    asleepMinutes: Math.round(night.filter((seg) => seg.stage !== 'awake').reduce((a, seg) => a + minutesOf(seg), 0)),
    staged,
  };
}

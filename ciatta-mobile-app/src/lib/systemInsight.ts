// One sentence for a body system, written from her own logs and readings,
// that the Today screen does not already say. Today tells the lead insight
// in the engine's words; this never uses those words. It counts: how many
// days she logged something here this month, against the month before, and
// when in her cycle most of it came. Without logs, the newest measured or
// lab point here, in its own few words. With too little, nothing.

import { type BodyPoint, LOCATION_REGION, type RegionId } from './bodyMap';

type SignalLike = { date: Date; phase: string | null; episode: { date: string; locations: string[]; symptoms?: string[]; kinds: string[] } };

const DAY = 86400000;
const WHEN: Record<string, string> = {
  'Before period': 'in the days before your period',
  'During period': 'during your period',
  'After period': 'just after your period',
  'Between periods': 'between periods',
};

export function systemInsight(input: {
  regions: readonly RegionId[];
  whole: boolean;
  points: readonly Pick<BodyPoint, 'title' | 'detail' | 'source'>[];
  signals: readonly SignalLike[];
  now: Date;
}): string | null {
  const today = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  const ago = (d: Date) => Math.floor((today - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY);
  const here = input.signals.filter((s) =>
    input.whole
      ? !s.episode.locations.length && ((s.episode.symptoms?.length ?? 0) > 0 || s.episode.kinds.length > 0)
      : s.episode.locations.some((l) => input.regions.includes(LOCATION_REGION[l] as RegionId)),
  );
  const days = (from: number, to: number) => {
    const inside = here.filter((s) => ago(s.date) >= from && ago(s.date) <= to);
    return { count: new Set(inside.map((s) => s.episode.date)).size, list: inside };
  };
  const now = days(0, 29);
  const before = days(30, 59);
  if (now.count >= 2) {
    const versus =
      now.count > before.count
        ? `up from ${before.count || 'none'} the month before`
        : now.count < before.count
          ? `down from ${before.count} the month before`
          : 'the same as the month before';
    let when = '';
    if (now.count >= 3) {
      const byPhase = new Map<string, Set<string>>();
      for (const s of now.list) if (s.phase) byPhase.set(s.phase, (byPhase.get(s.phase) ?? new Set()).add(s.episode.date));
      const top = [...byPhase].sort((a, b) => b[1].size - a[1].size)[0];
      if (top && WHEN[top[0]] && top[1].size / now.count >= 0.6) when = `, ${top[1].size} of them ${WHEN[top[0]]}`;
    }
    return `Logged on ${now.count} days this month, ${versus}${when}.`;
  }
  if (input.whole) return null;
  const measured = input.points.find((p) => p.source === 'Lab' || p.source === 'Synced');
  return measured ? measured.detail : null;
}

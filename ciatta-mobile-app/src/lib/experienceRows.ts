// The Cycle screen's Your Experience rows, each as one total with its most
// logged items counted underneath: "2 places" over "Lower abdomen (2) ·
// Pelvis (1)". Counted only from what she logged this cycle; a row with
// nothing logged says so and carries no number.

import { tally } from './cyclePatterns';

type Sig = {
  pain: boolean;
  episode: { locations: string[]; sensations: string[]; symptoms: string[]; flareUpUserReported: boolean | null };
};
export type ExperienceRow = { value: string | null; sub: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function experienceRows(painDays: number | null, mine: readonly Sig[]) {
  const pain = mine.filter((s) => s.pain);
  const row = (lists: string[][], top: number, one: string, many: string): ExperienceRow => {
    const counted = tally(lists);
    if (!counted.length) return { value: null, sub: 'Nothing logged yet' };
    return {
      value: plural(counted.length, one, many),
      sub: counted
        .slice(0, top)
        .map((c) => `${c.label} (${c.count})`)
        .join(' · '),
    };
  };
  const flares = mine.filter((s) => s.episode.flareUpUserReported).length;
  return {
    pain: painDays == null ? { value: null, sub: 'No period logged yet' } : { value: plural(painDays, 'day', 'days'), sub: 'This cycle' },
    places: row(pain.map((s) => s.episode.locations), 2, 'place', 'places'),
    sensations: row(pain.map((s) => s.episode.sensations), 2, 'kind', 'kinds'),
    symptoms: row(mine.map((s) => s.episode.symptoms), 3, 'symptom', 'symptoms'),
    flares: flares ? { value: String(flares), sub: 'Reported by you' } : { value: null, sub: 'None reported' },
  } satisfies Record<string, ExperienceRow>;
}

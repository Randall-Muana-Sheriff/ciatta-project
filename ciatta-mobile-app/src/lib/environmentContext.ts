// One line of background for a pattern: what the weather was doing, when
// it was unusual for her (spec: 2026-10-13 environment and exposures).
//
// The last three weeks against her usual, which is the 90 days before
// them. Only what was outside her own usual band is named, with the
// figure. The line sits under "Other explanations" and never says or
// implies the weather caused anything. Too little weather says nothing.

import { band } from './engine';
import type { EnvironmentDay } from './weather';

const STRETCH = 21;
const USUAL = 90;
const MIN_USUAL_ROWS = 30;
const MIN_COVER = 0.6;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function environmentLine(days: readonly EnvironmentDay[], now: Date): string | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (n: number) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
  const stretchFrom = at(STRETCH - 1);
  const usualFrom = at(STRETCH + USUAL - 1);
  const stretch = days.filter((d) => d.day >= stretchFrom && d.day <= at(0));
  const usual = days.filter((d) => d.day >= usualFrom && d.day < stretchFrom);
  if (stretch.length < STRETCH * MIN_COVER || usual.length < MIN_USUAL_ROWS) return null;

  // Each dimension: is the stretch's mean outside her usual band, and which way.
  const side = (get: (d: EnvironmentDay) => number | null) => {
    const u = nums(usual.map(get));
    const s = nums(stretch.map(get));
    if (u.length < MIN_USUAL_ROWS || s.length < STRETCH * MIN_COVER) return null;
    const b = band(u);
    const m = mean(s);
    return m > b.high ? { dir: 'up' as const, m } : m < b.low ? { dir: 'down' as const, m } : null;
  };

  const temp = side((d) => d.tempMaxC);
  const humid = side((d) => d.humidityMean);
  const light = side((d) => d.daylightMinutes);

  const words: string[] = [];
  const figures: string[] = [];
  if (temp) {
    words.push(temp.dir === 'up' ? 'hotter' : 'colder');
    figures.push(`${Math.round(temp.m) < 0 ? `minus ${Math.abs(Math.round(temp.m))}` : Math.round(temp.m)} °C`);
  }
  if (humid) {
    words.push(humid.dir === 'up' ? 'more humid' : 'drier');
    figures.push(`${Math.round(humid.m * 100)}%`);
  }
  const daylight = light ? `${light.dir === 'down' ? 'less' : 'more'} daylight` : null;
  const hours = light ? `${Math.round(light.m / 60)}h a day` : null;

  if (words.length && daylight) {
    return `These last three weeks were ${words.join(' and ')} than your usual (${figures.join(', ')}), with ${daylight} (${hours}).`;
  }
  if (words.length) return `These last three weeks were ${words.join(' and ')} than your usual (${figures.join(', ')}).`;
  if (daylight) return `These last three weeks had ${daylight} than your usual (${hours}).`;
  return null;
}

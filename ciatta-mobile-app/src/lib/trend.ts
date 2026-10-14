// Which way a metric is moving, from her own readings.
//
// The Profile biomarker tiles drew a small line and an arrow, and both
// were written into the sample by hand. Today's cards carry the same two
// things, computed: the line is her last seven readings of that metric,
// and the arrow compares the newest with the average of the ones before
// it. Nothing is drawn from fewer than three readings, because two points
// are a line Ciatta chose rather than one she produced.

import { formatTempChange } from './units';

// How many readings the line holds, and how few are too few to draw.
const WINDOW = 7;
const FEWEST = 3;

// Under this, the arrow is level: a 1% wobble in HRV is not a direction.
const LEVEL_PERCENT = 2;
const LEVEL_DEGREES = 0.1;

export type Trend = {
  points: number[];
  // "↑ 12%". Null when there is no honest figure to give, such as a change
  // from an average of zero.
  change: string | null;
  // The same, in words, for a screen reader.
  spoken: string | null;
};

// 'percent' for anything measured from zero; 'degrees' for skin
// temperature, which is already a difference from usual, so a percent of
// it would mean nothing.
//
// `known` is her usual from the baselines function (the median of her own
// readings 5 to 13 weeks ago), when there is enough history for one. With
// it, the arrow says how the latest reading sits against her usual; without
// it, against the average of the readings before it, and the words say
// which.
export function trendOf(values: readonly (number | null)[], unit: 'percent' | 'degrees', known?: number | null): Trend | null {
  const points = values.filter((v): v is number => v != null).slice(-WINDOW);
  if (points.length < FEWEST) return null;
  const latest = points[points.length - 1];
  const earlier = points.slice(0, -1);
  const usual = known ?? earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const against = known != null ? 'your usual' : 'your recent average';

  let size: number;
  let level: boolean;
  let figure: string;
  if (unit === 'degrees') {
    size = latest - usual;
    level = Math.abs(size) < LEVEL_DEGREES;
    figure = formatTempChange(size);
  } else {
    if (usual === 0) return { points, change: null, spoken: null };
    size = ((latest - usual) / Math.abs(usual)) * 100;
    level = Math.abs(size) < LEVEL_PERCENT;
    figure = `${Math.round(Math.abs(size))}%`;
  }

  const arrow = level ? '→' : size > 0 ? '↑' : '↓';
  return {
    points,
    change: `${arrow} ${figure}`,
    spoken: level ? `level with ${against}` : `${size > 0 ? 'up' : 'down'} ${figure} from ${against}`,
  };
}

// Which way a metric is moving, from her own readings.
//
// The Profile biomarker tiles drew a small line and an arrow, and both
// were written into the sample by hand. Today's cards carry the same two
// things, computed: the line is her last seven readings of that metric,
// and the arrow compares the newest with the average of the ones before
// it. Nothing is drawn from fewer than three readings, because two points
// are a line Ciatta chose rather than one she produced.

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
export function trendOf(values: readonly (number | null)[], unit: 'percent' | 'degrees'): Trend | null {
  const points = values.filter((v): v is number => v != null).slice(-WINDOW);
  if (points.length < FEWEST) return null;
  const latest = points[points.length - 1];
  const earlier = points.slice(0, -1);
  const usual = earlier.reduce((a, b) => a + b, 0) / earlier.length;

  let size: number;
  let level: boolean;
  let figure: string;
  if (unit === 'degrees') {
    size = latest - usual;
    level = Math.abs(size) < LEVEL_DEGREES;
    figure = `${Math.abs(size).toFixed(1)} °C`;
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
    spoken: level ? 'level with your recent average' : `${size > 0 ? 'up' : 'down'} ${figure} from your recent average`,
  };
}

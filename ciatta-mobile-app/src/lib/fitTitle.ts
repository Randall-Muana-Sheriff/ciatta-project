// The size that sets a title on one row with nothing cut off: 28 (Title 1)
// where it fits, smaller for a long name on a narrow phone, never under 16.
// Jost Medium averages a little over half an em per character; 0.6 leaves
// room for wide letters, so the estimate errs toward fitting.
export const PER_CHAR = 0.6;

export function fitTitle(text: string, width: number, max = 28, min = 16): number {
  const fits = Math.floor(width / (Math.max(text.length, 1) * PER_CHAR));
  return Math.max(min, Math.min(max, fits));
}

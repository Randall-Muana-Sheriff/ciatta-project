// The size that sets a title on one row: the Large Title's 34 where it
// fits, smaller for a long name on a narrow phone, never under 20. Jost
// Bold averages a little over half an em per character, so a row of n
// characters at size s needs about n times 0.56 times s points.
const PER_CHAR = 0.56;

export function fitTitle(text: string, width: number, max = 34, min = 20): number {
  const fits = Math.floor(width / (Math.max(text.length, 1) * PER_CHAR));
  return Math.max(min, Math.min(max, fits));
}

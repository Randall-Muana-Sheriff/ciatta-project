// The weather card on the Health dashboard: her last week of weather, in
// three plain lines. Background, never about her body. A figure the source
// did not give drops its line rather than being guessed.

export type EnvironmentDay = {
  day: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  // 0 to 1, the day's mean.
  humidityMean: number | null;
  // Sunrise to sunset.
  daylightMinutes: number | null;
  condition: string | null;
};

const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Below zero in words: display copy turns a hyphen or minus sign into
// punctuation, so "−4" would not survive to the screen.
const degrees = (c: number) => (Math.round(c) < 0 ? `minus ${Math.abs(Math.round(c))}` : `${Math.round(c)}`);

export function weatherLines(days: readonly EnvironmentDay[]): string[] {
  const week = [...days].sort((a, b) => a.day.localeCompare(b.day)).slice(-7);
  const lines: string[] = [];
  const lows = nums(week.map((d) => d.tempMinC));
  const highs = nums(week.map((d) => d.tempMaxC));
  if (lows.length && highs.length) lines.push(`${degrees(Math.min(...lows))} to ${degrees(Math.max(...highs))} °C`);
  const humidity = nums(week.map((d) => d.humidityMean));
  if (humidity.length) lines.push(`Humidity around ${Math.round(mean(humidity) * 100)}%`);
  const daylight = nums(week.map((d) => d.daylightMinutes));
  if (daylight.length) {
    const m = Math.round(mean(daylight));
    lines.push(`Daylight about ${Math.floor(m / 60)}h ${m % 60}m`);
  }
  return lines;
}

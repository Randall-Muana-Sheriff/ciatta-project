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
  // From Open-Meteo's air quality API. Pollen is Europe only.
  pm25: number | null;
  usAqi: number | null;
  pollenGrass: number | null;
  pollenTree: number | null;
  pollenWeed: number | null;
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

// US EPA Air Quality Index categories.
function aqiWord(aqi: number): string {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy for sensitive groups';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very unhealthy';
  return 'hazardous';
}

// A day whose mean PM2.5 is above the EPA's 35.4 µg/m³ line, which is where
// wildfire smoke and heavy pollution show up.
const SMOKY_PM25 = 35.4;

export function airLines(days: readonly EnvironmentDay[]): string[] {
  const week = [...days].sort((a, b) => a.day.localeCompare(b.day)).slice(-7);
  const lines: string[] = [];
  const aqi = nums(week.map((d) => d.usAqi));
  if (aqi.length) {
    const worst = Math.round(Math.max(...aqi));
    lines.push(`Air quality ${aqiWord(worst)} at worst (AQI ${worst})`);
  }
  const smoky = week.filter((d) => d.pm25 != null && d.pm25 > SMOKY_PM25).length;
  if (smoky) lines.push(`Smoky or polluted air on ${smoky} ${smoky === 1 ? 'day' : 'days'}`);
  const pollen = (
    [
      ['Grass', nums(week.map((d) => d.pollenGrass))],
      ['Tree', nums(week.map((d) => d.pollenTree))],
      ['Weed', nums(week.map((d) => d.pollenWeed))],
    ] as const
  )
    .map(([name, vs]) => ({ name, top: vs.length ? Math.max(...vs) : 0 }))
    .sort((a, b) => b.top - a.top)[0];
  if (pollen.top > 0) lines.push(`${pollen.name} pollen up to ${Math.round(pollen.top)} grains per m³`);
  return lines;
}

// Her own measured time outside in daylight (Apple Health), per day.
export function daylightLine(days: readonly { day: string; minutes: number }[]): string | null {
  const week = [...days].sort((a, b) => a.day.localeCompare(b.day)).slice(-7);
  if (!week.length) return null;
  return `You were outside in daylight about ${Math.round(mean(week.map((d) => d.minutes)))} min a day`;
}

// The environment function's pure parts: checking her request, and turning
// each source's response into rows of environment_days. No network, no
// Deno APIs, so the app's test suite runs these as they are.
//
// A figure a source did not give is null. Nothing is estimated here.

export type Request = { lat: number; lon: number; from: string; to: string };

const MAX_DAYS = 120;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const oneDecimal = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.round(n * 10) / 10 === n;

export function checkRequest(body: unknown, now: Date): Request | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const { lat, lon, from, to } = b;
  if (typeof lat !== 'number' || typeof lon !== 'number' || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { error: 'Not an area on the map' };
  }
  if (!oneDecimal(lat) || !oneDecimal(lon)) return { error: 'Send only a rough area, to one decimal place' };
  if (typeof from !== 'string' || typeof to !== 'string' || !DAY.test(from) || !DAY.test(to) || from > to) {
    return { error: 'Not a date range' };
  }
  const today = now.toISOString().slice(0, 10);
  if (to >= today) return { error: 'Only past days, not today or the future' };
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  if (span > MAX_DAYS) return { error: `At most ${MAX_DAYS} days at a time` };
  return { lat, lon, from, to };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

// The weather columns, kept on the table but not filled: Ciatta reads the
// air around her (Open-Meteo, no key) and her own daylight (Apple Health),
// and no longer fetches temperature or humidity.
export type WeatherRow = {
  temp_max_c: number | null;
  temp_min_c: number | null;
  humidity_mean: number | null;
  condition: string | null;
  daylight_minutes: number | null;
};

export type AirRow = {
  pm2_5: number | null;
  us_aqi: number | null;
  pollen_grass: number | null;
  pollen_tree: number | null;
  pollen_weed: number | null;
};

// Open-Meteo's hourly air, requested with timezone=auto, so each time is
// already her local time. PM2.5 is the day's mean; AQI and pollen are the
// day's worst hour, which is what a person feels.
export function mapAirQuality(json: unknown): Map<string, AirRow> {
  const out = new Map<string, AirRow>();
  const h = ((json ?? {}) as { hourly?: Record<string, unknown[]> }).hourly;
  if (!h || !Array.isArray(h.time)) return out;
  const col = (name: string) => (Array.isArray(h[name]) ? (h[name] as unknown[]) : []);
  const byDay = new Map<string, number[]>();
  h.time.forEach((t, i) => {
    if (typeof t !== 'string') return;
    const day = t.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), i]);
  });
  const mean = (name: string, idx: number[]) => {
    const vs = idx.map((i) => num(col(name)[i])).filter((v): v is number => v != null);
    return vs.length ? round(vs.reduce((a, b) => a + b, 0) / vs.length, 1) : null;
  };
  const max = (names: string[], idx: number[]) => {
    const vs = names.flatMap((n) => idx.map((i) => num(col(n)[i]))).filter((v): v is number => v != null);
    return vs.length ? Math.max(...vs) : null;
  };
  for (const [day, idx] of byDay) {
    out.set(day, {
      pm2_5: mean('pm2_5', idx),
      us_aqi: max(['us_aqi'], idx),
      pollen_grass: max(['grass_pollen'], idx),
      pollen_tree: max(['birch_pollen', 'alder_pollen', 'olive_pollen'], idx),
      pollen_weed: max(['ragweed_pollen', 'mugwort_pollen'], idx),
    });
  }
  return out;
}

const emptyWeather: WeatherRow = { temp_max_c: null, temp_min_c: null, humidity_mean: null, condition: null, daylight_minutes: null };
const emptyAir: AirRow = { pm2_5: null, us_aqi: null, pollen_grass: null, pollen_tree: null, pollen_weed: null };

// One row per day in the requested range that either source gave.
export function mergeDays(weather: Map<string, WeatherRow>, air: Map<string, AirRow>, from: string, to: string) {
  const days = [...new Set([...weather.keys(), ...air.keys()])].filter((d) => d >= from && d <= to).sort();
  return days.map((day) => ({ day, ...emptyWeather, ...weather.get(day), ...emptyAir, ...air.get(day) }));
}

// Fetches the weather, air and daylight around her for a range of past
// days, and writes them to environment_days.
//
// Called by the app with her access token and a rough area (one decimal
// place, about 10 km). The area is used for the two requests below and is
// not stored or logged. Rows are written for the caller only, from the
// verified token, never from the request body.
//
// Sources:
//   Apple WeatherKit: temperature, humidity, conditions, sunrise and sunset.
//     Needs WEATHERKIT_KEY_ID, WEATHERKIT_TEAM_ID, WEATHERKIT_SERVICE_ID and
//     WEATHERKIT_PRIVATE_KEY (the .p8 file's contents). Without them, the
//     weather columns stay empty and the air is still fetched.
//   Open-Meteo air quality API: PM2.5, US AQI, pollen (Europe only). No key.
//     Open-Meteo is free for non commercial use; a commercial app needs
//     their paid plan.
//
// Logging: counts and failure reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { type AirRow, checkRequest, mapAirQuality, mapWeatherKit, mergeDays, type WeatherRow } from './map.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WK = {
  keyId: Deno.env.get('WEATHERKIT_KEY_ID'),
  teamId: Deno.env.get('WEATHERKIT_TEAM_ID'),
  serviceId: Deno.env.get('WEATHERKIT_SERVICE_ID'),
  privateKey: Deno.env.get('WEATHERKIT_PRIVATE_KEY'),
};

// WeatherKit returns at most ten days of hours per request.
const CHUNK = 10;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text64 = (s: string) => b64url(new TextEncoder().encode(s));

// A short lived WeatherKit token, signed ES256 with the .p8 key.
async function weatherKitToken(): Promise<string | null> {
  if (!WK.keyId || !WK.teamId || !WK.serviceId || !WK.privateKey) return null;
  const pem = WK.privateKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = text64(JSON.stringify({ alg: 'ES256', kid: WK.keyId, id: `${WK.teamId}.${WK.serviceId}` }));
  const body = text64(JSON.stringify({ iss: WK.teamId, iat: now, exp: now + 1800, sub: WK.serviceId }));
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`)),
  );
  return `${head}.${body}.${b64url(sig)}`;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function fetchAir(lat: number, lon: number, from: string, to: string): Promise<{ rows: Map<string, AirRow>; tz: string }> {
  const hourly = 'pm2_5,us_aqi,grass_pollen,birch_pollen,alder_pollen,olive_pollen,ragweed_pollen,mugwort_pollen';
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=${hourly}&start_date=${from}&end_date=${to}&timezone=auto`,
  );
  if (!res.ok) throw new Error(`air ${res.status}`);
  const body = await res.json();
  return { rows: mapAirQuality(body), tz: typeof body?.timezone === 'string' ? body.timezone : 'UTC' };
}

async function fetchWeather(token: string, lat: number, lon: number, from: string, to: string, tz: string) {
  const all = new Map<string, WeatherRow>();
  for (let start = from; start <= to; start = addDays(start, CHUNK)) {
    const end = addDays(start, CHUNK) <= addDays(to, 1) ? addDays(start, CHUNK) : addDays(to, 1);
    const q = new URLSearchParams({
      dataSets: 'forecastDaily,forecastHourly',
      dailyStart: `${start}T00:00:00Z`,
      dailyEnd: `${end}T00:00:00Z`,
      hourlyStart: `${start}T00:00:00Z`,
      hourlyEnd: `${end}T00:00:00Z`,
      timezone: tz,
    });
    const res = await fetch(`https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?${q}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`weatherkit ${res.status}`);
    for (const [day, row] of mapWeatherKit(await res.json(), tz)) all.set(day, row);
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const asHer = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await asHer.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const r = checkRequest(body, new Date());
  if ('error' in r) return json({ error: r.error }, 400);

  let air = new Map<string, AirRow>();
  let tz = 'UTC';
  try {
    ({ rows: air, tz } = await fetchAir(r.lat, r.lon, r.from, r.to));
  } catch (e) {
    console.log(`environment: air failed (${e instanceof Error ? e.message : 'unknown'})`);
  }

  let weather = new Map<string, WeatherRow>();
  const token = await weatherKitToken().catch(() => null);
  if (!token) console.log('environment: WeatherKit not configured');
  else {
    try {
      weather = await fetchWeather(token, r.lat, r.lon, r.from, r.to, tz);
    } catch (e) {
      console.log(`environment: weather failed (${e instanceof Error ? e.message : 'unknown'})`);
    }
  }

  const rows = mergeDays(weather, air, r.from, r.to).map((row) => ({ ...row, user_id: who.user.id }));
  if (!rows.length) return json({ error: 'Nothing could be fetched' }, 502);

  const db = createClient(url, serviceKey);
  const { error } = await db.from('environment_days').upsert(rows, { onConflict: 'user_id,day' });
  if (error) {
    console.log(`environment: write failed (${error.code})`);
    return json({ error: 'Could not save' }, 500);
  }
  console.log(`environment: ${rows.length} days, weather ${weather.size}, air ${air.size}`);
  return json({ days: rows.length, weather: weather.size > 0, air: air.size > 0 });
});

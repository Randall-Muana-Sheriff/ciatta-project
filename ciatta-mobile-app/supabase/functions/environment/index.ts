// Fetches the air around her for a range of past days, and writes it to
// environment_days.
//
// Called by the app with her access token and a rough area (one decimal
// place, about 10 km). The area is used for the two requests below and is
// not stored or logged. Rows are written for the caller only, from the
// verified token, never from the request body.
//
// Source:
//   Open-Meteo air quality API: PM2.5, US AQI, pollen (Europe only). No key.
//   Temperature and humidity are not fetched; her daylight comes from Apple
//   Health on the phone.
//     Open-Meteo is free for non commercial use; a commercial app needs
//     their paid plan.
//
// Logging: counts and failure reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { type AirRow, checkRequest, mapAirQuality, mergeDays, type WeatherRow } from './map.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}


async function fetchAir(lat: number, lon: number, from: string, to: string): Promise<{ rows: Map<string, AirRow>; tz: string }> {
  const hourly = 'pm2_5,us_aqi,grass_pollen,birch_pollen,alder_pollen,olive_pollen,ragweed_pollen,mugwort_pollen';
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=${hourly}&start_date=${from}&end_date=${to}&timezone=auto`,
  );
  if (!res.ok) throw new Error(`air ${res.status}`);
  const body = await res.json();
  return { rows: mapAirQuality(body), tz: typeof body?.timezone === 'string' ? body.timezone : 'UTC' };
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
  try {
    ({ rows: air } = await fetchAir(r.lat, r.lon, r.from, r.to));
  } catch (e) {
    console.log(`environment: air failed (${e instanceof Error ? e.message : 'unknown'})`);
  }

  const weather = new Map<string, WeatherRow>();

  const rows = mergeDays(weather, air, r.from, r.to).map((row) => ({ ...row, user_id: who.user.id }));
  if (!rows.length) return json({ error: 'Nothing could be fetched' }, 502);

  const db = createClient(url, serviceKey);
  const { error } = await db.from('environment_days').upsert(rows, { onConflict: 'user_id,day' });
  if (error) {
    console.log(`environment: write failed (${error.code})`);
    return json({ error: 'Could not save' }, 500);
  }
  console.log(`environment: ${rows.length} days, air ${air.size}`);
  return json({ days: rows.length, air: air.size > 0 });
});

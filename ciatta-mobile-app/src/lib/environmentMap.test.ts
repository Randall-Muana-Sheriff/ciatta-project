import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkRequest, mapAirQuality, mapWeatherKit, mergeDays } from '../../supabase/functions/environment/map.ts';

const NOW = new Date('2026-10-13T12:00:00Z');

test('a request is a rough area, a past range, and no more than 120 days', () => {
  assert.deepEqual(checkRequest({ lat: 51.5, lon: -0.1, from: '2026-10-01', to: '2026-10-12' }, NOW), {
    lat: 51.5, lon: -0.1, from: '2026-10-01', to: '2026-10-12',
  });
  assert.match((checkRequest({ lat: 51.507, lon: -0.1, from: '2026-10-01', to: '2026-10-12' }, NOW) as { error: string }).error, /rough/);
  assert.match((checkRequest({ lat: 51.5, lon: -0.1, from: '2026-01-01', to: '2026-10-12' }, NOW) as { error: string }).error, /120/);
  assert.match((checkRequest({ lat: 51.5, lon: -0.1, from: '2026-10-12', to: '2026-10-20' }, NOW) as { error: string }).error, /future/);
  assert.match((checkRequest({ lat: 95, lon: 0, from: '2026-10-01', to: '2026-10-02' }, NOW) as { error: string }).error, /area/);
  assert.match((checkRequest({ lat: 51.5, lon: -0.1, from: '2026-10-12', to: '2026-10-01' }, NOW) as { error: string }).error, /range/);
});

test('WeatherKit days become rows in her local days, humidity averaged from the hours', () => {
  const json = {
    forecastDaily: {
      days: [
        { forecastStart: '2026-10-11T23:00:00Z', temperatureMax: 21.4, temperatureMin: 12.1, conditionCode: 'PartlyCloudy', sunrise: '2026-10-12T06:15:00Z', sunset: '2026-10-12T17:15:00Z' },
      ],
    },
    forecastHourly: {
      hours: [
        { forecastStart: '2026-10-11T23:00:00Z', humidity: 0.7 },
        { forecastStart: '2026-10-12T11:00:00Z', humidity: 0.5 },
        { forecastStart: '2026-10-12T23:00:00Z', humidity: 0.9 },
      ],
    },
  };
  const rows = mapWeatherKit(json, 'Europe/London');
  assert.deepEqual(rows.get('2026-10-12'), {
    temp_max_c: 21.4, temp_min_c: 12.1, humidity_mean: 0.6, condition: 'PartlyCloudy', daylight_minutes: 660,
  });
  assert.equal(rows.get('2026-10-13')?.humidity_mean, 0.9, 'an hour of the next local day counts there');
});

test('a missing WeatherKit field is null, never guessed', () => {
  const rows = mapWeatherKit({ forecastDaily: { days: [{ forecastStart: '2026-10-11T23:00:00Z', temperatureMax: 20 }] } }, 'Europe/London');
  assert.deepEqual(rows.get('2026-10-12'), { temp_max_c: 20, temp_min_c: null, humidity_mean: null, condition: null, daylight_minutes: null });
  assert.equal(mapWeatherKit(null, 'UTC').size, 0);
});

test('Open-Meteo hours become a day: PM2.5 averaged, AQI and pollen at their worst', () => {
  const json = {
    hourly: {
      time: ['2026-10-12T00:00', '2026-10-12T12:00', '2026-10-13T00:00'],
      pm2_5: [4, 12, 30],
      us_aqi: [20, 48, 90],
      grass_pollen: [1, 3, null],
      birch_pollen: [0, 2, null],
      alder_pollen: [5, 1, null],
      olive_pollen: [null, null, null],
      ragweed_pollen: [null, null, null],
      mugwort_pollen: [0, 0, null],
    },
  };
  const rows = mapAirQuality(json);
  assert.deepEqual(rows.get('2026-10-12'), { pm2_5: 8, us_aqi: 48, pollen_grass: 3, pollen_tree: 5, pollen_weed: 0 });
  assert.deepEqual(rows.get('2026-10-13'), { pm2_5: 30, us_aqi: 90, pollen_grass: null, pollen_tree: null, pollen_weed: null });
});

test('weather and air for the same day merge into one row; a day with neither is not written', () => {
  const merged = mergeDays(
    new Map([['2026-10-12', { temp_max_c: 20, temp_min_c: 10, humidity_mean: 0.6, condition: null, daylight_minutes: 600 }]]),
    new Map([['2026-10-12', { pm2_5: 8, us_aqi: 40, pollen_grass: null, pollen_tree: null, pollen_weed: null }], ['2026-10-13', { pm2_5: 9, us_aqi: 41, pollen_grass: null, pollen_tree: null, pollen_weed: null }]]),
    '2026-10-12',
    '2026-10-12',
  );
  assert.deepEqual(merged, [
    { day: '2026-10-12', temp_max_c: 20, temp_min_c: 10, humidity_mean: 0.6, condition: null, daylight_minutes: 600, pm2_5: 8, us_aqi: 40, pollen_grass: null, pollen_tree: null, pollen_weed: null },
  ]);
});

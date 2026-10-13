import assert from 'node:assert/strict';
import { test } from 'node:test';

import { experienceRows } from './experienceRows';

const sig = (over: Record<string, unknown>, pain = false) => ({
  pain,
  episode: { locations: [], sensations: [], symptoms: [], flareUpUserReported: null, ...over },
});

test('each row carries one total, with its top items counted underneath', () => {
  const rows = experienceRows(4, [
    sig({ locations: ['Lower abdomen', 'Pelvis'], sensations: ['Cramping'], symptoms: ['Bloating'], flareUpUserReported: true }, true),
    sig({ locations: ['Lower abdomen'], sensations: ['Cramping', 'Stabbing'], symptoms: ['Bloating', 'Fatigue'] }, true),
    sig({ locations: ['Lower back'], symptoms: ['Headache', 'Bloating'] }, false),
  ]);
  assert.deepEqual(rows, {
    pain: { value: '4 days', sub: 'This cycle' },
    places: { value: '2 places', sub: 'Lower abdomen (2) · Pelvis (1)' },
    sensations: { value: '2 kinds', sub: 'Cramping (2) · Stabbing (1)' },
    symptoms: { value: '3 symptoms', sub: 'Bloating (3) · Fatigue (1) · Headache (1)' },
    flares: { value: '1', sub: 'Reported by you' },
  });
});

test('nothing logged reads as nothing, never as zero counts', () => {
  const rows = experienceRows(null, []);
  assert.deepEqual(rows.pain, { value: null, sub: 'No period logged yet' });
  assert.deepEqual(rows.places, { value: null, sub: 'Nothing logged yet' });
  assert.deepEqual(rows.flares, { value: null, sub: 'None reported' });
  assert.deepEqual(experienceRows(1, []).pain, { value: '1 day', sub: 'This cycle' });
});

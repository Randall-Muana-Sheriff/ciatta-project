import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bodySystems } from '../data/adapter';
import { type BodyPoint, type BodyReading, readSystems, type RegionId, SYSTEM_PLACES, WHOLE_BODY } from './bodyMap';

const TEN = ['Circulatory', 'Respiratory', 'Digestive', 'Metabolic', 'Reproductive', 'Urinary', 'Immune', 'Musculoskeletal', 'Nervous', 'Skin'];

const point = (region: RegionId, title: string, system?: string): BodyPoint => ({
  region, meaning: 'reported', state: 'lit', halo: false, title, detail: '', source: 'You reported', ...(system ? { system } : {}),
});

const reading: BodyReading = {
  points: [point('head', 'Headache'), point('chest', 'Palpitations'), point('pelvis', 'Cramps'), point('knee_left', 'Knee pain')],
  systemic: [point('systemic', 'Fatigue'), point('systemic', 'Stress', 'Nervous'), point('systemic', 'Vitamin D', 'Metabolic'), point('systemic', 'Ferritin', 'Circulatory')],
  thread: null,
  lead: null,
};

const titles = (label: string) => readSystems(reading, TEN).find((s) => s.label === label)!.points.map((p) => p.title);

test('the body is ten systems, one word each, in this order', () => {
  assert.deepEqual(bodySystems.map((s) => s.label), TEN);
  assert.deepEqual(Object.keys(SYSTEM_PLACES), TEN);
});

test('lab panels are not body systems', () => {
  for (const gone of ['Substance Levels', 'Other Panels']) assert.ok(!bodySystems.some((s) => s.label === gone));
});

test('the head belongs to Nervous, with stress', () => {
  assert.deepEqual(titles('Nervous'), ['Headache', 'Stress']);
});

test('the chest is shared by Circulatory and Respiratory; iron stays with the blood', () => {
  assert.deepEqual(titles('Circulatory'), ['Palpitations', 'Ferritin']);
  assert.deepEqual(titles('Respiratory'), ['Palpitations']);
});

test('nutrients sit with Metabolic, the pelvis with Reproductive, joints with Musculoskeletal', () => {
  assert.deepEqual(titles('Metabolic'), ['Vitamin D']);
  assert.deepEqual(titles('Reproductive'), ['Cramps']);
  assert.deepEqual(titles('Musculoskeletal'), ['Knee pain']);
});

test('whole body keeps only what belongs to no system', () => {
  assert.deepEqual(titles(WHOLE_BODY), ['Fatigue']);
});

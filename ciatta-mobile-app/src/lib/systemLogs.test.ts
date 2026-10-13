import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { JournalView } from '../data/rows';
import { SYSTEM_DOTS } from './bodyMap';
import { CATEGORIES } from './logCategories';
import { loggedPoints, SYSTEM_CATEGORY, systemsFor } from './systemLogs';

const NOW = new Date(2026, 9, 14, 9);

const view = (items: { at: string; category: string; items: Record<string, string[]> }[]): JournalView => ({
  count: items.length,
  since: '',
  months: [
    {
      month: 'October 2026',
      items: items.map((i) => ({ text: '', date: '', tag: 'Notes', kind: 'Notes' as const, usedInInsight: false, at: i.at, category: i.category as never, items: i.items })),
    },
  ],
});

test('every chip on the Log screen belongs to a system, the whole body, or deliberately to none', () => {
  for (const c of CATEGORIES) {
    for (const item of c.quick) {
      for (const s of systemsFor(c.key, item) ?? []) assert.ok(SYSTEM_DOTS[s], `${item} maps to ${s}, not a system`);
    }
  }
});

test('items land in the system they are about', () => {
  assert.deepEqual(systemsFor('cycle', 'Period'), ['Reproductive']);
  assert.deepEqual(systemsFor('gut', 'Bloating'), ['Digestive']);
  assert.deepEqual(systemsFor('nutrition', 'Skipped a meal'), ['Digestive', 'Metabolic']);
  assert.deepEqual(systemsFor('mind', 'Migraine'), ['Nervous']);
  assert.deepEqual(systemsFor('skin', 'Hair shedding'), ['Skin']);
  assert.deepEqual(systemsFor('sexual', 'Burning when peeing'), ['Urinary']);
  assert.deepEqual(systemsFor('sexual', 'Vaginal dryness'), ['Reproductive']);
  assert.deepEqual(systemsFor('body', 'Hot flashes'), ['Reproductive']);
  assert.deepEqual(systemsFor('body', 'Joint pain'), ['Musculoskeletal']);
  assert.deepEqual(systemsFor('body', 'Chills'), ['Immune']);
  assert.deepEqual(systemsFor('context', 'Damp or mould at home'), ['Respiratory']);
  assert.deepEqual(systemsFor('context', 'Illness'), ['Immune']);
  // Belongs to no one system: the whole body.
  assert.deepEqual(systemsFor('body', 'Fatigue'), []);
  // A medicine is not a part of the body.
  assert.deepEqual(systemsFor('meds', 'Took medication'), null);
  assert.deepEqual(systemsFor('supplements', 'Magnesium'), null);
});

test('each system opens the Log category that logs it', () => {
  assert.equal(SYSTEM_CATEGORY.Reproductive, 'cycle');
  assert.equal(SYSTEM_CATEGORY.Digestive, 'gut');
  assert.equal(SYSTEM_CATEGORY.Nervous, 'mind');
  assert.equal(SYSTEM_CATEGORY.Skin, 'skin');
  assert.equal(SYSTEM_CATEGORY.Urinary, 'sexual');
  for (const s of Object.keys(SYSTEM_DOTS)) assert.ok(SYSTEM_CATEGORY[s], `${s} has a category`);
});

test('her logs from the last 30 days become points under their systems, counted', () => {
  const points = loggedPoints(
    view([
      { at: '2026-10-12T09:00:00Z', category: 'gut', items: { gut: ['Bloating'] } },
      { at: '2026-10-03T09:00:00Z', category: 'gut', items: { gut: ['Bloating', 'Reflux'] } },
      { at: '2026-10-10T09:00:00Z', category: 'body', items: { body: ['Fatigue'] } },
      { at: '2026-10-10T09:00:00Z', category: 'meds', items: { meds: ['Took medication'] } },
      { at: '2026-08-01T09:00:00Z', category: 'mind', items: { mind: ['Migraine'] } },
    ]),
    NOW,
  );
  const bloating = points.find((p) => p.title === 'Bloating')!;
  assert.equal(bloating.system, 'Digestive');
  assert.equal(bloating.detail, 'You logged this 2 times in the last 30 days, most recently on 12 Oct.');
  assert.equal(bloating.source, 'You reported');
  assert.equal(points.find((p) => p.title === 'Reflux')?.detail, 'You logged this once in the last 30 days, on 3 Oct.');
  assert.equal(points.find((p) => p.title === 'Fatigue')?.system, undefined, 'the whole body');
  assert.equal(points.find((p) => p.title === 'Took medication'), undefined);
  assert.equal(points.find((p) => p.title === 'Migraine'), undefined, 'older than 30 days');
});

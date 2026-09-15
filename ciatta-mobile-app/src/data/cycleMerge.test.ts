import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Episode } from './cycleLog';
import { mergeEpisodes, mergeInterventions, mergeWatching } from './cycleMerge';

const episode = (id: string): Episode =>
  ({
    id,
    loggedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-01',
    kinds: [],
    periodStart: null,
    periodEnd: null,
    flow: null,
    allDay: true,
    start: null,
    end: null,
    states: [],
    pattern: null,
    locations: [],
    sensations: [],
    severity: null,
    affect: [],
    trajectory: [],
    changes: [],
    dayImpact: [],
    symptoms: [],
    context: [],
    triggers: [],
    flareUpUserReported: null,
    helped: [],
    helpedAmount: null,
    note: '',
    noteContext: [],
    stool: null,
    bowelPain: null,
    bowelFlags: [],
    similar: false,
  }) as Episode;

test('mergeEpisodes keeps a locally added episode a load does not know about yet', () => {
  const merged = mergeEpisodes([episode('a')], [episode('a'), episode('b')]);
  assert.deepEqual(
    merged.map((e) => e.id),
    ['a', 'b'],
  );
});

test('mergeEpisodes prefers the loaded copy over a stale local one with the same id', () => {
  const local = { ...episode('a'), note: 'stale local edit' };
  const loaded = { ...episode('a'), note: 'saved on the server' };
  const merged = mergeEpisodes([loaded], [local]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].note, 'saved on the server');
});

test('mergeEpisodes with nothing loaded yet keeps every local episode', () => {
  const merged = mergeEpisodes([], [episode('a'), episode('b')]);
  assert.deepEqual(
    merged.map((e) => e.id),
    ['a', 'b'],
  );
});

test('mergeWatching lets a local flip win over what a slower load returns for the same key', () => {
  const merged = mergeWatching({ x: true, y: false }, { x: false });
  assert.deepEqual(merged, { x: false, y: false });
});

test('mergeWatching fills in keys only the load knows about', () => {
  const merged = mergeWatching({ x: true }, {});
  assert.deepEqual(merged, { x: true });
});

test('mergeWatching with nothing saved yet keeps the local map as is', () => {
  const merged = mergeWatching(undefined, { x: true });
  assert.deepEqual(merged, { x: true });
});

test('mergeInterventions keeps one accepted locally during the load', () => {
  const merged = mergeInterventions([{ id: 'walk-1', kind: 'walk', date: '2026-01-01' }], [{ id: 'walk-2', kind: 'walk', date: '2026-01-02' }]);
  assert.deepEqual(
    merged.map((v) => v.id),
    ['walk-2', 'walk-1'],
  );
});

test('mergeInterventions with nothing saved yet keeps the local list as is', () => {
  const merged = mergeInterventions(undefined, [{ id: 'walk-2', kind: 'walk', date: '2026-01-02' }]);
  assert.deepEqual(
    merged.map((v) => v.id),
    ['walk-2'],
  );
});

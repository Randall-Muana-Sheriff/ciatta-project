import assert from 'node:assert/strict';
import { test } from 'node:test';

import { catalogSearchUrl, fastenNote, parseCatalogSearch, placeLine, platformLine } from './fastenCatalog';

const hit = (source: Record<string, unknown>) => ({ _id: source.id, _source: source });
const body = (...sources: Record<string, unknown>[]) => ({ success: true, data: { hits: { total: { value: sources.length }, hits: sources.map(hit) } } });

test('catalog hits become providers with their brand, and one portal and endpoint when there is only one', () => {
  const out = parseCatalogSearch(
    body({
      id: 'b1',
      name: 'Mercy',
      platform_type: ['epic'],
      locations: ['ALL'],
      portals: [{ id: 'p1', name: 'Mercy', endpoints: [{ id: 'e1', platform_type: 'epic' }] }],
    }),
  );
  assert.deepEqual(out, [{ brandId: 'b1', name: 'Mercy', platforms: ['epic'], locations: [], portalId: 'p1', endpointId: 'e1' }]);
});

test('a brand with several portals leaves the choice to Fasten', () => {
  const [kaiser] = parseCatalogSearch(
    body({ id: 'k', name: 'Kaiser', platform_type: ['kaiser', 'athena'], locations: ['CA', 'OR'], portals: [{ id: 'p1', endpoints: [] }, { id: 'p2', endpoints: [] }] }),
  );
  assert.equal(kaiser.portalId, undefined);
  assert.equal(kaiser.endpointId, undefined);
  assert.deepEqual(kaiser.locations, ['CA', 'OR']);
});

test('hidden, nameless and malformed hits are left out', () => {
  const out = parseCatalogSearch(body({ id: 'a', name: 'Shown' }, { id: 'b', name: 'Hidden', hidden: true }, { id: 'c', name: '  ' }, { name: 'No id' }));
  assert.deepEqual(out.map((h) => h.name), ['Shown']);
  assert.deepEqual(parseCatalogSearch(null), []);
  assert.deepEqual(parseCatalogSearch({ data: { hits: { hits: 'x' } } }), []);
});

test('the system behind a provider is named the way people know it', () => {
  assert.equal(platformLine({ platforms: ['epic'] }), 'MyChart');
  assert.equal(platformLine({ platforms: ['cerner'] }), 'Oracle Health');
  assert.equal(platformLine({ platforms: ['aetna'] }), 'Insurance plan');
  assert.equal(platformLine({ platforms: ['cms', 'medicare'] }), 'Insurance plan');
  assert.equal(platformLine({ platforms: ['kaiser', 'athena'] }), 'athenahealth');
  assert.equal(platformLine({ platforms: ['medplum'] }), null);
  assert.equal(platformLine({ platforms: [] }), null);
});

test('where a provider is, when the catalog says', () => {
  assert.equal(placeLine({ locations: [] }), null);
  assert.equal(placeLine({ locations: ['CO'] }), 'CO');
  assert.equal(placeLine({ locations: ['CA', 'OR', 'WA'] }), 'CA, OR, WA');
  assert.equal(placeLine({ locations: ['CA', 'OR', 'WA', 'HI'] }), 'CA, OR, WA and 1 more');
});

test('the search url carries the public id and the mode it implies', () => {
  assert.equal(
    catalogSearchUrl('public_test_x'),
    'https://api.connect.fastenhealth.com/v1/bridge/catalog/search?api_mode=test&public_id=public_test_x',
  );
  assert.match(catalogSearchUrl('public_live_y'), /api_mode=live/);
});

test('the Fasten section says when it could not search, or found nothing', () => {
  assert.equal(fastenNote(null), 'Other providers and insurers could not be searched just now.');
  assert.equal(fastenNote([]), 'No other providers or insurers matched.');
  assert.equal(fastenNote([{ brandId: 'b', name: 'X', platforms: [], locations: [] }]), null);
});

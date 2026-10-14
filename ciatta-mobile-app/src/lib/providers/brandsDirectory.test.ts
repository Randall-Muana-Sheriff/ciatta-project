import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compactBrands, parseCompact } from './brandsDirectory';
import { search } from './directory';

// A Brands bundle in Epic's real shape: a brand Organization holding the
// endpoint and its states, and facility Organizations partOf it with an
// address each.
const BUNDLE = {
  resourceType: 'Bundle',
  entry: [
    {
      fullUrl: 'urn:uuid:brand-slhn',
      resource: {
        resourceType: 'Organization',
        id: 'brand-slhn',
        active: true,
        name: "St Luke's",
        address: [{ state: 'PA' }, { state: 'NJ' }],
        endpoint: [{ reference: 'urn:uuid:ep-slhn' }],
      },
    },
    {
      fullUrl: 'urn:uuid:ep-slhn',
      resource: {
        resourceType: 'Endpoint',
        id: 'ep-slhn',
        status: 'active',
        name: "St Luke's",
        address: 'https://fhir.slhn.org/fhir/api/FHIR/R4/',
      },
    },
    {
      fullUrl: 'urn:uuid:brand-idaho',
      resource: {
        resourceType: 'Organization',
        id: 'brand-idaho',
        active: true,
        name: "St. Luke's",
        address: [{ state: 'ID' }, { state: 'OR' }],
        endpoint: [{ reference: 'urn:uuid:ep-idaho' }],
      },
    },
    {
      fullUrl: 'urn:uuid:ep-idaho',
      resource: {
        resourceType: 'Endpoint',
        id: 'ep-idaho',
        status: 'active',
        name: "St. Luke's",
        address: 'https://epincoming.slhs.org/Interconnect-FHIR/api/FHIR/R4',
      },
    },
    {
      resource: {
        resourceType: 'Organization',
        id: 'f1',
        active: true,
        name: "St. Luke's University Hospital - Bethlehem Campus",
        address: [{ city: 'BETHLEHEM', state: 'PA' }],
        partOf: { reference: 'urn:uuid:brand-slhn' },
      },
    },
    {
      resource: {
        resourceType: 'Organization',
        id: 'f2',
        active: true,
        name: "St. Luke's Boise Medical Center",
        address: [{ city: 'Boise', state: 'ID' }],
        partOf: { reference: 'urn:uuid:brand-idaho' },
      },
    },
    // The same facility written twice under one brand.
    {
      resource: {
        resourceType: 'Organization',
        id: 'f3',
        active: true,
        name: "St. Luke's University Hospital - Bethlehem Campus",
        address: [{ city: 'Bethlehem', state: 'PA' }],
        partOf: { reference: 'urn:uuid:brand-slhn' },
      },
    },
    // Closed, so not offered.
    {
      resource: {
        resourceType: 'Organization',
        id: 'f4',
        active: false,
        name: "St. Luke's Old Clinic",
        address: [{ city: 'Easton', state: 'PA' }],
        partOf: { reference: 'urn:uuid:brand-slhn' },
      },
    },
    // A facility whose brand has no endpoint cannot be connected to.
    {
      resource: {
        resourceType: 'Organization',
        id: 'f5',
        active: true,
        name: 'Nowhere Clinic',
        address: [{ city: 'Austin', state: 'TX' }],
        partOf: { reference: 'urn:uuid:missing' },
      },
    },
  ],
};

const DIR = parseCompact(compactBrands(BUNDLE));
const byName = (name: string) => DIR.filter((e) => e.name === name);

test('every facility arrives with its town and state', () => {
  const [bethlehem] = byName("St. Luke's University Hospital - Bethlehem Campus");
  assert.equal(bethlehem.location, 'Bethlehem, PA');
  assert.equal(byName("St. Luke's Boise Medical Center")[0].location, 'Boise, ID');
});

test('a facility connects to its own health system, not to a namesake', () => {
  assert.equal(byName("St. Luke's University Hospital - Bethlehem Campus")[0].fhirBaseUrl, 'https://fhir.slhn.org/fhir/api/FHIR/R4');
  assert.equal(byName("St. Luke's Boise Medical Center")[0].fhirBaseUrl, 'https://epincoming.slhs.org/Interconnect-FHIR/api/FHIR/R4');
});

test('each health system is a row of its own, located by its states', () => {
  const systems = DIR.filter((e) => e.name === "St Luke's");
  assert.equal(systems.length, 1);
  assert.equal(systems[0].location, 'PA and NJ');
  assert.equal(systems[0].organization, null);
});

test('duplicates, closed facilities and facilities with no connection are left out', () => {
  assert.equal(byName("St. Luke's University Hospital - Bethlehem Campus").length, 1);
  assert.equal(byName("St. Luke's Old Clinic").length, 0);
  assert.equal(byName('Nowhere Clinic').length, 0);
});

test('every row is an Epic MyChart login', () => {
  assert.ok(DIR.every((e) => e.vendor === 'epic' && e.portalName === 'MyChart'));
});

test('the town is searchable, so two systems with one name come apart', () => {
  const groups = search(DIR, 'lukes bethlehem');
  const names = groups.flatMap((g) => g.endpoints.map((x) => x.name));
  assert.deepEqual(names, ["St. Luke's University Hospital - Bethlehem Campus"]);
});

test('systems that share a name are separate groups, each saying where it is', () => {
  const groups = search(DIR, 'st lukes');
  const areas = groups.map((g) => g.area).sort();
  assert.deepEqual(areas, ['ID and OR', 'PA and NJ']);
});

test('a health system leads its own group, ahead of its facilities', () => {
  const pa = search(DIR, 'st lukes').find((g) => g.area === 'PA and NJ');
  assert.ok(pa);
  assert.equal(pa.endpoints[0].name, "St Luke's");
});

test('the compact text survives a round trip with awkward characters', () => {
  const tricky = { entry: [...BUNDLE.entry] };
  (tricky.entry[4].resource as { name: string }).name = 'Tab\tand\nnewline Clinic';
  const rows = parseCompact(compactBrands(tricky));
  assert.ok(rows.some((e) => e.name === 'Tab and newline Clinic'));
});

test('a damaged file gives what it can rather than throwing', () => {
  assert.deepEqual(parseCompact(''), []);
  assert.doesNotThrow(() => parseCompact('F\tOrphan\tTown\tPA\t99\ngarbage'));
});

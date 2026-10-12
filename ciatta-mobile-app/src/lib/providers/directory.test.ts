import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Endpoint, fold, groupLine, hasMore, noResults, PREVIEW, search } from './directory';

const e = (id: string, name: string, organization: string | null = null): Endpoint => ({
  id,
  name,
  organization,
  fhirBaseUrl: `https://example.org/${id}/api/FHIR/R4`,
  vendor: 'epic',
  portalName: 'MyChart',
});

const DIR: Endpoint[] = [
  e('1', "St Lukes' Rheumatology Assoc 8th Ave", "St Luke's"),
  e('2', 'St Lukes Weight Managment Center', "St Luke's"),
  e('3', 'St Lukes Cancer Care Oncology Dietician', "St Luke's"),
  e('4', 'St Lukes Boise Medical Center', "St Luke's"),
  e('5', 'SLHS ST LUKES PLAZA', 'St. Lukes'),
  e('6', 'St. Lukes Hospital SF'),
  e('7', 'Mayo Clinic Rochester', 'Mayo Clinic'),
  e('8', 'Cleveland Clinic Main Campus', 'Cleveland Clinic'),
];

// ── Folding, which every comparison depends on ───────────────────────

test('case, punctuation and the possessive all fold away', () => {
  assert.equal(fold("St Luke's"), 'st lukes');
  assert.equal(fold('ST LUKES'), 'st lukes');
  assert.equal(fold('St. Lukes'), 'st lukes');
  assert.equal(fold("  st   luke’s  "), 'st lukes');
});

// ── Finding hers ─────────────────────────────────────────────────────

test('what she types finds what the directory spells differently', () => {
  // She types no apostrophe. The directory has four spellings.
  const groups = search(DIR, 'St lukes');
  const names = groups.flatMap((g) => g.endpoints.map((x) => x.name));
  assert.ok(names.includes("St Lukes' Rheumatology Assoc 8th Ave"));
  assert.ok(names.includes('SLHS ST LUKES PLAZA'));
  assert.ok(names.includes('St. Lukes Hospital SF'));
});

test('words may arrive in any order, so a half remembered name still lands', () => {
  const found = search(DIR, 'boise lukes').flatMap((g) => g.endpoints.map((x) => x.name));
  assert.deepEqual(found, ['St Lukes Boise Medical Center']);
});

test('one letter is not a search, so the screen is not flooded on the first keystroke', () => {
  assert.deepEqual(search(DIR, 's'), []);
  assert.deepEqual(search(DIR, ''), []);
});

test('nothing matching returns nothing rather than everything', () => {
  assert.deepEqual(search(DIR, 'zzzz'), []);
});

// ── Grouping, which is what makes 612 clinics readable ───────────────

test('endpoints gather under their organization', () => {
  const group = search(DIR, 'St lukes').find((g) => g.title === "St Luke's");
  assert.ok(group);
  assert.equal(group?.endpoints.length, 4);
  assert.equal(group?.single, false);
});

test('a clinic with no parent is its own group and says nothing about a count', () => {
  const group = search(DIR, 'Hospital SF')[0];
  assert.equal(group.title, 'St. Lukes Hospital SF');
  assert.equal(group.single, true);
  assert.equal(groupLine(group), null);
});

test('a group of several says how many there are', () => {
  const group = search(DIR, 'St lukes').find((g) => g.title === "St Luke's");
  assert.equal(groupLine(group!), '4 results under this organization');
});

test('view all appears only when there is more than the preview', () => {
  const many = search(DIR, 'St lukes').find((g) => g.title === "St Luke's");
  assert.equal(hasMore(many!), 4 > PREVIEW);
  const one = search(DIR, 'Mayo')[0];
  assert.equal(hasMore(one), false);
});

// ── Order ────────────────────────────────────────────────────────────

test('a name that starts with what she typed comes before one that merely contains it', () => {
  const dir = [e('a', 'Mercy Hospital'), e('b', 'St Mercy Regional'), e('c', 'Mercy Clinic North')];
  const titles = search(dir, 'mercy').map((g) => g.title);
  assert.equal(titles[0], 'Mercy Clinic North');
  assert.ok(titles.indexOf('St Mercy Regional') > titles.indexOf('Mercy Hospital'));
});

// ── What it says when it finds nothing ───────────────────────────────

test('the empty line quotes her words and does not blame her provider', () => {
  const line = noResults('  Bellevue  ');
  assert.ok(line.includes('"Bellevue"'));
  assert.ok(!/[—–]/.test(line));
  for (const w of ['cause', 'because', 'diagnos', 'you have', 'condition']) {
    assert.ok(!line.toLowerCase().includes(w), w);
  }
});

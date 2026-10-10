import assert from 'node:assert/strict';
import { test } from 'node:test';

import { profileOverview, sharingFor, type OverviewInput } from './profileOverview';

const NOW = new Date(2026, 9, 10);

function input(over: Partial<OverviewInput> = {}): OverviewInput {
  return {
    name: 'Jenny',
    since: new Date(2026, 3, 10),
    conditions: ['Endometriosis'],
    surgeries: [],
    medications: ['Levothyroxine'],
    supplements: [],
    symptoms: ['Fatigue'],
    observationCount: 5017,
    daysWithData: 120,
    sources: ['Apple Health'],
    now: NOW,
    ...over,
  };
}

test('it opens on what she told Ciatta, because that is the part she authored', () => {
  const p = profileOverview(input());
  assert.ok(p.startsWith('Jenny, when you started, you told me'));
  assert.ok(p.includes('Endometriosis'));
  assert.ok(p.includes('Levothyroxine'));
  assert.ok(p.includes('Fatigue'));
});

test('it says how long she has been sharing and how much arrived', () => {
  const p = profileOverview(input());
  assert.match(p, /with Ciatta for 6 months/);
  assert.ok(p.includes('5,017 readings'));
  assert.ok(p.includes('Apple Health'));
  assert.ok(p.includes('120 days'));
});

test('the paragraph grows with the record rather than being written once', () => {
  // A woman six months in must not read the paragraph she read on day one.
  const dayOne = profileOverview(input({ since: NOW, observationCount: 0, daysWithData: 0, sources: [] }));
  const later = profileOverview(input());
  assert.notEqual(dayOne, later);
  assert.match(dayOne, /since today/);
  assert.match(dayOne, /no readings have arrived yet/);
});

test('reported and measured stay apart', () => {
  const p = profileOverview(input());
  const told = p.indexOf('you told me');
  const measured = p.indexOf('readings have arrived');
  assert.ok(told >= 0 && measured > told, 'the two kinds of knowing were merged or reordered');
});

test('no onboarding and no history is an empty record, said plainly', () => {
  const p = profileOverview(input({ since: null, conditions: [], medications: [], symptoms: [], observationCount: 0 }));
  assert.match(p, /record is empty/);
  assert.ok(!/told me/.test(p), 'it claimed she said something');
});

test('nothing shared but a record started says so without listing absences', () => {
  const p = profileOverview(input({ conditions: [], medications: [], supplements: [], surgeries: [], symptoms: [] }));
  assert.match(p, /not much about you here yet/);
  for (const absence of ['no conditions', 'no medications', 'none']) {
    assert.ok(!p.toLowerCase().includes(absence), `it reported an absence as a fact: ${absence}`);
  }
});

test('a span reads as the unit she recognises', () => {
  const since = (days: number) => new Date(NOW.getTime() - days * 86400000);
  assert.equal(sharingFor(since(0), NOW), 'since today');
  assert.equal(sharingFor(since(1), NOW), 'for a day');
  assert.equal(sharingFor(since(5), NOW), 'for 5 days');
  assert.equal(sharingFor(since(21), NOW), 'for 3 weeks');
  assert.equal(sharingFor(since(100), NOW), 'for 3 months');
  assert.equal(sharingFor(since(400), NOW), 'for 1 year and 1 month');
  assert.equal(sharingFor(since(730), NOW), 'for 2 years');
});

test('one of anything is singular', () => {
  const p = profileOverview(input({ symptoms: ['Fatigue'], daysWithData: 1, observationCount: 1 }));
  assert.ok(p.includes('the symptom you named is Fatigue'));
  assert.ok(p.includes('across 1 day.'), `read: ${p}`);
});

test('the paragraph holds no dash of any kind', () => {
  for (const p of [profileOverview(input()), profileOverview(input({ since: null, conditions: [], medications: [], symptoms: [], observationCount: 0 }))]) {
    for (const dash of ['—', '–', '-']) {
      assert.ok(!p.includes(dash), `the overview contains ${dash}`);
    }
  }
});

test('it claims nothing about what any of it means', () => {
  const p = profileOverview(input()).toLowerCase();
  for (const claim of ['because', 'caused', 'suggests', 'indicates', 'risk of', 'you have ']) {
    assert.ok(!p.includes(claim), `the overview reads as a finding: ${claim}`);
  }
});

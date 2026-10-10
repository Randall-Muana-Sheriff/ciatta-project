import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  appsMissingArtwork,
  encryptionNote,
  healthDisclosureParagraph,
  importSummaryLine,
  metricWords,
  monogram,
  SYNC_APPS,
} from './healthDisclosure';

// ── The copy ──────────────────────────────────────────────────────────

test('the paragraph says what connecting does and what it brings in', () => {
  const p = healthDisclosureParagraph();
  for (const fragment of ['Connect Apple Health', 'sleep patterns', 'activity levels', 'heart rate']) {
    assert.ok(p.includes(fragment), `the paragraph dropped ${fragment}`);
  }
});

test('the copy holds no dash of any kind', () => {
  // The project rule, and the reason heart rate is two words here.
  for (const text of [healthDisclosureParagraph(), encryptionNote(), ...SYNC_APPS.map((a) => a.name)]) {
    for (const dash of ['—', '–', '-']) {
      assert.ok(!text.includes(dash), `"${text}" contains ${dash}`);
    }
  }
});

test('nothing claims a reading means something', () => {
  // The screen renders before a single sample has been read, so a sentence
  // about what any of this reveals would be a finding with nothing to find
  // it in.
  const all = `${healthDisclosureParagraph()} ${encryptionNote()}`.toLowerCase();
  for (const claim of ['diagnos', 'detects', 'predicts', 'proves', 'means you']) {
    assert.ok(!all.includes(claim), `the copy claims a finding: ${claim}`);
  }
});

test('the encryption line promises consent, not secrecy it cannot keep', () => {
  // It is the one sentence here that is a promise about handling rather than
  // a description of a feature. "Never shared" alone would be false the day
  // she asks Ciatta to send a summary to a doctor; the permission clause is
  // what keeps it true, so it has to stay.
  const note = encryptionNote();
  assert.ok(/encrypted/.test(note), 'the line no longer mentions encryption');
  assert.ok(/without your permission/.test(note), 'the line promises secrecy with no consent clause');
  assert.ok(!/never shared\.?$/.test(note), 'the line promises data is never shared at all');
});

// ── The apps that sync ────────────────────────────────────────────────

test('the sync list is the seven named, in order', () => {
  assert.deepEqual(
    SYNC_APPS.map((a) => a.name),
    ['Oura', 'Whoop', '8 Sleep', 'Withings', 'Garmin', 'Strava', 'Omron'],
  );
});

test('every brand points at its own mark and nobody else\'s', () => {
  // The rule that matters on this list, and it is written out rather than
  // derived from the name: the derivation used to be mark === name
  // lowercased, which quietly stopped being true the moment 8 Sleep's file
  // was called eightsleep. A pairing table cannot drift like that.
  const EXPECTED: Record<string, string> = {
    Oura: 'oura',
    Whoop: 'whoop',
    '8 Sleep': 'eightsleep',
    Withings: 'withings',
    Garmin: 'garmin',
    Strava: 'strava',
    Omron: 'omron',
  };
  for (const app of SYNC_APPS) {
    assert.equal(app.mark, EXPECTED[app.name], `${app.name} is showing the ${app.mark} mark`);
  }
});

test('no brand is left showing a monogram', () => {
  // Every app has real artwork now. The monogram path stays for the next
  // app added, which is why it is still tested below.
  assert.deepEqual(appsMissingArtwork(), []);
});

test('a monogram is short, and a name starting with a digit still reads', () => {
  assert.equal(monogram('8 Sleep'), '8S');
  assert.equal(monogram('Withings'), 'WI');
  assert.equal(monogram('Garmin'), 'GA');
  for (const app of SYNC_APPS) {
    assert.ok(monogram(app.name).length <= 2, `${app.name} has a monogram that will not fit`);
  }
});

// ── What came in ──────────────────────────────────────────────────────

test('no import means no line at all, rather than a hopeful one', () => {
  assert.equal(importSummaryLine(null), '');
});

test('a run that found nothing says so, and does not read as a failure', () => {
  const line = importSummaryLine({ observations: 0, metrics: 0, failed: 0, top: [] });
  assert.ok(/Nothing to import yet/.test(line));
  assert.ok(!/0 readings/.test(line), 'it printed a zero at her');
  for (const alarm of ['error', 'failed', 'problem', 'wrong']) {
    assert.ok(!line.toLowerCase().includes(alarm), `an empty Apple Health read as a failure: ${alarm}`);
  }
});

test('the line counts what actually landed and names the largest kinds', () => {
  const line = importSummaryLine({
    observations: 5017,
    metrics: 9,
    failed: 0,
    top: [
      { metric: 'steps', observations: 2400 },
      { metric: 'heart_rate', observations: 1800 },
      { metric: 'sleep_analysis', observations: 600 },
    ],
  });
  assert.ok(line.includes('5017 readings'), 'the count is not hers to see');
  assert.ok(line.includes('9 kinds'));
  assert.ok(line.includes('steps, heart rate and sleep'), `read: ${line}`);
});

test('a partial run admits what did not arrive', () => {
  const line = importSummaryLine({
    observations: 12,
    metrics: 1,
    failed: 3,
    top: [{ metric: 'steps', observations: 12 }],
  });
  assert.ok(/did not come through/.test(line), 'a partial run read as a complete one');
  assert.ok(line.includes('1 kind'), 'it pluralised a single kind');
});

test('one reading is a reading, not 1 readings', () => {
  const line = importSummaryLine({ observations: 1, metrics: 1, failed: 0, top: [{ metric: 'hrv', observations: 1 }] });
  assert.ok(line.includes('1 reading across'), `read: ${line}`);
});

test('an internal metric name never reaches her', () => {
  assert.equal(metricWords('resting_heart_rate'), 'resting heart rate');
  assert.equal(metricWords('sleep_analysis'), 'sleep');
  // Unmapped falls back to opened out underscores, never the raw key.
  assert.equal(metricWords('apple_stand_time'), 'apple stand time');
  assert.ok(!metricWords('apple_stand_time').includes('_'));
});

test('the import line holds no dash of any kind', () => {
  const line = importSummaryLine({ observations: 9, metrics: 2, failed: 1, top: [{ metric: 'steps', observations: 9 }] });
  for (const dash of ['—', '–', '-']) {
    assert.ok(!line.includes(dash), `the import line contains ${dash}`);
  }
});

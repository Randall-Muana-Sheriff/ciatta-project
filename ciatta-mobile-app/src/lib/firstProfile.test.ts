import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileStages, readingsHeadline, stageState } from './firstProfile';

test('the readings line says the real count, grouped so it can be read', () => {
  assert.ok(compileStages(14283)[0].label.includes('14,283'));
  assert.equal(readingsHeadline(14283), '14,283');
});

test('one measurement is a measurement', () => {
  assert.ok(compileStages(1)[0].label.includes('1 measurement from'));
});

test('nothing imported says nothing imported, and does not read as a failure', () => {
  // An empty Apple Health is usually a phone that holds nothing for these
  // types yet. It must not tick as though data arrived, and it must not
  // sound like something broke.
  const label = compileStages(0)[0].label;
  assert.ok(/No measurements from Apple Health yet/.test(label));
  assert.ok(!/0 measurements/.test(label), 'it printed a zero at her');
  for (const alarm of ['error', 'failed', 'problem', 'could not']) {
    assert.ok(!label.toLowerCase().includes(alarm), `an empty read sounds like a failure: ${alarm}`);
  }
});

test('the stages are the real steps, in the order they happen', () => {
  assert.deepEqual(compileStages(10).map((s) => s.id), ['readings', 'answers', 'saved', 'profile']);
});

test('nothing ticks before the step above it has finished', () => {
  // The rule that keeps this honest. A stage can only be done once the work
  // it names is done, and the screen drives that from the work rather than
  // from a timer.
  assert.deepEqual(
    compileStages(10).map((s) => stageState(s.id, null)),
    ['running', 'waiting', 'waiting', 'waiting'],
  );
  assert.deepEqual(
    compileStages(10).map((s) => stageState(s.id, 'answers')),
    ['done', 'done', 'running', 'waiting'],
  );
  assert.deepEqual(
    compileStages(10).map((s) => stageState(s.id, 'profile')),
    ['done', 'done', 'done', 'done'],
  );
});

test('no stage label holds a dash of any kind', () => {
  for (const readings of [0, 1, 14283]) {
    for (const stage of compileStages(readings)) {
      for (const dash of ['—', '–', '-']) {
        assert.ok(!stage.label.includes(dash), `"${stage.label}" contains ${dash}`);
      }
    }
  }
});

test('no stage claims to have found anything', () => {
  // Nothing has been interpreted at this point. A stage saying Ciatta spotted
  // or detected something would be a finding invented to fill a progress bar.
  for (const stage of compileStages(500)) {
    const l = stage.label.toLowerCase();
    for (const claim of ['spotted', 'detected', 'found a', 'analysing your', 'diagnos']) {
      assert.ok(!l.includes(claim), `"${stage.label}" claims a finding`);
    }
  }
});

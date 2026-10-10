import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SYNC_APPS } from './healthDisclosure';
import { guideFor, SYNC_GUIDES } from './syncInstructions';

test('every app in the rail has a guide, and every guide has an app', () => {
  // The pairing is what the screen depends on. A tile with no guide opens an
  // empty card; a guide for an app nobody lists is never reachable.
  const apps = SYNC_APPS.map((a) => a.name).sort();
  const guides = SYNC_GUIDES.map((g) => g.app).sort();
  assert.deepEqual(guides, apps);
});

test('each guide names its own app in its title', () => {
  for (const guide of SYNC_GUIDES) {
    assert.ok(guide.title.includes(guide.app), `"${guide.title}" does not name ${guide.app}`);
    assert.ok(/^Connect your .+ to Apple Health$/.test(guide.title), `"${guide.title}" is off format`);
  }
});

test('every guide ends somewhere the connection is actually granted', () => {
  // The step that matters. An instruction that stops at the vendor's toggle
  // leaves her thinking she is done while Apple has granted nothing.
  for (const guide of SYNC_GUIDES) {
    const last = guide.steps[guide.steps.length - 1];
    assert.ok(
      /Allow|Toggle the categories/.test(last),
      `${guide.app} ends on "${last}", which is not the step that grants access`,
    );
  }
});

test('the steps are followable: between three and six, each one action', () => {
  for (const guide of SYNC_GUIDES) {
    assert.ok(guide.steps.length >= 3 && guide.steps.length <= 6, `${guide.app} has ${guide.steps.length} steps`);
    for (const step of guide.steps) {
      assert.ok(step.length > 0, `${guide.app} has an empty step`);
      assert.ok(step.length < 90, `${guide.app} has a step too long to follow: ${step}`);
      assert.equal(step.trim(), step, `${guide.app} has a padded step`);
    }
  }
});

test('no step holds a dash of any kind', () => {
  for (const guide of SYNC_GUIDES) {
    for (const text of [guide.title, ...guide.steps]) {
      for (const dash of ['—', '–', '-']) {
        assert.ok(!text.includes(dash), `"${text}" contains ${dash}`);
      }
    }
  }
});

test('every guide records when a human last checked it', () => {
  // These describe other companies' menus, which change without warning and
  // nothing here can test against them. The date is how a stale instruction
  // gets found rather than trusted.
  for (const guide of SYNC_GUIDES) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(guide.checked), `${guide.app} has no check date`);
  }
});

test('a guide can be found by app name, and an unknown app returns nothing', () => {
  assert.equal(guideFor('Oura')?.app, 'Oura');
  assert.equal(guideFor('Fitbit'), null);
});

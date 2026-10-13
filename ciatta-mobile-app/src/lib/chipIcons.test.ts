import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './logCategories';
import { chipIcon } from './chipIcons';

test('every quick chip on the Log screen has a picture of its own', () => {
  for (const c of CATEGORIES) {
    for (const chip of c.quick) assert.ok(chipIcon(chip, c.key, true), `${c.label}: ${chip}`);
  }
});

test('a chip it does not know, like her own medicine, takes its category\'s picture', () => {
  assert.equal(chipIcon('Levothyroxine', 'meds'), 'pill');
  assert.equal(chipIcon('Caffeine', 'nutrition'), 'cup');
});

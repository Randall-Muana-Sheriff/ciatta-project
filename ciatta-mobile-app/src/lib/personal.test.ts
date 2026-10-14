import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_LANGUAGES, GENDERS, genderLabel, POPULAR_LANGUAGES } from './personal';

test('English leads, then the most spoken languages, then every language A to Z', () => {
  assert.equal(POPULAR_LANGUAGES[0], 'English');
  for (const l of ['Spanish', 'Mandarin Chinese', 'Hindi', 'Arabic', 'French', 'Portuguese', 'Swahili']) assert.ok(POPULAR_LANGUAGES.includes(l), l);
  const sorted = [...ALL_LANGUAGES].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ALL_LANGUAGES, sorted, 'the full list is alphabetical');
  assert.equal(new Set(ALL_LANGUAGES).size, ALL_LANGUAGES.length);
  for (const l of POPULAR_LANGUAGES) assert.ok(ALL_LANGUAGES.includes(l), `${l} is also in the full list`);
  assert.ok(ALL_LANGUAGES.length >= 150);
  for (const l of ALL_LANGUAGES) assert.ok(!/[-–—]/.test(l), l);
});

test('African languages are listed', () => {
  for (const l of ['Yoruba', 'Igbo', 'Hausa', 'Amharic', 'Zulu', 'Xhosa', 'Somali', 'Oromo', 'Twi', 'Wolof', 'Lingala', 'Kinyarwanda', 'Shona', 'Krio', 'Afrikaans', 'Tigrinya']) {
    assert.ok(ALL_LANGUAGES.includes(l), l);
  }
});

test('gender offers inclusive options, with a way to decline', () => {
  const labels = GENDERS.map((g) => g.label);
  for (const want of ['Woman', 'Man', 'Non binary', 'Prefer not to say']) assert.ok(labels.includes(want), want);
  assert.equal(genderLabel('woman'), 'Woman');
  assert.equal(genderLabel('martian'), null);
});

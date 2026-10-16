import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_LANGUAGES, POPULAR_LANGUAGES, SEXES_AT_BIRTH, sexAtBirthLabel } from './personal';

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

test('sex at birth offers female, male and intersex, with a way to decline', () => {
  assert.deepEqual(SEXES_AT_BIRTH.map((g) => g.label), ['Female', 'Male', 'Intersex', 'Prefer not to say']);
  assert.equal(sexAtBirthLabel('female'), 'Female');
  assert.equal(sexAtBirthLabel('martian'), null);
});

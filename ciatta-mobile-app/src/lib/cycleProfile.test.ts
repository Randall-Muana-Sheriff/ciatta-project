import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_PROFILE, fertilityOn, normalizeProfile, SAMPLE_PROFILE, toggleSituation } from './cycleProfile';

test('situations combine freely', () => {
  const p = toggleSituation(toggleSituation(EMPTY_PROFILE, 'Endometriosis'), 'Perimenopause');
  assert.deepEqual(p.situations, ['Endometriosis', 'Perimenopause']);
});

test('regular and irregular exclude each other', () => {
  const p = toggleSituation(toggleSituation(EMPTY_PROFILE, 'Regular'), 'Irregular');
  assert.deepEqual(p.situations, ['Irregular']);
});

test('no periods right now clears regular and irregular', () => {
  const p = toggleSituation({ ...EMPTY_PROFILE, situations: ['Irregular', 'Endometriosis'] }, 'No periods right now');
  assert.deepEqual(p.situations, ['Endometriosis', 'No periods right now']);
});

test('picking regular clears no periods right now', () => {
  const p = toggleSituation({ ...EMPTY_PROFILE, situations: ['No periods right now'] }, 'Regular');
  assert.deepEqual(p.situations, ['Regular']);
});

test('tapping a selected situation removes it', () => {
  assert.deepEqual(toggleSituation(SAMPLE_PROFILE, 'Endometriosis').situations, ['Irregular']);
});

test('sample profile is endometriosis plus irregular', () => {
  assert.deepEqual(SAMPLE_PROFILE, { situations: ['Endometriosis', 'Irregular'], setupDone: true });
});

test('fertility is on unless switched off, on hormonal contraception, or without periods', () => {
  assert.equal(fertilityOn(SAMPLE_PROFILE), true);
  assert.equal(fertilityOn({ ...SAMPLE_PROFILE, showFertility: false }), false);
  assert.equal(fertilityOn({ ...SAMPLE_PROFILE, situations: ['Hormonal contraception'] }), false);
  assert.equal(fertilityOn({ ...SAMPLE_PROFILE, situations: ['No periods right now'] }), false);
});

test('normalizeProfile rejects anything without an array of situations', () => {
  assert.equal(normalizeProfile(null), null);
  assert.equal(normalizeProfile('not a profile'), null);
  assert.equal(normalizeProfile({}), null);
  assert.equal(normalizeProfile({ situations: 'Irregular' }), null);
});

test('normalizeProfile drops unknown situations, duplicates and mistyped fields', () => {
  const raw = {
    situations: ['Endometriosis', 'Made up', 'Endometriosis'],
    setupDone: true,
    birthDate: 5,
    contraception: 'Pill',
    showFertility: 'yes',
  };
  assert.deepEqual(normalizeProfile(raw), { situations: ['Endometriosis'], setupDone: true, contraception: 'Pill' });
});

test('normalizeProfile round trips the sample profile unchanged', () => {
  assert.deepEqual(normalizeProfile(SAMPLE_PROFILE), SAMPLE_PROFILE);
});

test('a new person starts with no situation and no fertility estimate', () => {
  assert.deepEqual(EMPTY_PROFILE.situations, []);
  assert.equal(fertilityOn(EMPTY_PROFILE), false);
});

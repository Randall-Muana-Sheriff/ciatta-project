import assert from 'node:assert/strict';
import { test } from 'node:test';

import { endUse, startUse, type ProductUse } from './periodProducts';
import {
  absorbencyHint,
  cupIudNote,
  heavyBleedingFlag,
  overnightNote,
  remindersFor,
  RULES,
  tssWarning,
  TSS_SIGNS,
} from './productSafety';

const at = (h: number, m = 0, day = 12) => new Date(2026, 9, day, h, m).toISOString();
const use = (product: ProductUse['product'], size: string, h: number, m = 0) =>
  startUse([], { id: 'u1', product, size, at: at(h, m) })[0];

test('every rule names its source', () => {
  for (const r of RULES) assert.ok(r.source.length > 10, r.id);
});

test('a tampon is nudged at 6 hours and firmly at 8; nothing past what the FDA labeling says', () => {
  const rs = remindersFor(use('Tampon', 'Super', 8));
  assert.deepEqual(rs.map((r) => new Date(r.at).getHours()), [14, 16]);
  assert.equal(rs[1].body, 'Time to change your tampon. It has been 8 hours.');
});

test('a cup or disc at 10 and 12 hours; a pad gently at 6; underwear gently at 10', () => {
  assert.deepEqual(remindersFor(use('Cup', 'Small', 6)).map((r) => new Date(r.at).getHours()), [16, 18]);
  assert.deepEqual(remindersFor(use('Pad', 'Regular', 6)).map((r) => new Date(r.at).getHours()), [12]);
  assert.deepEqual(remindersFor(use('Period underwear', 'Heavy', 6)).map((r) => new Date(r.at).getHours()), [16]);
});

test('reminder text names the product and nothing about her body', () => {
  for (const r of [...remindersFor(use('Tampon', 'Super', 8)), ...remindersFor(use('Cup', 'Small', 8))]) {
    assert.ok(!/(bleed|blood|period|flow|heavy|symptom)/i.test(`${r.title} ${r.body}`), r.body);
    assert.ok(!/[-–—]/.test(`${r.title} ${r.body}`), r.body);
  }
});

test('reminders already past are not scheduled', () => {
  const rs = remindersFor(use('Tampon', 'Super', 8), new Date(2026, 9, 12, 15));
  assert.deepEqual(rs.map((r) => new Date(r.at).getHours()), [16]);
});

test('lowest absorbency: a tampon out not full after six hours or more suggests a lighter one', () => {
  let uses = startUse([], { id: 'a', product: 'Tampon', size: 'Super', at: at(8) });
  uses = endUse(uses, { at: at(15), fullness: 'Not full' });
  assert.match(absorbencyHint(uses)!, /lower absorbency/);
  let short = startUse([], { id: 'b', product: 'Tampon', size: 'Super', at: at(8) });
  short = endUse(short, { at: at(10), fullness: 'Not full' });
  assert.equal(absorbencyHint(short), null);
});

test('overnight: a tampon put in after 9 PM gets the overnight note, nothing else does', () => {
  assert.match(overnightNote(use('Tampon', 'Regular', 22))!, /longer than 8 hours/);
  assert.equal(overnightNote(use('Tampon', 'Regular', 14)), null);
  assert.equal(overnightNote(use('Pad', 'Overnight', 22)), null);
});

test('toxic shock warning signs while a tampon, cup or disc is in: remove it and get care now', () => {
  const inNow = use('Tampon', 'Super', 8);
  assert.match(tssWarning('sudden fever and I feel faint', inNow)!, /Remove it and get medical care now/);
  assert.equal(tssWarning('sudden fever', null), null, 'nothing in, no product warning');
  assert.equal(tssWarning('a bit tired', inNow), null);
  assert.equal(tssWarning('sudden fever', use('Pad', 'Regular', 8)), null, 'pads are not linked to toxic shock');
  assert.ok(TSS_SIGNS.length >= 6);
});

test('heavy bleeding: two or more in a row soaked within an hour is worth telling a clinician', () => {
  let uses: ProductUse[] = [];
  uses = startUse(uses, { id: 'a', product: 'Pad', size: 'Heavy', at: at(8) });
  uses = endUse(uses, { at: at(8, 50), fullness: 'Soaked' });
  uses = startUse(uses, { id: 'b', product: 'Pad', size: 'Heavy', at: at(8, 50) });
  uses = endUse(uses, { at: at(9, 40), fullness: 'Leaked' });
  assert.match(heavyBleedingFlag(uses, new Date(2026, 9, 12, 10))!, /worth telling your clinician/);
  // One fast soak is not the pattern.
  assert.equal(heavyBleedingFlag(uses.slice(0, 1), new Date(2026, 9, 12, 10)), null);
  // Yesterday's does not keep flagging today.
  assert.equal(heavyBleedingFlag(uses, new Date(2026, 9, 14, 10)), null);
});

test('a cup with a hormonal IUD gets the one time note about the seal', () => {
  assert.match(cupIudNote('Cup', 'Hormonal IUD')!, /break the cup or disc seal/);
  assert.equal(cupIudNote('Cup', 'Pill'), null);
  assert.equal(cupIudNote('Tampon', 'Hormonal IUD'), null);
});

test('no safety line carries a dash', () => {
  const lines = [
    ...RULES.map((r) => r.text),
    tssWarning('fever', use('Cup', 'Small', 8))!,
    overnightNote(use('Tampon', 'Regular', 22))!,
    cupIudNote('Disc', 'Hormonal IUD')!,
  ];
  for (const l of lines) assert.ok(!/[-–—]/.test(l), l);
});

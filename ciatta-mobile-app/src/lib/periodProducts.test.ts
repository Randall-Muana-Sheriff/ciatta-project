import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FULLNESS, inForLine, openUse, PRODUCTS, SIZES, startUse, endUse, type ProductUse } from './periodProducts';

const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m).toISOString();

test('the products and their sizes, tampons in the FDA absorbency terms', () => {
  assert.deepEqual([...PRODUCTS], ['Pad', 'Tampon', 'Cup', 'Disc', 'Period underwear']);
  assert.deepEqual([...SIZES.Tampon], ['Light', 'Regular', 'Super', 'Super plus', 'Ultra']);
  assert.ok(SIZES.Pad.includes('Overnight'));
  assert.deepEqual([...FULLNESS], ['Not full', 'Partly full', 'Soaked', 'Leaked']);
});

test('no label carries a dash', () => {
  for (const s of [...PRODUCTS, ...Object.values(SIZES).flat(), ...FULLNESS]) assert.ok(!/[-–—]/.test(s), s);
});

test('putting one in starts a use', () => {
  const uses = startUse([], { id: 'a', product: 'Tampon', size: 'Super', at: at(8) });
  assert.deepEqual(openUse(uses), { id: 'a', product: 'Tampon', size: 'Super', startedAt: at(8), endedAt: null, fullness: null });
});

test('putting a new one in closes the one that was in, at that moment', () => {
  let uses = startUse([], { id: 'a', product: 'Tampon', size: 'Super', at: at(8) });
  uses = startUse(uses, { id: 'b', product: 'Pad', size: 'Overnight', at: at(14) });
  assert.equal(uses.find((u) => u.id === 'a')!.endedAt, at(14));
  assert.equal(openUse(uses)?.id, 'b');
  assert.equal(uses.filter((u) => u.endedAt == null).length, 1, 'never two in at once');
});

test('taking it out closes it, with how full it was when she said', () => {
  let uses = startUse([], { id: 'a', product: 'Cup', size: 'Small', at: at(8) });
  uses = endUse(uses, { at: at(16), fullness: 'Partly full' });
  assert.equal(openUse(uses), null);
  assert.equal(uses[0].fullness, 'Partly full');
  // Skipping the question leaves it unknown, never a guess.
  const skipped = endUse(startUse([], { id: 'b', product: 'Pad', size: 'Regular', at: at(8) }), { at: at(9), fullness: null });
  assert.equal(skipped[0].fullness, null);
});

test('taking out with nothing in changes nothing', () => {
  const uses: ProductUse[] = [];
  assert.equal(endUse(uses, { at: at(9), fullness: null }), uses);
});

test('how long it has been in, in her words', () => {
  const u = openUse(startUse([], { id: 'a', product: 'Tampon', size: 'Regular', at: at(8) }))!;
  assert.equal(inForLine(u, new Date(2026, 9, 12, 11, 20)), 'In for 3h 20m');
  assert.equal(inForLine(u, new Date(2026, 9, 12, 8, 40)), 'In for 40m');
  assert.equal(inForLine(u, new Date(2026, 9, 12, 7, 0)), 'In for 0m', 'a clock behind never reads negative');
});

test('the cycle card line: what is in now, with how long', async () => {
  const { productsLine } = await import('./periodProducts');
  const uses = startUse([], { id: 'a', product: 'Tampon', size: 'Super', at: at(8) });
  assert.equal(productsLine(uses, at(1), new Date(2026, 9, 12, 10, 10)), 'Super tampon in, for 2h 10m');
});

test('the cycle card line: this period so far, when nothing is in', async () => {
  const { productsLine } = await import('./periodProducts');
  let uses: ProductUse[] = [];
  uses = startUse(uses, { id: 'a', product: 'Tampon', size: 'Super', at: at(8) });
  uses = startUse(uses, { id: 'b', product: 'Tampon', size: 'Super', at: at(12) });
  uses = startUse(uses, { id: 'c', product: 'Pad', size: 'Overnight', at: at(22) });
  uses = endUse(uses, { at: at(23), fullness: null });
  assert.equal(productsLine(uses, at(0), new Date(2026, 9, 12, 23, 30)), 'This period: 3 changes, mostly Super tampon');
  // Uses from before this period started are not this period's.
  assert.equal(productsLine(uses, at(13), new Date(2026, 9, 12, 23, 30)), 'This period: 1 change, mostly Overnight pad');
});

test('no products logged means no line at all', async () => {
  const { productsLine } = await import('./periodProducts');
  assert.equal(productsLine([], at(0), new Date(2026, 9, 12, 12)), null);
});

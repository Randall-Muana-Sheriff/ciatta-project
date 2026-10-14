import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GLOWS, glowAt } from './glow';
import { contrast } from './scheme';

test('there are enough glows that cards on a screen differ', () => {
  assert.ok(GLOWS.length >= 8);
  assert.equal(new Set(GLOWS.map((g) => g.join())).size, GLOWS.length);
});

test('every glow is light at the top and dark at the foot', () => {
  for (const g of GLOWS) {
    assert.ok(contrast(glowAt(g, 0), '#000000') > contrast(glowAt(g, 1), '#000000'), g.join());
  }
});

test('card type reads on the brightest part of every glow', () => {
  for (const g of GLOWS) {
    const top = glowAt(g, 0);
    assert.ok(contrast('#FFFFFF', top) >= 7, `ink on ${g}`);
    assert.ok(contrast('#D2D5DA', top) >= 5, `body on ${g}`);
    assert.ok(contrast('#A9AEB5', top) >= 4.5, `meta on ${g}`);
  }
});

test('the colour sits in the top fifth; the rest is the dark shade', () => {
  for (const g of GLOWS) {
    const dark = contrast(glowAt(g, 1), '#000000');
    assert.ok(contrast(glowAt(g, 0.2), '#000000') > dark, `still lit at a fifth: ${g}`);
    for (const t of [0.4, 0.6, 0.8]) assert.ok(contrast(glowAt(g, t), '#000000') - dark < 0.15, `dark by ${t}: ${g}`);
  }
});

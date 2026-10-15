// Apple's Human Interface Guidelines ask for text that stays legible in
// every appearance: at least 4.5:1 against what it sits on (7:1 is the
// stronger target), in Light, Dark and when the phone decides. These pin
// each text colour against its surface in both modes, and the chat's paper.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOOT } from './glow';
import { PAPER } from './paper';
import { contrast, PALETTES } from './scheme';

const AA = 4.5;

for (const mode of ['light', 'dark'] as const) {
  const p = PALETTES[mode];
  test(`${mode}: type on the ground reads at 4.5:1 or better`, () => {
    for (const k of ['ink', 'body', 'meta'] as const) {
      const r = contrast(p.G[k], p.G.mid);
      assert.ok(r >= AA, `${mode} G.${k} on ground ${r.toFixed(2)}`);
    }
  });
  test(`${mode}: type on a card reads at 4.5:1 or better`, () => {
    for (const k of ['ink', 'body', 'meta'] as const) {
      const r = contrast(p.L[k], FOOT);
      assert.ok(r >= AA, `${mode} L.${k} on card ${r.toFixed(2)}`);
    }
  });
  test(`${mode}: type on the plain surface (lists, menus) reads at 4.5:1 or better`, () => {
    for (const k of ['ink', 'body', 'meta'] as const) {
      const r = contrast(p.G[k], p.G.card);
      assert.ok(r >= AA, `${mode} G.${k} on G.card ${r.toFixed(2)}`);
    }
  });
  test(`${mode}: a pill's label reads on the pill`, () => {
    assert.ok(contrast(p.G.onPill, p.G.pill) >= AA);
  });
}

test('the chat paper: type reads at 4.5:1 or better on white', () => {
  for (const k of ['ink', 'body', 'meta'] as const) {
    const r = contrast(PAPER[k], PAPER.bg);
    assert.ok(r >= AA, `paper ${k} ${r.toFixed(2)}`);
  }
  assert.ok(contrast(PAPER.onPill, PAPER.pill) >= AA);
});

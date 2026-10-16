// Apple's Human Interface Guidelines ask for text that stays legible in
// every appearance: at least 4.5:1 against what it sits on (7:1 is the
// stronger target), in Light, Dark and when the phone decides. These pin
// each text colour against its surface in both modes, and the chat's paper.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOOT, LIGHT_FOOT, LIGHT_TOP, mix } from './glow';
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
  test(`${mode}: type on a card reads at 4.5:1 or better, at its foot and under its tinted top`, () => {
    // A light card is #F6F5F2 with its hue at the top; a dark one fades to
    // near black. Checked against the foot and the strongest tint.
    const surfaces = mode === 'light' ? [LIGHT_FOOT, ...['#486FE9', '#915ADB', '#CD4290', '#C7702A', '#CD9132', '#C52D1E'].map((h) => mix(h, LIGHT_FOOT, LIGHT_TOP))] : [FOOT];
    for (const k of ['ink', 'body', 'meta'] as const) {
      for (const bg of surfaces) {
        const r = contrast(p.L[k], bg);
        assert.ok(r >= AA, `${mode} L.${k} on card ${bg} ${r.toFixed(2)}`);
      }
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

test("Today's sky: type reads at 4.5:1 or better on the blue and on the white", () => {
  const p = PALETTES.light;
  for (const bg of ['#87CEFA', '#FFFFFF']) {
    for (const k of ['ink', 'body', 'meta'] as const) {
      const r = contrast(p.G[k], bg);
      assert.ok(r >= AA, `G.${k} on ${bg} ${r.toFixed(2)}`);
    }
  }
});

test('light: every accent colour reads at 3:1 or better on a light card, as graphics need', () => {
  for (const [k, v] of Object.entries(PALETTES.light.HUE)) {
    const r = contrast(v, LIGHT_FOOT);
    assert.ok(r >= 3, `HUE.${k} ${v} on light card ${r.toFixed(2)}`);
  }
});

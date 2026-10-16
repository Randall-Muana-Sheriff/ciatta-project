import assert from 'node:assert/strict';
import { test } from 'node:test';

import { C, M } from '../theme';
import { applyMode, contrast, G, onGround, PALETTES, resolveMode } from './scheme';
import { HUE, L } from './surface';

test('system follows the phone, and a choice overrides it', () => {
  assert.equal(resolveMode('system', 'light'), 'light');
  assert.equal(resolveMode('system', 'dark'), 'dark');
  assert.equal(resolveMode('system', null), 'dark');
  assert.equal(resolveMode('light', 'dark'), 'light');
  assert.equal(resolveMode('dark', 'light'), 'dark');
});

test('both palettes set every token the app reads', () => {
  for (const mode of ['light', 'dark'] as const) {
    const p = PALETTES[mode];
    assert.deepEqual(Object.keys(p.C).sort(), Object.keys(C).sort(), `${mode} C`);
    assert.deepEqual(Object.keys(p.L).sort(), Object.keys(L).sort(), `${mode} L`);
    assert.deepEqual(Object.keys(p.M).sort(), Object.keys(M).sort(), `${mode} M`);
    assert.deepEqual(Object.keys(p.HUE).sort(), Object.keys(HUE).sort(), `${mode} HUE`);
    assert.deepEqual(Object.keys(p.G).sort(), Object.keys(G).sort(), `${mode} G`);
  }
});

test('each mode is whole: light cards carry dark type, dark cards light', () => {
  const [d, l] = [PALETTES.dark, PALETTES.light];
  // The same accents, deepened on light so they read on a light card.
  assert.deepEqual(Object.keys(l.HUE).sort(), Object.keys(d.HUE).sort());
  assert.equal(l.L.ink, '#0C0E11');
  assert.equal(d.L.ink, '#FFFFFF');
  assert.ok(contrast(l.L.ink, l.L.glass) >= 12);
  const card = d.L.glass;
  assert.ok(contrast(d.L.ink, card) >= 12);
  assert.ok(contrast(d.L.body, card) >= 7);
  assert.ok(contrast(d.L.meta, card) >= 4.5);
  for (const [k, v] of Object.entries(d.HUE)) {
    if (k === 'attention' || k === 'uncertainty') continue; // marks only
    assert.ok(contrast(v, card) >= 4.5, k);
  }
});

test('type set straight on the ground clears contrast in both modes', () => {
  for (const mode of ['light', 'dark'] as const) {
    const g = PALETTES[mode].G;
    assert.ok(contrast(g.ink, g.mid) >= 12, `${mode} ink`);
    assert.ok(contrast(g.body, g.mid) >= 7, `${mode} body`);
    assert.ok(contrast(g.meta, g.mid) >= 4.5, `${mode} meta`);
    assert.ok(contrast(g.onPill, g.pill) >= 12, `${mode} pill`);
  }
  assert.equal(PALETTES.light.G.ink, '#0C0E11');
});

test('applying a mode moves every token at once', () => {
  applyMode('light');
  assert.equal(L.ink, PALETTES.light.L.ink);
  assert.equal(C.bg, PALETTES.light.C.bg);
  assert.equal(HUE.measured, PALETTES.light.HUE.measured);
  assert.equal(G.mode, 'light');
  applyMode('dark');
  assert.equal(L.ink, '#FFFFFF');
  assert.equal(G.mode, 'dark');
});

test('metric colours stay visible as marks in both modes', async () => {
  const { metricHues } = await import('./metricHue');
  for (const mode of ['light', 'dark'] as const) {
    for (const [k, v] of Object.entries(metricHues(mode))) {
      assert.ok(contrast(v, mode === 'light' ? PALETTES.light.G.mid : PALETTES.dark.L.glass) >= 3, `${mode} ${k}`);
    }
  }
});

test('a mark colour is deepened on light until it reads, and left alone on dark', () => {
  applyMode('dark');
  assert.equal(onGround('#E8C46A'), '#E8C46A');
  applyMode('light');
  assert.equal(onGround('#E8C46A'), '#E8C46A');
  for (const c of ['#E8C46A', '#9BD36A', '#F2A4B8', '#5ED3C4', '#3E50C8']) {
    const d = onGround(c, true);
    assert.ok(contrast(d, G.foot) >= 3, `${c} -> ${d}`);
    assert.match(d, /^#[0-9A-F]{6}$/);
  }
  assert.equal(onGround('#3E50C8', true), '#3E50C8');
  applyMode('dark');
});

test('every photo in the card pool is on disk, and there are enough for a screen', async () => {
  const { existsSync } = await import('node:fs');
  const names = Array.from({ length: 16 }, (_, n) => String(n).padStart(2, '0'));
  for (const n of names) assert.ok(existsSync(new URL(`../../assets/images/cards/${n}.jpg`, import.meta.url)), n);
});

test('the grounds are flat: #161616 on dark, #F1F0ED on light', () => {
  assert.equal(PALETTES.dark.G.mid, '#161616');
  assert.equal(PALETTES.light.G.mid, '#F1F0ED');
  assert.equal(PALETTES.dark.L.canvas, '#161616');
});

test('lists, rows and the text box follow the mode, and their type reads on them', () => {
  assert.equal(PALETTES.light.G.card, '#FFFFFF');
  for (const mode of ['light', 'dark'] as const) {
    const g = PALETTES[mode].G;
    assert.ok(contrast(g.ink, g.card) >= 12, `${mode} ink on card`);
    assert.ok(contrast(g.body, g.card) >= 7, `${mode} body on card`);
    assert.ok(contrast(g.meta, g.card) >= 4.5, `${mode} meta on card`);
  }
});

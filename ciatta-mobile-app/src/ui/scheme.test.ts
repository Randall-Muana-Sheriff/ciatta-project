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

test('type clears contrast on its ground in both modes', () => {
  for (const mode of ['light', 'dark'] as const) {
    const { L: l, HUE: hue, G: g } = PALETTES[mode];
    for (const ground of [g.top, g.mid, g.foot]) {
      assert.ok(contrast(l.ink, ground) >= 12, `${mode} ink on ${ground}`);
      assert.ok(contrast(l.body, ground) >= 7, `${mode} body on ${ground}`);
      assert.ok(contrast(l.meta, ground) >= 4.5, `${mode} meta on ${ground}`);
      assert.ok(contrast(l.onPill, l.pill) >= 12, `${mode} pill`);
      for (const [k, v] of Object.entries(hue)) {
        if (k === 'attention' || k === 'uncertainty') continue; // marks only
        assert.ok(contrast(v, ground) >= 4.5, `${mode} ${k} on ${ground}`);
      }
    }
  }
});

test('dark is moodier than it was', () => {
  const g = PALETTES.dark.G;
  assert.ok(contrast('#FFFFFF', g.mid) > contrast('#FFFFFF', '#0C0E11'));
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
      assert.ok(contrast(v, PALETTES[mode].G.mid) >= 3, `${mode} ${k}`);
    }
  }
});

test('a mark colour is deepened on light until it reads, and left alone on dark', () => {
  applyMode('dark');
  assert.equal(onGround('#E8C46A'), '#E8C46A');
  applyMode('light');
  for (const c of ['#E8C46A', '#9BD36A', '#F2A4B8', '#5ED3C4', '#3E50C8']) {
    const d = onGround(c);
    assert.ok(contrast(d, G.foot) >= 3, `${c} -> ${d}`);
    assert.match(d, /^#[0-9A-F]{6}$/);
  }
  assert.equal(onGround('#3E50C8'), '#3E50C8');
  applyMode('dark');
});

test('every screen ground has a black and a white rendering on disk', async () => {
  const { existsSync } = await import('node:fs');
  for (const pair of ['measured-timeDepth', 'reported-change', 'timeDepth-measured', 'timeDepth-reported']) {
    for (const mode of ['dark', 'light']) {
      assert.ok(existsSync(new URL(`../../assets/images/grounds/${pair}-${mode}.jpg`, import.meta.url)), `${pair} ${mode}`);
    }
  }
});

test('with Liquid Glass a card adds no fill of its own', () => {
  applyMode('dark', true);
  assert.equal(L.glass, 'transparent');
  applyMode('dark');
  assert.equal(L.glass, PALETTES.dark.L.recessed);
});

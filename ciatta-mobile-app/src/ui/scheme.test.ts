import assert from 'node:assert/strict';
import { test } from 'node:test';

import { C, M } from '../theme';
import { applyMode, contrast, G, PALETTES, resolveMode } from './scheme';
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

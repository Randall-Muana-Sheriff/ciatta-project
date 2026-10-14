import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// The typechecker accepts some old Lucide names as aliases that Metro then
// cannot find, so check every glyph Ciatta imports really exists.
test('every Lucide glyph the icon set imports exists in the package', () => {
  const src = readFileSync(new URL('./icons.tsx', import.meta.url), 'utf8');
  const paths = [...src.matchAll(/'lucide-react-native\/icons\/([a-z0-9-]+)'/g)].map((m) => m[1]);
  assert.ok(paths.length > 50);
  const missing = paths.filter((p) => !existsSync(new URL(`../../node_modules/lucide-react-native/dist/esm/icons/${p}.mjs`, import.meta.url)));
  assert.deepEqual(missing, []);
});

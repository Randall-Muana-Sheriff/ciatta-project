// Refreshes the provider directory the app searches.
//
// Reads Epic's Brands bundle (every health system on Epic, with each of its
// hospitals and clinics and their addresses), keeps only what choosing one
// needs, and writes it to assets/providers/epic-brands.dir. The bundle is
// about ninety six megabytes; what is written is about six, and the app
// carries it so the search works offline and on the first keystroke.
//
//   npm run directory:refresh
//
// Epic updates the bundle monthly. Run this before a release.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { compactBrands, parseCompact } from '../src/lib/providers/brandsDirectory';

const SOURCE = 'https://open.epic.com/Endpoints/Brands';
const OUT = join(__dirname, '..', 'assets', 'providers', 'epic-brands.dir');

async function main() {
  const res = await fetch(SOURCE, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Epic Brands bundle: HTTP ${res.status}`);
  const text = compactBrands(await res.json());
  const rows = parseCompact(text);
  // A refresh that lost most of the directory is a broken download, not
  // a smaller world. Refuse it rather than ship it.
  if (rows.length < 10000) throw new Error(`Only ${rows.length} rows parsed; keeping the existing file.`);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  const systems = rows.filter((r) => !r.organization).length;
  console.log(`${systems} health systems, ${rows.length - systems} facilities, ${(text.length / 1e6).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

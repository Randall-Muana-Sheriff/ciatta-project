// VoiceOver, enforced: every Pressable in the app says what it is (a
// role), and one that shows no words says what it does (a label). The
// Human Interface Guidelines ask that every control be reachable and named
// for people using VoiceOver; a control added later without either fails
// here, by file and line.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

// The opening tag, read past braces and strings, so an arrow's => inside a
// prop does not end it.
function openTag(s: string, i: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return s.slice(i, j);
  }
  return s.slice(i);
}

function element(s: string, i: number): string {
  let depth = 0;
  const re = /<Pressable\b|<\/Pressable>/g;
  re.lastIndex = i;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    depth += m[0] === '</Pressable>' ? -1 : 1;
    if (depth === 0) return s.slice(i, m.index + m[0].length);
  }
  return s.slice(i, i + 400);
}

const where = (f: string, s: string, i: number) => `${f.replace(SRC, 'src')}:${s.slice(0, i).split('\n').length}`;

test('every Pressable has an accessibility role', () => {
  const missing: string[] = [];
  for (const f of files(SRC)) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<Pressable\b/g)) if (!openTag(s, m.index!).includes('accessibilityRole')) missing.push(where(f, s, m.index!));
  }
  assert.deepEqual(missing, []);
});

test('a Pressable that shows no words has an accessibility label', () => {
  const missing: string[] = [];
  for (const f of files(SRC)) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<Pressable\b/g)) {
      const el = element(s, m.index!);
      if (openTag(s, m.index!).includes('accessibilityLabel')) continue;
      if (/<Text\b|\blabel=|<(InsightCard|MetricCard|TopicTile|EndpointRow|Bullet)\b/.test(el)) continue;
      missing.push(where(f, s, m.index!));
    }
  }
  assert.deepEqual(missing, []);
});

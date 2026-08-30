import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { assessSafety } from './safety.ts';

Deno.test('assessSafety: sleep domain defaults to minimal risk', () => {
  assertEquals(assessSafety('sleep', 'Your sleep has been close to your usual.', ['diagnosis']), 'minimal');
});

Deno.test('assessSafety: cycle/mood domains default to manageable risk', () => {
  assertEquals(assessSafety('cycle', 'A statement about your cycle.', ['diagnosis']), 'manageable');
  assertEquals(assessSafety('mood', 'A statement about your mood.', ['diagnosis']), 'manageable');
});

Deno.test('assessSafety: a statement using prohibited language is always unacceptable, regardless of domain', () => {
  assertEquals(
    assessSafety('sleep', 'This may indicate a sleep disorder.', ['disorder']),
    'unacceptable'
  );
});

Deno.test('assessSafety: prohibited-language check is case-insensitive', () => {
  assertEquals(
    assessSafety('sleep', 'This could be a DIAGNOSIS worth noting.', ['diagnosis']),
    'unacceptable'
  );
});

Deno.test('assessSafety: unknown domain falls back to manageable, not minimal', () => {
  assertEquals(assessSafety('some-future-domain', 'A statement.', []), 'manageable');
});

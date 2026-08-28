import { assertEquals } from 'jsr:@std/assert@1';
import {
  changeFromNotableRate,
  readingsEvidenceSummary,
} from './understandingFacets.ts';

Deno.test('readingsEvidenceSummary names the count without inventing a pattern', () => {
  assertEquals(
    readingsEvidenceSummary(0, 'emerging'),
    "There isn't a reading on this yet. Ciatta will look as more arrives."
  );
  assertEquals(
    readingsEvidenceSummary(3, 'emerging'),
    'Ciatta has 3 readings to work with. That is not enough yet to see a clear pattern.'
  );
  assertEquals(
    readingsEvidenceSummary(18, 'strong'),
    'This is grounded in 18 readings Ciatta has already seen.'
  );
});

Deno.test('changeFromNotableRate stays silent below a real share of unusual days', () => {
  assertEquals(changeFromNotableRate(0), { changeDetected: false, changeSummary: null });
  assertEquals(changeFromNotableRate(0.04), { changeDetected: false, changeSummary: null });
  assertEquals(changeFromNotableRate(0.2).changeDetected, true);
  assertEquals(
    changeFromNotableRate(0.2).changeSummary,
    'About 20% of recent days sit apart from your usual baseline.'
  );
});

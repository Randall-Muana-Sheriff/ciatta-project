import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  evaluatePattern,
  patternConfidence,
  PATTERN_MIN_RECURRING_WINDOWS,
  PATTERN_CONFIDENCE_RECURRENCE_CAP,
} from './patternEvaluation.ts';
import type { RelationshipInstance } from './patternEvaluation.ts';
import { CONFIDENCE_LABEL } from './decay.ts';

Deno.test('evaluatePattern: two variables correlating once does NOT qualify', () => {
  const instances: RelationshipInstance[] = [{ windowLabel: '2026-06', confirms: true }];
  const result = evaluatePattern(instances, true);
  assertEquals(result.qualifies, false);
  assertEquals(result.recurrenceCount, 1);
});

Deno.test('evaluatePattern: below-threshold recurrence never qualifies even with a ruled-out alternative', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
  ];
  assertEquals(instances.filter((i) => i.confirms).length, PATTERN_MIN_RECURRING_WINDOWS - 1);
  const result = evaluatePattern(instances, true);
  assertEquals(result.qualifies, false);
});

Deno.test('evaluatePattern: at-threshold recurrence with alternative explanation NOT ruled out does not qualify', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, false);
  assertEquals(result.qualifies, false);
  assertEquals(result.alternativeExplanationRuledOut, false);
});

Deno.test('evaluatePattern: qualifies when recurrence, stability, and alternative-explanation checks all pass', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, true);
  assertEquals(result.qualifies, true);
  assertEquals(result.recurrenceCount, 4);
  assertEquals(result.stableUnderRemoval, true);
  assertEquals(result.windowCountRequired, PATTERN_MIN_RECURRING_WINDOWS);
});

Deno.test('evaluatePattern: non-confirming instances do not count toward recurrence', () => {
  // 5 windows, only 4 confirm -> recurrenceCount must be 4, not 5 (the
  // non-confirming window is excluded from the count entirely, not
  // counted as a weaker confirmation). 4 confirming instances is also
  // this evaluator's true qualifying minimum (see the stability-under-
  // removal test above and PATTERN_MIN_RECURRING_WINDOWS's own doc
  // comment: 3 recurrences plus one to spare for the removal check).
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-04', confirms: true },
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: false },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, true);
  assertEquals(result.recurrenceCount, 4);
  assertEquals(result.qualifies, true);
});

Deno.test('evaluatePattern: exactly at the recurrence minimum still fails stability-under-removal', () => {
  const instances: RelationshipInstance[] = [
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: true },
    { windowLabel: '2026-08', confirms: true },
  ];
  const result = evaluatePattern(instances, true);
  assertEquals(result.recurrenceCount, PATTERN_MIN_RECURRING_WINDOWS);
  assertEquals(result.stableUnderRemoval, false);
  assertEquals(result.qualifies, false);
});

Deno.test('patternConfidence: scales toward higher confidence as recurrence grows past the qualifying minimum', () => {
  const atMinimum = patternConfidence(4); // the true qualifying minimum
  const doubled = patternConfidence(8); // PATTERN_CONFIDENCE_RECURRENCE_CAP
  assertEquals(atMinimum.value, 0.5); // min(1, 4/8)=0.5
  assertEquals(atMinimum.tier, 'moderate'); // 0.5 -> <0.6 -> moderate
  assertEquals(doubled.value, 1); // min(1, 8/8)=1.0
  assertEquals(doubled.tier, 'very-strong'); // 1.0 -> very-strong
  assertEquals(doubled.label, 'very confident');
});

Deno.test('patternConfidence: value, tier, and label always agree -- one calculation, never two independent copies', () => {
  // Exercises every tier boundary the qualifying-Pattern range (>=4) can
  // actually reach, confirming there is no recurrenceCount at which the
  // stored numeric and its label could silently diverge.
  for (const recurrenceCount of [4, 5, 6, 7, 8, 12]) {
    const result = patternConfidence(recurrenceCount);
    assertEquals(result.value, Math.min(1, recurrenceCount / PATTERN_CONFIDENCE_RECURRENCE_CAP));
    assertEquals(result.label, CONFIDENCE_LABEL[result.tier]);
  }
});

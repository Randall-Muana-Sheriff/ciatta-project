import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { evaluateRetention, KNOWLEDGE_MIN_REPRODUCED_RUNS } from './ciattaKnowledge.ts';
import type { PriorFindingRun } from './ciattaKnowledge.ts';

Deno.test('evaluateRetention: a single strong Finding alone is not enough to retain', () => {
  const result = evaluateRetention('strong', []);
  assertEquals(result.reproducedRuns, 1);
  assertEquals(result.shouldRetain, false);
});

Deno.test('evaluateRetention: retains once reproduced across the required number of runs', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'strong', statement: 'x', contradicted: false },
  ];
  const result = evaluateRetention('strong', priorRuns);
  assertEquals(result.reproducedRuns, KNOWLEDGE_MIN_REPRODUCED_RUNS);
  assertEquals(result.shouldRetain, true);
});

Deno.test('evaluateRetention: a contradicted prior run does not count toward reproduction', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'strong', statement: 'x', contradicted: true },
  ];
  const result = evaluateRetention('strong', priorRuns);
  assertEquals(result.reproducedRuns, 1);
  assertEquals(result.shouldRetain, false);
});

Deno.test('evaluateRetention: a weak (moderate/emerging) prior run does not count toward reproduction', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'moderate', statement: 'x', contradicted: false },
  ];
  const result = evaluateRetention('strong', priorRuns);
  assertEquals(result.reproducedRuns, 1);
  assertEquals(result.shouldRetain, false);
});

Deno.test('evaluateRetention: a weak current confidence never retains regardless of prior runs', () => {
  const priorRuns: PriorFindingRun[] = [
    { confidenceTier: 'strong', statement: 'x', contradicted: false },
    { confidenceTier: 'strong', statement: 'x', contradicted: false },
  ];
  const result = evaluateRetention('moderate', priorRuns);
  assertEquals(result.reproducedRuns, 2);
  assertEquals(result.shouldRetain, false);
});

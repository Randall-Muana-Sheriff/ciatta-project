import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  changeFromNotableCount,
  countShareCopy,
  cycleStance,
  evidenceSummary,
  outcomeForStance,
  qualitativeConfidenceFill,
  strengthForEvidenceQuality,
  strengthForStance,
  volumeStance,
} from './intelligenceIntegrity.ts';
import { analyzeSleep, buildSleepUnderstanding } from './sleepAnalysis.ts';
import { analyzeSteps, buildStepsUnderstanding } from './stepsAnalysis.ts';
import { analyzeMood, buildMoodUnderstanding } from './moodAnalysis.ts';
import { analyzeCycles, buildUnderstanding, detectCycles } from './cycleAnalysis.ts';
import { deriveGuidance } from './careGuidance.ts';
import { buildCrossDomainDraft } from './crossDomainSynthesis.ts';

Deno.test('confidence follows evidence quality, not how notable a dip is', () => {
  assertEquals(strengthForEvidenceQuality(1), 'very-strong');
  assertEquals(strengthForStance(1, 'steady'), 'very-strong');
  assertEquals(strengthForStance(1, 'changing'), 'very-strong');
  assertEquals(strengthForStance(0.9, 'early'), 'emerging');
  assertEquals(strengthForStance(0.9, 'mixed'), 'moderate');
});

Deno.test('unsupported percents are not used for shares or change', () => {
  assertEquals(countShareCopy(0, 20, 'night'), 'None of these 20 nights sat apart from your usual.');
  assertEquals(countShareCopy(4, 20, 'night'), '4 of 20 nights');
  assertEquals(changeFromNotableCount(0, 20, 'night'), { changeDetected: false, changeSummary: null });
  assertEquals(changeFromNotableCount(1, 30, 'night'), { changeDetected: false, changeSummary: null });
  assertEquals(
    changeFromNotableCount(6, 20, 'night').changeSummary,
    '6 of 20 nights sat apart from your usual.'
  );
  assertEquals((changeFromNotableCount(6, 20, 'night').changeSummary ?? '').includes('%'), false);
});

Deno.test('user reported check ins stay distinct from device readings', () => {
  assertEquals(
    evidenceSummary(12, 'strong', 'checkin'),
    'This is grounded in 12 check ins you reported.'
  );
  assertEquals(
    evidenceSummary(12, 'strong', 'device'),
    'This is grounded in 12 readings Ciatta has already seen.'
  );
  assertEquals(
    evidenceSummary(1, 'emerging', 'context'),
    'This comes from what you shared, not a device measurement.'
  );
});

Deno.test('early, mixed, steady, and changing stances are honest', () => {
  assertEquals(volumeStance({ sampleCount: 6, minSample: 14, notableCount: 2 }), 'early');
  assertEquals(volumeStance({ sampleCount: 30, minSample: 14, notableCount: 0 }), 'steady');
  assertEquals(volumeStance({ sampleCount: 30, minSample: 14, notableCount: 8 }), 'changing');
  assertEquals(
    cycleStance({
      cyclesDetected: 4,
      cyclesWithSufficientData: 4,
      cyclesConfirming: 1,
      minCycles: 3,
    }),
    'mixed'
  );
  assertEquals(outcomeForStance('steady', 'very-strong'), 'reassure');
  assertEquals(outcomeForStance('changing', 'strong'), 'consider');
  assertEquals(outcomeForStance('changing', 'emerging'), 'understand');
  assertEquals(outcomeForStance('mixed', 'moderate'), 'watch');
  assertEquals(outcomeForStance('early', 'emerging'), 'none');
});

Deno.test('sleep early state names nights without inventing a usual night', () => {
  const sleep = Array.from({ length: 8 }, (_, i) => ({
    id: `s-${i}`,
    type: 'sleep_session' as const,
    startTime: new Date(Date.UTC(2025, 5, i, 23)).toISOString(),
    endTime: new Date(Date.UTC(2025, 5, i + 1, 6, 30)).toISOString(),
    durationMinutes: 450,
  }));
  const result = analyzeSleep(sleep);
  const draft = buildSleepUnderstanding(result);
  assertEquals(result.eligible, false);
  assert(draft !== null);
  assertEquals(draft!.stance, 'early');
  assertEquals(draft!.strength, 'emerging');
  assertEquals(draft!.narrative.includes('%'), false);
  assertEquals(draft!.narrative.toLowerCase().includes('average'), false);
  assert(draft!.narrative.includes('8 nights'));
});

Deno.test('steady activity volume can be confident without a performance score', () => {
  const steps = Array.from({ length: 30 }, (_, i) => ({
    id: `st-${i}`,
    recordedAt: new Date(Date.UTC(2025, 5, i, 20)).toISOString(),
    count: 8000,
  }));
  const result = analyzeSteps(steps);
  const draft = buildStepsUnderstanding(result);
  assertEquals(result.eligible, true);
  assertEquals(result.lowActivityDays, 0);
  assert(draft !== null);
  assertEquals(draft!.stance, 'steady');
  assertEquals(draft!.strength, 'very-strong');
  assertEquals(draft!.confidenceLabel, 'very confident');
  assertEquals(draft!.narrative.includes('%'), false);
  assertEquals(draft!.changeDetected, false);
  assert(draft!.narrative.toLowerCase().includes('close to that'));
});

Deno.test('mood check ins never use a 0% score', () => {
  const obs = Array.from({ length: 15 }, (_, i) => ({
    id: `m-${i}`,
    recordedAt: new Date(2025, 5, i).toISOString(),
    rating: 3,
  }));
  const result = analyzeMood(obs);
  const draft = buildMoodUnderstanding(result);
  assertEquals(result.lowMoodCount, 0);
  assert(draft !== null);
  assertEquals(draft!.evidenceSignal, 'mood_rating');
  assertEquals(draft!.narrative.includes('%'), false);
  assert(draft!.evidenceSummary.toLowerCase().includes('check ins'));
  assert(draft!.narrative.toLowerCase().includes('not rated your mood as low'));
});

Deno.test('cycle mixed and early states write an understanding instead of silence', () => {
  const flow = [
    { id: 'f1', recordedAt: '2025-08-01T08:00:00Z', cycleStart: true },
    { id: 'f2', recordedAt: '2025-08-29T08:00:00Z', cycleStart: true },
    { id: 'f3', recordedAt: '2025-09-26T08:00:00Z', cycleStart: true },
  ];
  const rhr = Array.from({ length: 56 }, (_, i) => ({
    id: `r-${i}`,
    recordedAt: new Date(Date.UTC(2025, 7, 1 + i, 8)).toISOString(),
    bpm: 60,
  }));
  const early = analyzeCycles(detectCycles(flow), rhr);
  const earlyDraft = buildUnderstanding(early);
  assertEquals(early.eligible, false);
  assert(earlyDraft !== null);
  assertEquals(earlyDraft!.stance, 'early');
  assertEquals(earlyDraft!.narrative.toLowerCase().includes('not enough'), true);
  assertEquals(earlyDraft!.narrative.includes('bpm higher'), false);
});

Deno.test('guidance outcomes stay optional and non causal', () => {
  const NOW = new Date('2026-08-19T00:00:00Z');
  const evidence = { observationsCount: 42, learningSince: '2026-07-29' };
  assertEquals(deriveGuidance('sleep', 'strong', null, evidence, NOW, { stance: 'early' }).guidance, null);
  const steady = deriveGuidance('recovery', 'very-strong', null, evidence, NOW, {
    stance: 'steady',
    clinicalConcern: false,
  });
  assert(steady.guidance !== null);
  assertEquals(steady.guidance!.toLowerCase().includes('consider'), false);
  assertEquals(steady.guidance!.toLowerCase().includes('easing up'), false);
  assertEquals(steady.careRecommendationType, null);
  assert(steady.guidance!.toLowerCase().includes('nothing here asks for a change'));

  const watch = deriveGuidance('sleep', 'moderate', null, evidence, NOW, { stance: 'mixed' });
  assert(watch.guidance !== null);
  assertEquals(watch.guidance!.toLowerCase().includes('watching'), true);
  assertEquals(watch.careRecommendationType, null);

  const consider = deriveGuidance('cycle', 'strong', null, evidence, NOW, { stance: 'changing' });
  assert(consider.guidance !== null);
  assertEquals(consider.careRecommendationType, 'ob-gyn');

  const understand = deriveGuidance('recovery', 'emerging', null, evidence, NOW, { stance: 'changing' });
  assert(understand.guidance !== null);
  assertEquals(understand.guidance!.toLowerCase().includes('understand'), true);
  assertEquals(understand.careRecommendationType, null);
});

Deno.test('user reported context cannot be synthesized with device understanding', () => {
  const draft = buildCrossDomainDraft(
    { fromDomain: 'sleep', toDomain: 'mood', strength: 'strong' },
    {
      id: 'u-sleep',
      domain: 'sleep',
      strength: 'strong',
      evidenceType: 'health_data',
      learningSince: '2026-06-01',
      observationsCount: 40,
    },
    {
      id: 'u-mood',
      domain: 'mood',
      strength: 'strong',
      evidenceType: 'user_reported',
      learningSince: '2026-06-01',
      observationsCount: 20,
    }
  );
  assertEquals(draft, null);
});

Deno.test('confidence fill is qualitative, never a raw score percent', () => {
  assertEquals(qualitativeConfidenceFill('still learning'), 22);
  assertEquals(qualitativeConfidenceFill('fairly confident'), 50);
  assertEquals(qualitativeConfidenceFill('confident'), 72);
  assertEquals(qualitativeConfidenceFill('very confident'), 90);
});

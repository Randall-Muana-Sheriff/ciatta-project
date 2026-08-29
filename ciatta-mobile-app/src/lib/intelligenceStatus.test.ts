import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  coreStatusLabel,
  intelligenceSurfaces,
  presentPersistedUnderstanding,
  todayHeadline,
  type IntelligenceUnderstanding,
} from './intelligenceStatus.ts';
import { composeWhyLayer, whyAvailable } from './whyLayer.ts';
import { isEligibleCareConnection } from './careConnection.ts';

const recoveryVolume: IntelligenceUnderstanding = {
  id: 'u-recovery',
  domain: 'recovery',
  strength: 'moderate',
  narrative: 'You average about 8,412 steps a day. Recent days have been sitting close to that.',
  seeing: 'You average about 8,412 steps a day. Recent days have been sitting close to that.',
  observations_count: 26,
  confidence_label: 'fairly confident',
  learning_since: '2026-07-01',
  first_observed: '2026-07-01',
  last_updated: '2026-08-28T12:00:00.000Z',
  still_learning: [],
  guidance:
    "We've been learning your recovery patterns over the past several weeks. Consider prioritizing recovery and easing up where you can and tracking whether the pattern continues.",
  care_recommendation_type: null,
  care_recommendation_reason: null,
  evidence_summary: 'This is grounded in 26 readings Ciatta has already seen.',
  baseline_summary: 'Your usual day is about 8,412 steps.',
  change_summary: null,
  related_domains: [],
};

Deno.test('Today, Core, and Why share one persisted status and cannot contradict it', () => {
  const surfaces = intelligenceSurfaces({
    featured: recoveryVolume,
    todayNarrative: recoveryVolume.narrative,
    todayPriority: null,
    understandings: [recoveryVolume],
    relationships: [],
    crossDomain: [],
    history: [
      {
        understanding_id: recoveryVolume.id,
        event_date: '2026-07-01',
        label: 'A pattern in how much you move day to day started to show.',
      },
    ],
    candidates: [],
  });

  assertEquals(surfaces.today.status, recoveryVolume.confidence_label);
  assertEquals(surfaces.core.status, recoveryVolume.confidence_label);
  assertEquals(surfaces.today.strength, recoveryVolume.strength);
  assertEquals(surfaces.core.strength, recoveryVolume.strength);
  assertEquals(surfaces.today.narrative, recoveryVolume.narrative);
  assertEquals(surfaces.today.status.includes('Very strong'), false);
  assertEquals(surfaces.core.status.includes('Very strong'), false);
  assertEquals(todayHeadline('Recovery', recoveryVolume.strength).includes('taking shape'), true);
});

Deno.test('Very strong only appears when persisted strength is very-strong', () => {
  assertEquals(coreStatusLabel({ strength: 'moderate', confidence_label: 'fairly confident' }).includes('Very strong'), false);
  assertEquals(coreStatusLabel({ strength: 'strong', confidence_label: 'confident' }).includes('Very strong'), false);
  const very = coreStatusLabel({ strength: 'very-strong', confidence_label: 'very confident' });
  assertEquals(very, 'very confident');
});

Deno.test('Why adds history and never repeats the Today narrative', () => {
  const historyLabel = 'A pattern in how much you move day to day started to show.';
  const layer = composeWhyLayer({
    featured: recoveryVolume,
    todayNarrative: recoveryVolume.narrative,
    todayPriority: null,
    understandings: [recoveryVolume],
    relationships: [],
    crossDomain: [],
    history: [
      { understanding_id: recoveryVolume.id, event_date: '2026-07-01', label: historyLabel },
    ],
    candidates: [],
  });
  assert(layer.mattering === historyLabel || layer.history.includes(historyLabel));
  assertEquals((layer.mattering ?? '').includes('8,412 steps'), false);
  assertEquals(layer.related.some((r) => r.text.includes('8,412 steps')), false);
  assertEquals((layer.watching ?? '').includes('8,412 steps'), false);
});

Deno.test('Why is available from history even when Today already holds the narrative', () => {
  assertEquals(
    whyAvailable({
      featured: recoveryVolume,
      todayNarrative: recoveryVolume.narrative,
      todayPriority: null,
      understandings: [recoveryVolume],
      relationships: [],
      crossDomain: [],
      history: [
        {
          understanding_id: recoveryVolume.id,
          event_date: '2026-07-01',
          label: 'A pattern in how much you move day to day started to show.',
        },
      ],
    }),
    true
  );
});

Deno.test('guidance on Today is the engine field, never a client invented target', () => {
  const surfaces = intelligenceSurfaces({
    featured: recoveryVolume,
    todayNarrative: recoveryVolume.seeing ?? recoveryVolume.narrative,
    todayPriority: {
      text: recoveryVolume.guidance ?? '',
      measured: true,
    },
    understandings: [recoveryVolume],
    relationships: [],
    crossDomain: [],
    history: [],
    candidates: [],
  });
  assertEquals(surfaces.today.narrative, recoveryVolume.seeing);
  assertEquals((surfaces.why.evidence ?? '').includes('About 0%'), false);
  assertEquals(surfaces.why.evidence?.includes('26 readings'), true);
  assertEquals(surfaces.why.evidence?.includes('8,412 steps'), true);
});

Deno.test('care connection stays off when recovery guidance has no clinical fields', () => {
  assertEquals(isEligibleCareConnection(recoveryVolume), false);
});

Deno.test('client presents persisted Recovery strength as stored, without rewriting it', () => {
  const presented = presentPersistedUnderstanding({
    ...recoveryVolume,
    strength: 'very-strong' as const,
    confidence_label: 'very confident',
    guidance:
      "We've been learning your recovery patterns over the past several weeks. Consider prioritizing recovery and easing up where you can and tracking whether the pattern continues. This is a consistent pattern in your recovery. If it continues, it may be worth discussing with your primary care provider.",
    care_recommendation_type: 'primary-care',
    care_recommendation_reason: 'General or unexplained changes are usually best started with primary care.',
  });
  assertEquals(presented.strength, 'very-strong');
  assertEquals(presented.confidence_label, 'very confident');
  assertEquals(presented.care_recommendation_type, 'primary-care');
});

Deno.test('presentPersistedUnderstanding does not throw on an empty narrative', () => {
  const presented = presentPersistedUnderstanding({
    ...recoveryVolume,
    narrative: '',
    confidence_label: null,
  });
  assertEquals(presented.confidence_label, 'fairly confident');
});

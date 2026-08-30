import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { selectForExperience } from './experienceSelection.ts';

Deno.test('selectForExperience: no finding at all -> no_finding', () => {
  assertEquals(
    selectForExperience({ hasFinding: false, confidenceTier: null, safetyTier: null, isMeaningfulChange: false }),
    'no_finding'
  );
});

Deno.test('selectForExperience: unacceptable or serious safety -> no_surfacing, regardless of confidence', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'very-strong',
      safetyTier: 'unacceptable',
      isMeaningfulChange: true,
    }),
    'no_surfacing'
  );
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'very-strong',
      safetyTier: 'serious',
      isMeaningfulChange: true,
    }),
    'no_surfacing'
  );
});

Deno.test('selectForExperience: no meaningful change -> no_surfacing even with high confidence and low risk', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'very-strong',
      safetyTier: 'minimal',
      isMeaningfulChange: false,
    }),
    'no_surfacing'
  );
});

Deno.test('selectForExperience: meaningful change but weak confidence -> no_notification', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'moderate',
      safetyTier: 'minimal',
      isMeaningfulChange: true,
    }),
    'no_notification'
  );
});

Deno.test('selectForExperience: meaningful change, strong confidence, safe -> surfaced', () => {
  assertEquals(
    selectForExperience({
      hasFinding: true,
      confidenceTier: 'strong',
      safetyTier: 'minimal',
      isMeaningfulChange: true,
    }),
    'surfaced'
  );
});

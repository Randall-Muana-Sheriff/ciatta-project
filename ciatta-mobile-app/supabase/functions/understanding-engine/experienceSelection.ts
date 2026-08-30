// Experience/Silence — the selection layer. Never reprocesses evidence:
// only ranks/filters what already cleared Confidence + Safety upstream.
// See spec §1.14, §2.6, §2.7. Returns exactly one of the four documented
// silence forms, or 'surfaced'. ('no_guidance' is a fifth, separate gate
// evaluated by careGuidance.ts's own ACTIONABLE check downstream of this
// -- not this function's concern.)
import type { Strength } from './cycleAnalysis.ts';
import type { SafetyTier } from './safety.ts';

export type ExperienceOutcome = 'surfaced' | 'no_finding' | 'no_surfacing' | 'no_notification';

const UNSAFE_TIERS: SafetyTier[] = ['unacceptable', 'serious'];
const NOTIFIABLE_CONFIDENCE: Strength[] = ['strong', 'very-strong'];

export interface ExperienceInput {
  hasFinding: boolean;
  confidenceTier: Strength | null;
  safetyTier: SafetyTier | null;
  isMeaningfulChange: boolean;
}

export function selectForExperience(input: ExperienceInput): ExperienceOutcome {
  if (!input.hasFinding || !input.confidenceTier || !input.safetyTier) return 'no_finding';
  if (UNSAFE_TIERS.includes(input.safetyTier)) return 'no_surfacing';
  if (!input.isMeaningfulChange) return 'no_surfacing';
  if (!NOTIFIABLE_CONFIDENCE.includes(input.confidenceTier)) return 'no_notification';
  return 'surfaced';
}

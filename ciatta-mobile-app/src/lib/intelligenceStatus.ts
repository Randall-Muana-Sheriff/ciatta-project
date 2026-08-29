import { displayCopy } from './displayCopy';
import type { Strength } from './types';
import { composeWhyLayer, type WhyLayer, type WhyLayerInput, type WhyUnderstanding } from './whyLayer';

export type IntelligenceUnderstanding = WhyUnderstanding & {
  guidance: string | null;
  care_recommendation_type: string | null;
  care_recommendation_reason: string | null;
};

const FALLBACK_STATUS: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

/**
 * Display-only sanitization of a persisted Understanding.
 * Does not rewrite strength, care, or guidance. Those belong to the engine.
 */
export function presentPersistedUnderstanding<T extends {
  domain: string;
  strength: Strength;
  narrative: string;
  seeing?: string | null;
  confidence_label: string | null;
  guidance: string | null;
  care_recommendation_type: string | null;
  care_recommendation_reason: string | null;
  evidence_summary?: string | null;
  baseline_summary?: string | null;
  change_summary?: string | null;
}>(row: T): T {
  const seeing = displayCopy(row.seeing || row.narrative || '');
  const status = row.confidence_label?.trim() || FALLBACK_STATUS[row.strength] || 'still learning';
  return {
    ...row,
    seeing,
    narrative: seeing || displayCopy(row.narrative ?? ''),
    confidence_label: displayCopy(status),
    guidance: row.guidance ? displayCopy(row.guidance) : null,
    evidence_summary: row.evidence_summary ? displayCopy(row.evidence_summary) : row.evidence_summary,
    baseline_summary: row.baseline_summary ? displayCopy(row.baseline_summary) : row.baseline_summary,
    change_summary: row.change_summary ? displayCopy(row.change_summary) : row.change_summary,
  };
}

export function coreStatusLabel(row: {
  strength: Strength;
  confidence_label: string | null;
}): string {
  const raw = row.confidence_label?.trim() || FALLBACK_STATUS[row.strength] || 'still learning';
  return displayCopy(raw);
}

export function todayHeadline(domainWord: string, strength: Strength): string {
  if (strength === 'emerging' || strength === 'moderate') {
    return displayCopy(`What's taking shape in your ${domainWord.toLowerCase()}`);
  }
  return displayCopy(`What we understand about your ${domainWord.toLowerCase()}`);
}

export function intelligenceSurfaces(input: WhyLayerInput): {
  today: { narrative: string; status: string; strength: Strength };
  core: { status: string; strength: Strength };
  why: WhyLayer;
} {
  const featured = input.featured;
  const status = coreStatusLabel(featured);
  const seeing = displayCopy(featured.seeing || featured.narrative);
  return {
    today: {
      narrative: seeing,
      status,
      strength: featured.strength,
    },
    core: { status, strength: featured.strength },
    why: composeWhyLayer({ ...input, todayNarrative: seeing }),
  };
}

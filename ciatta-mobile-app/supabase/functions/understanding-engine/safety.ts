// Safety — assessment of foreseeable harm if an output is wrong or
// misunderstood. See spec §1.12 and §2.4: independent of Confidence,
// never derived from it. This MVP domain-risk map is intentionally
// duplicated (not imported) from careGuidance.ts's own DOMAIN_CARE_TYPE
// risk routing — the two gates must stay independently defined so a
// future change to one never silently changes the other, the same
// independence discipline crossDomainSynthesis.ts already applies to its
// own ACTIONABLE constant.
export type SafetyTier = 'unacceptable' | 'serious' | 'manageable' | 'low' | 'minimal';

const DOMAIN_SAFETY_TIER: Record<string, SafetyTier> = {
  sleep: 'minimal',
  recovery: 'low',
  energy: 'low',
  cycle: 'manageable',
  mood: 'manageable',
};

/**
 * A statement that uses any prohibited word is always 'unacceptable',
 * regardless of domain — language boundaries are a hard stop, not a
 * factor weighed against domain risk.
 */
export function assessSafety(domain: string, statement: string, prohibitedLanguage: string[]): SafetyTier {
  const lower = statement.toLowerCase();
  const violatesProhibitedLanguage = prohibitedLanguage.some((word) => lower.includes(word.toLowerCase()));
  if (violatesProhibitedLanguage) return 'unacceptable';
  return DOMAIN_SAFETY_TIER[domain] ?? 'manageable';
}

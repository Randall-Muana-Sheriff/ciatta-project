// Her health insurance, as she enters it on her Profile. Stored on her
// profile (20261014110000_insurance.sql checks the same shape). The member
// ID is kept for her, but the overview never shows it whole: only its last
// four, where she opens it to check.

export type Insurance = { provider: string; plan?: string; member_id?: string };

export function insuranceFromInput(input: { provider: string; plan: string; memberId: string }): Insurance | { error: string } {
  const provider = input.provider.trim();
  const plan = input.plan.trim();
  const memberId = input.memberId.trim();
  if (!provider) return { error: 'Add the name of your insurer.' };
  if (provider.length > 120 || plan.length > 120) return { error: 'That name is too long.' };
  if (memberId.length > 60) return { error: 'That member ID is too long.' };
  return { provider, ...(plan ? { plan } : {}), ...(memberId ? { member_id: memberId } : {}) };
}

export function insuranceFact(ins: Insurance | null): { label: string; value: string; sub?: string } | null {
  if (!ins?.provider) return null;
  return { label: 'Insurance', value: ins.provider, ...(ins.plan ? { sub: ins.plan } : {}) };
}

export const maskedMemberId = (id: string | undefined): string | null => (id ? `Ending ${id.slice(-4)}` : null);

// From the stored column, which is jsonb and so could hold anything.
export function insuranceFromRow(value: unknown): Insurance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.provider !== 'string' || !v.provider.trim()) return null;
  return {
    provider: v.provider,
    ...(typeof v.plan === 'string' && v.plan ? { plan: v.plan } : {}),
    ...(typeof v.member_id === 'string' && v.member_id ? { member_id: v.member_id } : {}),
  };
}

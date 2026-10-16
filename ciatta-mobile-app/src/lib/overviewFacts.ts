// The six facts at the top of her Profile overview: age, height, weight,
// blood type, insurance and her cycle situation. Each is what Ciatta has,
// or absent; a fact it does not have is shown as not added, never filled in.
//
// Height, weight and blood type come from what she entered on Body
// Measurements or from Apple Health. What she entered wins for height and
// blood type, since she chose to say it; for weight, the newer of the two
// wins, since weight changes. Each is shown in her units, with the other
// system beside it, and blood type says where it came from.

import type { Situation } from './cycleProfile';
import { bloodTypeLabel } from './healthFacts';
import { formatHeight, formatWeight, toKg, type Units } from './units';
import type { IconName } from '../ui/icons';

export type OverviewFact = { key: string; label: string; value: string | null; sub?: string; icon: IconName };

// As stored on her profile (20261014140000_body.sql).
export type BodyManual = { blood_type?: number; height_cm?: number; weight_kg?: number; weight_on?: string; units?: Units; ethnicity?: string; gender?: string; sex_at_birth?: string; language?: string };

export type BodyHealth = {
  bloodType: number | null;
  height: { value: number; unit: string | null } | null;
  weight: { value: number; unit: string | null; at: string } | null;
};

export type ResolvedBody = {
  heightCm: number | null;
  weightKg: number | null;
  weightFrom: 'you' | 'apple' | null;
  bloodType: { code: number; from: 'you' | 'apple' } | null;
};

const TO_CM: Record<string, number> = { m: 100, cm: 1, mm: 0.1, in: 2.54, ft: 30.48 };

export function resolveBody({ manual, health }: { manual: BodyManual | null; health: BodyHealth }): ResolvedBody {
  const healthCm = health.height ? health.height.value * (TO_CM[(health.height.unit ?? '').toLowerCase()] ?? NaN) : NaN;
  const heightCm = manual?.height_cm ?? (Number.isFinite(healthCm) ? healthCm : null);

  const healthKg = health.weight ? toKg(health.weight.value, health.weight.unit) : null;
  const manualNewer = manual?.weight_kg != null && (!health.weight || !manual.weight_on || manual.weight_on >= health.weight.at.slice(0, 10));
  const weightKg = manualNewer ? manual!.weight_kg! : (healthKg ?? manual?.weight_kg ?? null);
  const weightFrom = weightKg == null ? null : manualNewer || healthKg == null ? 'you' : 'apple';

  const bloodType = manual?.blood_type ? { code: manual.blood_type, from: 'you' as const } : health.bloodType ? { code: health.bloodType, from: 'apple' as const } : null;
  return { heightCm, weightKg, weightFrom, bloodType };
}

export function overviewFacts(input: {
  age: { value: string; sub?: string } | null;
  body: ResolvedBody;
  insurance: { value: string; sub?: string } | null;
  situations: readonly Situation[];
  units: Units;
  now: Date;
}): OverviewFact[] {
  const { body, units } = input;
  const height = body.heightCm != null ? formatHeight(body.heightCm, units) : null;
  const weight = body.weightKg != null ? formatWeight(body.weightKg, units) : null;
  const blood = body.bloodType ? bloodTypeLabel(body.bloodType.code) : null;
  const [first, ...rest] = input.situations;
  return [
    { key: 'age', label: 'Age', value: input.age?.value ?? null, ...(input.age?.sub ? { sub: input.age.sub } : {}), icon: 'person' },
    { key: 'height', label: 'Height', value: height?.value ?? null, ...(height ? { sub: height.other } : {}), icon: 'ruler' },
    { key: 'weight', label: 'Weight', value: weight?.value ?? null, ...(weight ? { sub: weight.other } : {}), icon: 'body' },
    {
      key: 'blood',
      label: 'Blood Type',
      value: blood,
      ...(blood ? { sub: body.bloodType!.from === 'you' ? 'Entered by you' : 'From Apple Health' } : {}),
      icon: 'drop',
    },
    { key: 'insurance', label: 'Insurance', value: input.insurance?.value ?? null, ...(input.insurance?.sub ? { sub: input.insurance.sub } : {}), icon: 'shield' },
    { key: 'situation', label: 'Cycle situation', value: first ?? null, ...(rest.length ? { sub: `and ${rest.length} more` } : {}), icon: 'calendar' },
  ];
}

// Age, height and blood type from Apple Health, for the facts at the top of
// her Profile overview. Pure: what HealthKit returned in, the facts out.
// Nothing is guessed: no date of birth is no age, a blood type left unset in
// Apple Health is none, and a height in a unit this does not know is not
// converted on a hunch.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type Fact = { label: string; value: string; sub?: string };

export function ageFact(dob: Date | null, now: Date): Fact | null {
  if (!dob || Number.isNaN(dob.getTime())) return null;
  let years = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) years -= 1;
  if (years < 0 || years > 130) return null;
  return { label: 'Age', value: `${years} years`, sub: `Born ${dob.getDate()} ${MONTHS[dob.getMonth()]} ${dob.getFullYear()}` };
}

// HealthKit's HKBloodType, in words.
const BLOOD: Record<number, string> = {
  1: 'A positive',
  2: 'A negative',
  3: 'B positive',
  4: 'B negative',
  5: 'AB positive',
  6: 'AB negative',
  7: 'O positive',
  8: 'O negative',
};

export const bloodTypeLabel = (code: number | null | undefined): string | null => (code == null ? null : (BLOOD[code] ?? null));

const TO_CM: Record<string, number> = { m: 100, cm: 1, mm: 0.1, in: 2.54, ft: 30.48 };

export function heightFact(reading: { value: number; unit: string | null } | null): Fact | null {
  if (!reading) return null;
  const factor = TO_CM[(reading.unit ?? '').toLowerCase()];
  if (!factor) return null;
  const cm = reading.value * factor;
  if (cm < 50 || cm > 260) return null;
  const inches = Math.round(cm / 2.54);
  return { label: 'Height', value: `${Math.round(cm)} cm`, sub: `${Math.floor(inches / 12)} ft ${inches % 12} in` };
}

export function healthStats(
  found: { dateOfBirth: Date | null; bloodType: number | null; height: { value: number; unit: string | null } | null },
  now: Date,
): Fact[] {
  const blood = bloodTypeLabel(found.bloodType);
  return [ageFact(found.dateOfBirth, now), heightFact(found.height), blood ? { label: 'Blood Type', value: blood } : null].filter(
    (f): f is Fact => f != null,
  );
}

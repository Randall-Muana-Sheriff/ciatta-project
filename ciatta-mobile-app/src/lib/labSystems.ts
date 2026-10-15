// Which of Ciatta's body systems a lab test belongs to, by an explicit
// table. A test not in the table belongs to none, and is shown under
// Whole Body rather than guessed.

import { isOutside, type LabResult, testKey } from './labs';

const TABLE: Record<string, string[]> = {
  Circulatory: [
    'hemoglobin', 'hematocrit', 'red blood cells', 'white blood cells', 'platelets', 'mcv', 'mch', 'mchc', 'rdw', 'mpv',
    'ferritin', 'iron', 'tibc', 'transferrin', 'transferrin saturation', 'iron saturation', 'b12', 'folate',
  ],
  Metabolic: [
    'glucose', 'a1c', 'insulin', 'total cholesterol', 'ldl', 'hdl', 'triglycerides', 'non hdl cholesterol',
    'tsh', 'free t4', 'free t3', 't4', 't3', 'thyroid peroxidase antibodies', 'tpo antibodies', 'thyroglobulin antibodies', 'vitamin d',
  ],
  Digestive: ['alt', 'ast', 'alp', 'bilirubin', 'bilirubin total', 'total bilirubin', 'bilirubin direct', 'albumin', 'ggt', 'total protein', 'lipase', 'amylase'],
  Urinary: ['creatinine', 'bun', 'egfr', 'bun creatinine ratio', 'urine protein', 'urine specific gravity', 'urine ph', 'microalbumin'],
  Reproductive: ['estradiol', 'progesterone', 'lh', 'fsh', 'prolactin', 'testosterone', 'free testosterone', 'testosterone free', 'shbg', 'amh', 'dhea s', 'hcg'],
  Immune: ['crp', 'esr', 'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils', 'ana', 'rheumatoid factor'],
  Musculoskeletal: ['ck', 'creatine kinase', 'calcium', 'phosphorus', 'phosphate', 'magnesium'],
};

const BY_KEY = new Map<string, string>(Object.entries(TABLE).flatMap(([system, keys]) => keys.map((k) => [k, system] as [string, string])));

export function labSystem(name: string): string | null {
  return BY_KEY.get(testKey(name)) ?? null;
}

export type ReportSystem = { system: string; results: LabResult[]; flagged: boolean };

// The systems a report touches, in the order of the table, each with its
// results and whether any is outside its range. Tests in no system are
// kept apart, never dropped.
export function reportSystems(results: readonly LabResult[]): { systems: ReportSystem[]; whole: LabResult[] } {
  const by = new Map<string, LabResult[]>();
  const whole: LabResult[] = [];
  for (const r of results) {
    const system = labSystem(r.name);
    if (!system) {
      whole.push(r);
      continue;
    }
    by.set(system, [...(by.get(system) ?? []), r]);
  }
  const systems = Object.keys(TABLE)
    .filter((s) => by.has(s))
    .map((system) => ({ system, results: by.get(system)!, flagged: by.get(system)!.some(isOutside) }));
  return { systems, whole };
}

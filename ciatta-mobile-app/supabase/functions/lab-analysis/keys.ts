// One name per test, whichever lab wrote it. A copy of testKey in
// src/lib/labs.ts, because a function can only import its own files; a
// parity test in the app's suite keeps the two the same.

const LAB_ALIASES: Record<string, string> = {
  'hemoglobin a1c': 'a1c',
  hba1c: 'a1c',
  'hgb a1c': 'a1c',
  'glycated hemoglobin': 'a1c',
  'glycohemoglobin': 'a1c',
  'thyroid stimulating hormone': 'tsh',
  'free t4': 'free t4',
  't4 free': 'free t4',
  'thyroxine free': 'free t4',
  'free thyroxine': 'free t4',
  'free t3': 'free t3',
  't3 free': 'free t3',
  'vitamin d 25 hydroxy': 'vitamin d',
  '25 hydroxy vitamin d': 'vitamin d',
  '25 oh vitamin d': 'vitamin d',
  'vitamin d 25 oh': 'vitamin d',
  'vitamin b12': 'b12',
  cobalamin: 'b12',
  hgb: 'hemoglobin',
  hct: 'hematocrit',
  wbc: 'white blood cells',
  'white blood cell count': 'white blood cells',
  rbc: 'red blood cells',
  'red blood cell count': 'red blood cells',
  plt: 'platelets',
  'platelet count': 'platelets',
  'c reactive protein': 'crp',
  'hs crp': 'crp',
  'high sensitivity crp': 'crp',
  'alanine aminotransferase': 'alt',
  sgpt: 'alt',
  'aspartate aminotransferase': 'ast',
  sgot: 'ast',
  'alkaline phosphatase': 'alp',
  'blood urea nitrogen': 'bun',
  'urea nitrogen': 'bun',
  'luteinizing hormone': 'lh',
  'follicle stimulating hormone': 'fsh',
  'estradiol e2': 'estradiol',
  e2: 'estradiol',
  'testosterone total': 'testosterone',
  'total testosterone': 'testosterone',
  'dhea sulfate': 'dhea s',
  'dhea s': 'dhea s',
  'anti mullerian hormone': 'amh',
  'erythrocyte sedimentation rate': 'esr',
  'sed rate': 'esr',
  'glucose fasting': 'glucose',
  'fasting glucose': 'glucose',
  'ldl cholesterol': 'ldl',
  'ldl c': 'ldl',
  'hdl cholesterol': 'hdl',
  'hdl c': 'hdl',
  'cholesterol total': 'total cholesterol',
};

export function testKey(name: string): string {
  const folded = name
    .toLowerCase()
    .replace(/[,()\-/.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return LAB_ALIASES[folded] ?? folded;
}

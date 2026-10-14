// Labs worth asking her clinician about, from what she logged: a symptom
// she logged on two or more days that a common test is ordered to look
// into, where her record holds no result for that test from the last
// year. Ciatta does not order tests; it names what is worth asking about
// and drafts the request for her to send.

export const SUGGEST_LABS = 'Suggest the next labs worth asking about, based on my health data.';

// Which symptoms each test is commonly ordered to look into.
const TESTS: { test: string; match: RegExp; for: string[] }[] = [
  { test: 'Ferritin', match: /ferritin|iron/i, for: ['Fatigue', 'Hair shedding', 'Dizziness', 'Daytime sleepiness', 'Palpitations', 'Shortness of breath'] },
  { test: 'TSH', match: /\btsh\b|thyroid/i, for: ['Fatigue', 'Brain fog', 'Hair shedding', 'Dry skin', 'Constipation', 'Low mood', 'Palpitations', 'Racing heart'] },
  { test: 'Complete blood count', match: /complete blood|\bcbc\b|h(a)?emoglobin/i, for: ['Fatigue', 'Dizziness', 'Shortness of breath', 'Palpitations'] },
  { test: 'Vitamin D', match: /vitamin d/i, for: ['Fatigue', 'Low mood', 'Muscle aches', 'Joint pain'] },
  { test: 'FSH and estradiol', match: /\bfsh\b|estradiol/i, for: ['Hot flashes', 'Night sweats'] },
  { test: 'Testosterone', match: /testosterone/i, for: ['Unwanted hair growth', 'Acne'] },
];

export function labSuggestions(input: {
  symptoms: readonly { name: string; days: number }[];
  labs: readonly { name: string; on: string }[];
  now: Date;
}): { test: string; reasons: string[] }[] {
  const yearAgo = new Date(input.now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const out: { test: string; reasons: string[] }[] = [];
  for (const t of TESTS) {
    if (input.labs.some((l) => t.match.test(l.name) && l.on >= yearAgo)) continue;
    const hits = input.symptoms.filter((s) => s.days >= 2 && t.for.includes(s.name)).sort((a, b) => b.days - a.days);
    if (hits.length) out.push({ test: t.test, reasons: hits.map((s) => `${s.name.toLowerCase()} on ${s.days} days`) });
  }
  return out.slice(0, 3);
}

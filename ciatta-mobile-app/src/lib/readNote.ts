// Reads a free-text note for context the person mentioned, so "it started
// after a long flight" is stored as Travel alongside the words themselves.
// Only returns labels from the Around the time list; nothing is inferred
// beyond what the words say.

const CUES: [RegExp, string][] = [
  [/\b(flight|flew|travel|trip|jet ?lag|airport)/i, 'Travel'],
  [/\b(stress|stressful|stressed|anxious|anxiety|deadline|overwhelm)/i, 'Stress'],
  [/(couldn'?t sleep|could not sleep|can'?t sleep|no sleep|slept (badly|poorly)|poor sleep|insomnia|awake all night|woke up)/i, 'Poor sleep'],
  [/\b(run|ran|gym|workout|exercise|yoga|hike|hiked|cycling|swim)/i, 'Physical activity'],
  [/\b(wine|beer|drinks|drinking|alcohol|cocktail)/i, 'Alcohol'],
  [/\b(coffee|espresso|latte|caffeine|energy drink|cola)/i, 'Caffeine'],
  [/\b(sex|intercourse)\b/i, 'Sex'],
  [/\b(sick|cold|flu|fever|virus|covid|ill)\b/i, 'Illness'],
  [/\b(ate|meal|food|dinner|lunch|breakfast|snack|spicy|dairy|milk|cheese|gluten|bread|pasta|sugar)\b/i, 'Food'],
  [/(new (pill|medication|meds|dose)|changed? (my )?(medication|meds|dose)|stopped taking)/i, 'Medication change'],
  [/(new supplement|started (taking )?(magnesium|iron|vitamin))/i, 'Supplement change'],
  [/(before my period|period (is|was) due|days before my period)/i, 'Before period'],
  [/(on my period|during my period|period started)/i, 'Period'],
  [/(after my period|period ended)/i, 'After period'],
  [/\bovulat/i, 'Ovulation'],
];

export function readNote(text: string): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const [cue, label] of CUES) {
    if (cue.test(text) && !found.includes(label)) found.push(label);
  }
  return found;
}

// What she ate, how her gut was, and how the day felt.
//
// Seven fields on Day have existed since the beginning and nothing has
// ever written them: foods, digestion, caffeine, alcohol, energy, mood,
// stress. The insight engine already reads them. foodAndBloating has sat
// in engine.ts the whole time, gated and correct, and has never once
// fired because its input was always empty. So this is less a new feature
// than the missing half of one.
//
// Three rules, and the first is the one that took a decision.
//
//   An estimate is not a measurement, and the type says so. A calorie
//   figure from a label or a model is an inference. It gets its own
//   provenance, 'estimated', beside measured and reported, so it cannot
//   be formatted, summed or charted as though an instrument produced it.
//   estimateLine refuses to render a figure without saying it is one.
//
//   Missing is unknown. No caffeine logged is not zero coffees. A day she
//   did not fill in is absent from every count rather than counted as a
//   day of nothing.
//
//   Nothing here scores her. There is no gut health number, no diet
//   quality grade and no stress index, because none of those can be
//   computed from this without inventing most of it. What there is, is
//   what she recorded.

export type Provenance = 'measured' | 'reported' | 'estimated';

// One thing she ate. The name is hers; nothing renames or categorises it,
// because "toast" counted as "refined grain" is a judgement she did not
// make and the engine matches on her own words.
export type FoodEntry = {
  id: string;
  name: string;
  // Kilocalories, when there is a figure at all. Null is the normal case
  // and is not zero: a meal with no number is a meal she logged without
  // one, not a meal with no energy in it.
  kcal: number | null;
  // Where the figure came from. 'reported' is a number she read off a
  // label and typed. 'estimated' is anything computed for her. There is
  // no third option and no unlabelled figure.
  kcalFrom: 'reported' | 'estimated' | null;
  at: string;
  photoUri: string | null;
};

// The Bristol stool scale, in its own words.
//
// Described, never graded. "Type 1" with a picture is a clinical scale a
// woman can match herself against; "poor" would be Ciatta telling her
// something about her body it is in no position to say.
export const STOOL_TYPES = [
  { type: 1, text: 'Separate hard lumps' },
  { type: 2, text: 'Lumpy and sausage shaped' },
  { type: 3, text: 'Sausage shaped with cracks' },
  { type: 4, text: 'Smooth and soft' },
  { type: 5, text: 'Soft blobs with clear edges' },
  { type: 6, text: 'Fluffy and ragged' },
  { type: 7, text: 'Entirely liquid' },
] as const;

export const DIGESTION_FLAGS = ['Bloating', 'Cramping', 'Nausea', 'Reflux', 'Gas', 'Constipation', 'Loose'] as const;

// A one to five check in. Named by what she is answering, never by a
// verdict: 4 of 5 stays 4 of 5 everywhere, and is not relabelled "good".
export const CHECK_INS = [
  { key: 'energy', question: 'How was your energy?' },
  { key: 'mood', question: 'How was your mood?' },
  { key: 'stress', question: 'How was your stress?' },
] as const;

export type CheckInKey = (typeof CHECK_INS)[number]['key'];

export type DailyLog = {
  date: string;
  foods: FoodEntry[];
  stool: number | null;
  digestion: string[];
  caffeine: number | null;
  alcohol: number | null;
  energy: number | null;
  mood: number | null;
  stress: number | null;
};

export function emptyLog(date: string): DailyLog {
  return {
    date,
    foods: [],
    stool: null,
    digestion: [],
    caffeine: null,
    alcohol: null,
    energy: null,
    mood: null,
    stress: null,
  };
}

// ── What may be said about a calorie figure ──────────────────────────

// A kcal figure, never bare.
//
// This is the whole of the guarantee that an estimate reads as one. There
// is no path that returns a number on its own: a figure without a
// provenance returns null rather than a bare number, because a bare
// number is remembered as a fact whatever the surrounding copy said.
export function kcalLine(entry: FoodEntry): string | null {
  if (entry.kcal == null || entry.kcalFrom == null) return null;
  const n = Math.round(entry.kcal);
  return entry.kcalFrom === 'estimated' ? `About ${n} kcal, estimated` : `${n} kcal, from the label`;
}

// The day's energy, which is only ever a sum of figures that exist.
//
// Returns the total and how many meals had no figure, because a total
// that silently skipped four meals is a total that reads as her whole
// day. A day where nothing carried a figure returns null, not zero.
export function kcalTotal(foods: readonly FoodEntry[]): { total: number; counted: number; missing: number } | null {
  const withFigures = foods.filter((f) => f.kcal != null && f.kcalFrom != null);
  if (!withFigures.length) return null;
  return {
    total: Math.round(withFigures.reduce((n, f) => n + (f.kcal as number), 0)),
    counted: withFigures.length,
    missing: foods.length - withFigures.length,
  };
}

// How the total is said. It carries the caveat in the same sentence,
// because a total built from estimates is itself an estimate, and it says
// what it could not count.
export function kcalTotalLine(foods: readonly FoodEntry[]): string | null {
  const sum = kcalTotal(foods);
  if (!sum) return null;
  const anyEstimated = foods.some((f) => f.kcalFrom === 'estimated');
  // Even the all from labels case names its source. The rule is that a
  // figure never appears without one, and a total is a figure.
  const head = anyEstimated ? `About ${sum.total} kcal, estimated` : `${sum.total} kcal from labels`;
  if (sum.missing === 0) return `${head} across ${sum.counted} ${sum.counted === 1 ? 'item' : 'items'}.`;
  return `${head} across ${sum.counted} of ${sum.counted + sum.missing} items. The rest had no figure.`;
}

// ── The day, said back ───────────────────────────────────────────────

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n: number) => WORDS[n] ?? String(n);

export function stoolText(type: number | null): string | null {
  return STOOL_TYPES.find((s) => s.type === type)?.text ?? null;
}

// One line describing what is in the day. Counted, never judged, and
// silent about everything she did not fill in.
export function logLine(log: DailyLog): string {
  const parts: string[] = [];
  if (log.foods.length) parts.push(`${count(log.foods.length)} ${log.foods.length === 1 ? 'item' : 'items'} of food`);
  if (log.stool != null) parts.push('a bowel movement');
  if (log.digestion.length) parts.push(`${count(log.digestion.length)} digestion ${log.digestion.length === 1 ? 'note' : 'notes'}`);
  if (log.caffeine != null) parts.push(`${count(log.caffeine)} caffeine`);
  if (log.alcohol != null) parts.push(`${count(log.alcohol)} alcohol`);
  const checks = [log.energy, log.mood, log.stress].filter((v) => v != null).length;
  if (checks) parts.push(`${count(checks)} check ${checks === 1 ? 'in' : 'ins'}`);

  if (!parts.length) return 'Nothing logged for today yet.';
  if (parts.length === 1) return `Today: ${parts[0]}.`;
  return `Today: ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
}

// Whether there is anything to save. A screen that wrote an empty day
// would fill her record with days that say nothing, and the engine counts
// days.
export function hasAnything(log: DailyLog): boolean {
  return (
    log.foods.length > 0 ||
    log.stool != null ||
    log.digestion.length > 0 ||
    log.caffeine != null ||
    log.alcohol != null ||
    log.energy != null ||
    log.mood != null ||
    log.stress != null
  );
}

// What the engine reads. foods is her own words, which is what
// foodAndBloating tallies on, and digestion is the flag list it checks
// for bloating. The shape is Day's, so nothing downstream has to change.
export function toDayFields(log: DailyLog) {
  return {
    foods: log.foods.map((f) => f.name),
    digestion: [...log.digestion],
    caffeine: log.caffeine,
    alcohol: log.alcohol,
    energy: log.energy,
    mood: log.mood,
    stress: log.stress,
  };
}

// What the person told us about their cycle. These are their own words for
// their situation, never a diagnosis, and any combination is allowed.

export const SITUATIONS = [
  { id: 'Regular', sub: 'Your periods come at about the same time each month' },
  { id: 'Irregular', sub: 'Your cycle length changes a lot, or periods skip' },
  { id: 'Endometriosis', sub: 'You have endometriosis, or think you might' },
  { id: 'PCOS / PMOS', sub: 'Polycystic ovary syndrome, now also called PMOS' },
  { id: 'Postpartum', sub: 'You gave birth in the last year or so' },
  { id: 'Perimenopause', sub: 'Your cycle is changing in the years before menopause' },
  { id: 'Hormonal contraception', sub: 'Pill, hormonal IUD, implant, injection, ring or patch' },
  { id: 'No periods right now', sub: 'Your periods have stopped, for any reason' },
] as const;

export type Situation = (typeof SITUATIONS)[number]['id'];

export const CONTRACEPTION = ['Pill', 'Hormonal IUD', 'Implant', 'Injection', 'Ring or patch', 'Other'] as const;
export type Contraception = (typeof CONTRACEPTION)[number];

export type CycleProfile = {
  situations: Situation[];
  birthDate?: string; // ISO day, Postpartum
  breastfeeding?: boolean; // Postpartum
  lastPeriod?: string; // ISO day, Perimenopause, used when no period is logged
  contraception?: Contraception;
  showFertility?: boolean; // undefined means on
  setupDone: boolean;
};

// Where a brand new person starts before her own record has anything to
// estimate from: no situation chosen and no fertile window shown until she
// turns it on herself.
export const EMPTY_PROFILE: CycleProfile = { situations: [], setupDone: false, showFertility: false };
export const SAMPLE_PROFILE: CycleProfile = { situations: ['Endometriosis', 'Irregular'], setupDone: true };

// Choices that can't be true at the same time.
const EXCLUSIVE: Partial<Record<Situation, Situation[]>> = {
  Regular: ['Irregular', 'No periods right now'],
  Irregular: ['Regular', 'No periods right now'],
  'No periods right now': ['Regular', 'Irregular'],
};

export function toggleSituation(p: CycleProfile, s: Situation): CycleProfile {
  if (p.situations.includes(s)) return { ...p, situations: p.situations.filter((x) => x !== s) };
  const drop = EXCLUSIVE[s] ?? [];
  return { ...p, situations: [...p.situations.filter((x) => !drop.includes(x)), s] };
}

export const has = (p: CycleProfile, s: Situation) => p.situations.includes(s);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const SITUATION_IDS: readonly string[] = SITUATIONS.map((s) => s.id);

// Saved profiles come back from storage as `unknown`; this is the profile's
// equivalent of `normalizeEpisode`, guarding every screen that reads it
// against malformed or outdated data.
export function normalizeProfile(raw: unknown): CycleProfile | null {
  if (!isRecord(raw) || !Array.isArray(raw.situations)) return null;

  const situations: Situation[] = [];
  for (const s of raw.situations) {
    if (typeof s === 'string' && SITUATION_IDS.includes(s) && !situations.includes(s as Situation)) {
      situations.push(s as Situation);
    }
  }

  const profile: CycleProfile = { situations, setupDone: raw.setupDone === true };
  if (typeof raw.birthDate === 'string') profile.birthDate = raw.birthDate;
  if (typeof raw.breastfeeding === 'boolean') profile.breastfeeding = raw.breastfeeding;
  if (typeof raw.lastPeriod === 'string') profile.lastPeriod = raw.lastPeriod;
  if (typeof raw.contraception === 'string' && (CONTRACEPTION as readonly string[]).includes(raw.contraception)) {
    profile.contraception = raw.contraception as Contraception;
  }
  if (typeof raw.showFertility === 'boolean') profile.showFertility = raw.showFertility;
  return profile;
}

// Signs someone can log that point to ovulation.
export const FERTILITY_SIGNS = ['Positive ovulation test', 'Egg white discharge', 'Ovulation pain'];

// The fertile window applies unless it is switched off, or hormonal
// contraception or no periods make it meaningless.
export const fertilityOn = (p: CycleProfile) =>
  p.showFertility !== false && !has(p, 'Hormonal contraception') && !has(p, 'No periods right now');

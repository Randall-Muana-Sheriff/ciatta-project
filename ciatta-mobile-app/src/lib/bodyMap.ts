import { dayLabel, daysBetween } from '../data/cycleLog';
import type { Day } from '../data/daily';
import { displayCopy } from './displayCopy';
import type { Screen } from '../navigation';
import type { Signal } from './cyclePatterns';
import type { Insight } from './engine';

// The body, from the Ciatta design system (07 · Body). A place to put
// information, not a picture of her. Every signal is stored as a region and a
// meaning; positions below exist only to render the front view. Colour arrives
// as light around a point, never as paint on the form.

export type RegionId =
  | 'head'
  | 'neck'
  | 'shoulder_right'
  | 'shoulder_left'
  | 'chest'
  | 'upper_back'
  | 'upper_abdomen'
  | 'lower_back'
  | 'lower_abdomen'
  | 'hip_right'
  | 'hip_left'
  | 'pelvis'
  | 'knee_right'
  | 'knee_left'
  | 'systemic';

export type Region = { id: RegionId; label: string; group: string; x?: number; y?: number };

// Front view, as a percentage of the silhouette image (850 by 1850). She faces
// the viewer, so her right side sits on the viewer's left. Back regions have no
// front position; the back view isn't drawn yet, so they live in the list.
// Order is anatomical, head to feet, with Systemic last.
export const REGIONS: Region[] = [
  { id: 'head', label: 'Head', group: 'Head and neurological', x: 50, y: 8 },
  { id: 'neck', label: 'Neck and thyroid', group: 'Neck and thyroid', x: 50, y: 16.5 },
  { id: 'shoulder_right', label: 'Right shoulder', group: 'Musculoskeletal', x: 31, y: 21 },
  { id: 'shoulder_left', label: 'Left shoulder', group: 'Musculoskeletal', x: 69, y: 21 },
  { id: 'chest', label: 'Heart and lungs', group: 'Chest and cardiorespiratory', x: 55, y: 27 },
  { id: 'upper_back', label: 'Upper back', group: 'Musculoskeletal' },
  { id: 'upper_abdomen', label: 'Upper abdomen', group: 'Abdomen and digestive', x: 50, y: 36 },
  { id: 'lower_back', label: 'Lower back', group: 'Musculoskeletal' },
  { id: 'lower_abdomen', label: 'Lower abdomen', group: 'Abdomen and digestive', x: 50, y: 43 },
  { id: 'hip_right', label: 'Right hip', group: 'Musculoskeletal', x: 33, y: 46.5 },
  { id: 'hip_left', label: 'Left hip', group: 'Musculoskeletal', x: 67, y: 46.5 },
  { id: 'pelvis', label: 'Pelvis and reproductive', group: 'Pelvic and reproductive', x: 50, y: 49.5 },
  { id: 'knee_right', label: 'Right knee', group: 'Musculoskeletal', x: 42.5, y: 72 },
  { id: 'knee_left', label: 'Left knee', group: 'Musculoskeletal', x: 57.5, y: 72 },
  { id: 'systemic', label: 'Whole body', group: 'Systemic' },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>;

// Where each logged pain location belongs.
const LOCATION_REGION: Record<string, RegionId> = {
  Pelvis: 'pelvis',
  'Lower pelvis': 'pelvis',
  'Left pelvis': 'pelvis',
  'Right pelvis': 'pelvis',
  'Lower abdomen': 'lower_abdomen',
  'Center abdomen': 'lower_abdomen',
  'Left abdomen': 'lower_abdomen',
  'Right abdomen': 'lower_abdomen',
  'Upper abdomen': 'upper_abdomen',
  'Lower back': 'lower_back',
  Buttocks: 'lower_back',
  'Middle back': 'upper_back',
  'Upper back': 'upper_back',
  'Left hip': 'hip_left',
  'Right hip': 'hip_right',
  'Left leg': 'knee_left',
  'Right leg': 'knee_right',
  'Both legs': 'knee_left',
  Chest: 'chest',
  'Left shoulder': 'shoulder_left',
  'Right shoulder': 'shoulder_right',
};

// The pain location to preselect when she logs from a region.
export const REGION_LOCATION: Partial<Record<RegionId, string>> = {
  pelvis: 'Pelvis',
  lower_abdomen: 'Lower abdomen',
  upper_abdomen: 'Upper abdomen',
  lower_back: 'Lower back',
  upper_back: 'Upper back',
  hip_right: 'Right hip',
  hip_left: 'Left hip',
  knee_right: 'Right leg',
  knee_left: 'Left leg',
  chest: 'Chest',
  shoulder_right: 'Right shoulder',
  shoulder_left: 'Left shoulder',
};

export type Meaning = 'measured' | 'reported' | 'change' | 'evidence' | 'uncertainty' | 'attention' | 'timeDepth';
export type PointState = 'lit' | 'historical';

export type BodyPoint = {
  region: RegionId;
  meaning: Meaning;
  state: PointState;
  // At most three points carry a halo, so the body never reads as a rainbow.
  halo: boolean;
  title: string;
  detail: string;
  source: 'Measured' | 'You reported' | 'Lab' | 'Pattern';
  screen?: Screen;
  insightId?: string;
  // For whole body points: the body system they belong to, if any.
  system?: string;
};

export type BodyReading = {
  points: BodyPoint[];
  systemic: BodyPoint[];
  thread: { from: RegionId; to: RegionId; sentence: string } | null;
  lead: RegionId | null;
};

const MEANING_WORDS: Record<Meaning, string> = {
  measured: 'Measured',
  reported: 'You reported',
  change: 'Something changed',
  evidence: 'Evidence',
  uncertainty: 'Missing',
  attention: 'Worth raising',
  timeDepth: 'Earlier',
};

// What the list and VoiceOver say instead of a colour.
export function stateWords(p?: BodyPoint): string {
  if (!p) return 'Nothing logged';
  return p.state === 'historical' ? `${MEANING_WORDS[p.meaning]}, earlier` : MEANING_WORDS[p.meaning];
}

type Draw = { date: string; results: { name: string; value: string; range: string; status?: string }[] };

export function readBody({
  signals,
  days,
  ranked,
  draws,
  now = new Date(),
}: {
  signals: Signal[];
  days: Day[];
  ranked: Insight[];
  draws: Draw[];
  now?: Date;
}): BodyReading {
  const found = (id: string) => ranked.find((i) => i.id === id && i.triage !== 'Ignore');
  const points = new Map<RegionId, BodyPoint>();
  const put = (p: BodyPoint) => points.set(p.region, p);
  const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

  // Pain she logged in the last month, by region.
  const byRegion = new Map<RegionId, Signal[]>();
  for (const s of signals) {
    if (!s.pain || daysBetween(s.date, now) > 30) continue;
    for (const loc of s.episode.locations) {
      const region = LOCATION_REGION[loc];
      if (!region) continue;
      const list = byRegion.get(region) ?? [];
      if (!list.includes(s)) list.push(s);
      byRegion.set(region, list);
    }
  }
  for (const [region, list] of byRegion) {
    const latest = list[list.length - 1];
    const count = new Set(list.map((s) => s.episode.date)).size;
    put({
      region,
      meaning: 'reported',
      state: daysBetween(latest.date, now) <= 14 ? 'lit' : 'historical',
      halo: false,
      title: 'Pain you logged',
      detail: `You logged pain here on ${plural(count, 'day')} in the last month, most recently ${dayLabel(latest.episode.date, now).toLowerCase() === 'today' ? 'today' : dayLabel(latest.episode.date, now)}.`,
      source: 'You reported',
      screen: 'cycleHistory',
    });
  }

  // Bowel movements she logged as painful sit on the lower abdomen, unless
  // pain she logged there already does.
  const bowel = signals.filter((s) => s.bowelPain && daysBetween(s.date, now) <= 30);
  if (bowel.length && !points.has('lower_abdomen')) {
    const latest = bowel[bowel.length - 1];
    put({
      region: 'lower_abdomen',
      meaning: 'reported',
      state: daysBetween(latest.date, now) <= 14 ? 'lit' : 'historical',
      halo: false,
      title: 'Bowel movement pain',
      detail: displayCopy(`You logged pain with ${plural(bowel.length, 'bowel movement')} in the last month.`),
      source: 'You reported',
      screen: 'cycleHistory',
    });
  }

  // Bloating she noted, which belongs to the abdomen.
  const bloated = days.slice(-30).filter((d) => d.digestion.includes('Bloating'));
  if (bloated.length) {
    const line = `You noted bloating on ${plural(bloated.length, 'day')} in the last month.`;
    const existing = points.get('lower_abdomen');
    if (existing) existing.detail = `${existing.detail} ${line}`;
    else {
      put({
        region: 'lower_abdomen',
        meaning: 'reported',
        state: daysBetween(new Date(bloated[bloated.length - 1].date), now) <= 14 ? 'lit' : 'historical',
        halo: false,
        title: 'Bloating you noted',
        detail: line,
        source: 'You reported',
        screen: 'symptoms',
      });
    }
  }

  // Where something turned: pain lasting longer, with the shortest cycle.
  const change = found('duration') ?? found('combined');
  if (change) {
    const before = points.get('pelvis');
    put({
      region: 'pelvis',
      meaning: 'change',
      state: 'lit',
      halo: true,
      title: 'Something changed here',
      detail: before ? `${change.brief} ${before.detail}` : change.brief,
      source: 'Pattern',
      insightId: change.id,
    });
  }

  // Heart and lungs: resting heart rate.
  const rhr = found('rhrHigh');
  put(
    rhr
      ? { region: 'chest', meaning: 'measured', state: 'lit', halo: true, title: 'Resting heart rate above usual', detail: rhr.brief, source: 'Measured', insightId: rhr.id }
      : { region: 'chest', meaning: 'measured', state: 'historical', halo: false, title: 'Heart rate within your usual range', detail: 'Your resting heart rate has stayed within your usual range.', source: 'Measured', screen: 'movement' },
  );

  // Head: sleep, which the design system places with head and neurological.
  const sleep = found('sleepLow');
  if (sleep) {
    put({ region: 'head', meaning: 'measured', state: 'lit', halo: true, title: 'Sleep lower than usual', detail: sleep.brief, source: 'Measured', screen: 'sleep' });
  }

  // Neck and thyroid: the latest TSH result.
  const tsh = draws
    .map((d) => ({ date: d.date, r: d.results.find((x) => x.name === 'TSH') }))
    .find((x) => x.r);
  if (tsh?.r) {
    const inRange = tsh.r.status !== 'Low' && tsh.r.status !== 'High';
    put({
      region: 'neck',
      meaning: 'measured',
      state: 'historical',
      halo: false,
      title: inRange ? 'Thyroid result within range' : 'Thyroid result outside range',
      detail: `TSH was ${tsh.r.value} on ${tsh.date}, against a range of ${tsh.r.range}.`,
      source: 'Lab',
      screen: 'healthrecords',
    });
  }

  // Signals with no location go to the whole body, never to the nearest organ.
  const systemic: BodyPoint[] = [];
  const tired = days.slice(-14).filter((d) => d.energy != null && d.energy <= 2).length;
  if (tired >= 3) {
    systemic.push({ region: 'systemic', meaning: 'reported', state: 'lit', halo: true, title: 'Fatigue', detail: `You logged low energy on ${tired} of the last 14 days.`, source: 'You reported', insightId: 'fatigueShortSleep' });
  }
  const stress = found('stressHigh');
  if (stress) {
    systemic.push({ region: 'systemic', meaning: 'reported', state: 'lit', halo: false, title: 'Stress', detail: stress.brief, source: 'You reported', insightId: stress.id });
  }
  const vitaminD = found('bio:Vitamin D');
  if (vitaminD) {
    systemic.push({ region: 'systemic', meaning: 'attention', state: 'lit', halo: false, title: 'Vitamin D below range', detail: vitaminD.brief, source: 'Lab', insightId: vitaminD.id, system: 'Nutrients' });
  }
  // Iron stores have no single place; they belong with blood function.
  const ferritin = draws
    .map((d) => ({ date: d.date, r: d.results.find((x) => x.name === 'Ferritin') }))
    .find((x) => x.r);
  if (ferritin?.r) {
    const inRange = ferritin.r.status !== 'Low' && ferritin.r.status !== 'High';
    systemic.push({
      region: 'systemic',
      meaning: inRange ? 'measured' : 'attention',
      state: 'historical',
      halo: false,
      title: inRange ? 'Ferritin within range' : 'Ferritin outside range',
      detail: `Ferritin was ${ferritin.r.value} on ${ferritin.date}, against a range of ${ferritin.r.range}.`,
      source: 'Lab',
      screen: 'healthrecords',
      system: 'Blood Function',
    });
  }

  // One leading point, then no more than three halos across the whole body,
  // counting the whole body halo, so the map never reads as a rainbow.
  // Priority: the lead, heart and lungs, the whole body, then the head.
  const lead: RegionId | null = points.has('pelvis') && change ? 'pelvis' : [...points.values()].find((p) => p.state === 'lit')?.region ?? null;
  const priority = [lead ? points.get(lead) : undefined, points.get('chest'), systemic.find((p) => p.halo), points.get('head')];
  const keep = new Set<BodyPoint>();
  for (const p of priority) {
    if (p && p.halo && p.state === 'lit' && keep.size < 3) keep.add(p);
  }
  for (const p of [...points.values(), ...systemic]) p.halo = keep.has(p);

  // A relationship between two regions, drawn once, always with its sentence.
  const flare = found('flareSleep');
  const thread =
    flare && points.has('pelvis') && points.has('head')
      ? { from: 'pelvis' as RegionId, to: 'head' as RegionId, sentence: flare.brief }
      : null;

  return {
    points: REGIONS.filter((r) => points.has(r.id)).map((r) => points.get(r.id)!),
    systemic,
    thread,
    lead,
  };
}

// ── Body systems ───────────────────────────────────────────────

// Where each body system from Profile sits, keyed by its Profile label so the
// two lists can't drift apart. A system only claims a region when what is
// logged there really belongs to it: back pain isn't a kidney finding, so
// Kidney Function and Liver & Pancreas have no region and show labs only.
export const SYSTEM_PLACES: Record<string, { short: string; regions: RegionId[] }> = {
  'Heart Health': { short: 'Heart', regions: ['chest'] },
  'Kidney Function': { short: 'Kidneys', regions: [] },
  'Liver & Pancreas': { short: 'Liver & Pancreas', regions: [] },
  'Digestive & Gut Health': { short: 'Digestive & Gut', regions: ['upper_abdomen', 'lower_abdomen'] },
  'Metabolic Health': { short: 'Metabolic', regions: [] },
  'Reproductive Health': { short: 'Reproductive', regions: ['pelvis', 'lower_abdomen'] },
  'Bones & Muscles': {
    short: 'Bones & Muscles',
    regions: ['shoulder_right', 'shoulder_left', 'upper_back', 'lower_back', 'hip_right', 'hip_left', 'knee_right', 'knee_left'],
  },
  'Immune Regulation': { short: 'Immune', regions: [] },
  'Blood Function': { short: 'Blood', regions: [] },
  Nutrients: { short: 'Nutrients', regions: [] },
  'Thyroid Function': { short: 'Thyroid', regions: ['neck'] },
  'Autoimmune Health': { short: 'Autoimmune', regions: [] },
  'Infectious Diseases': { short: 'Infectious', regions: [] },
  'Substance Levels': { short: 'Substances', regions: [] },
  'Other Panels': { short: 'Other Panels', regions: [] },
};

// Sleep, fatigue and stress belong to no single system; they stay together
// under the whole body rather than disappearing.
export const WHOLE_BODY = 'Whole Body';

export type SystemReading = {
  label: string;
  short: string;
  regions: RegionId[];
  points: BodyPoint[];
  // What the row's dot shows: a haloed point first, then anything current.
  lead: BodyPoint | null;
};

export function readSystems(reading: BodyReading, labels: string[]): SystemReading[] {
  return [...labels, WHOLE_BODY].map((label) => {
    const whole = label === WHOLE_BODY;
    const place = SYSTEM_PLACES[label] ?? { short: label, regions: [] };
    const regions: RegionId[] = whole ? ['head', 'systemic'] : place.regions;
    const points = whole
      ? [...reading.points.filter((p) => p.region === 'head'), ...reading.systemic.filter((p) => !p.system)]
      : [...reading.points.filter((p) => regions.includes(p.region)), ...reading.systemic.filter((p) => p.system === label)];
    const lead = points.find((p) => p.halo) ?? points.find((p) => p.state === 'lit') ?? points[0] ?? null;
    return { label, short: whole ? WHOLE_BODY : place.short, regions, points, lead };
  });
}

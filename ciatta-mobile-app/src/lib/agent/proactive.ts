// The agent, active: the context it reads for every question, and the
// action cards it raises on its own when her record warrants one.
//
// Still the agent of types.ts: every card is built by code from her rows,
// carries the facts it rests on, and opens a screen in the app. A card
// prepares; she decides. Nothing here contacts anyone or diagnoses.

import type { Day } from '../../data/daily';
import type { Reported } from '../../data/repo';
import { fmtHours } from '../engine';
import type { Insurance } from '../insurance';
import { isOutside, type LabResult, labStatus } from '../labs';
import { type MedsView, medsView } from '../medsView';
import type { BaselineRow } from '../metricDetail';
import { nextAction, type Referral, stalled } from '../referrals';
import { type SymptomRow, symptomsView } from '../symptomsView';
import type { Fact } from './types';
import { type GutOut, gutOut } from '../gut';

export type Reading = {
  key: string;
  label: string;
  latest: string;
  on: string;
  usual: string | null;
  side: 'above' | 'below' | 'within' | null;
  daysOutside: number;
};

export type AgentContext = {
  readings: Reading[];
  labs: LabResult[];
  symptoms: SymptomRow[];
  meds: MedsView;
  insurance: Insurance | null;
  referrals: Referral[];
  // Logs she rated 8 or more in the last three days.
  severe: { on: string; what: string; severity: number }[];
  // Connected since: her latest blood pressure and blood oxygen, four weeks
  // of her gut, where she is in her cycle, her next care visit from her
  // calendar, and today's wearable readings as ranges.
  vitals: Vitals;
  gut: GutOut | null;
  cycle: { day: number; phase: string | null } | null;
  visit: { title: string; when: string; location: string | null } | null;
  today: { label: string; range: string }[];
};

export type Vitals = {
  bp: { systolic: number; diastolic: number; on: string } | null;
  spo2: { value: number; on: string } | null;
};

// The newest blood pressure pair (the top and bottom number taken together)
// and the newest blood oxygen, read as a percent.
export function latestVitals(rows: readonly { metric: string; value: number; at: string }[]): Vitals {
  const newest = (metric: string) => [...rows].filter((r) => r.metric === metric).sort((a, b) => b.at.localeCompare(a.at));
  const sys = newest('blood_pressure_systolic')[0];
  const dia = sys ? newest('blood_pressure_diastolic').find((r) => r.at === sys.at) ?? newest('blood_pressure_diastolic')[0] : undefined;
  const o2 = newest('oxygen_saturation')[0];
  const day = (at: string) => iso(new Date(at));
  return {
    bp: sys && dia ? { systolic: Math.round(sys.value), diastolic: Math.round(dia.value), on: day(sys.at) } : null,
    spo2: o2 ? { value: Math.round(o2.value <= 1 ? o2.value * 100 : o2.value), on: day(o2.at) } : null,
  };
}

// Blood pressure in the ACC/AHA 2017 bands, from the top and bottom number.
export function bpBand(bp: { systolic: number; diastolic: number }): 'crisis' | 'high' | 'raised' | 'usual' {
  if (bp.systolic >= 180 || bp.diastolic >= 120) return 'crisis';
  if (bp.systolic >= 140 || bp.diastolic >= 90) return 'high';
  if (bp.systolic >= 130 || bp.diastolic >= 80) return 'raised';
  return 'usual';
}

// The unit is said once, after a range: "55 to 68 bpm".
const METRICS: { key: string; label: string; get: (d: Day) => number | null; say: (v: number) => string; range: (lo: number, hi: number) => string }[] = [
  { key: 'sleep_hours', label: 'Sleep', get: (d) => d.sleepHours, say: (v) => fmtHours(v), range: (lo, hi) => `${fmtHours(lo)} to ${fmtHours(hi)}` },
  { key: 'hrv', label: 'HRV', get: (d) => d.hrv, say: (v) => `${Math.round(v)} ms`, range: (lo, hi) => `${Math.round(lo)} to ${Math.round(hi)} ms` },
  {
    key: 'resting_hr',
    label: 'Resting heart rate',
    get: (d) => d.restingHR,
    say: (v) => `${Math.round(v)} bpm`,
    range: (lo, hi) => `${Math.round(lo)} to ${Math.round(hi)} bpm`,
  },
  {
    key: 'steps',
    label: 'Steps',
    get: (d) => d.steps,
    say: (v) => Math.round(v).toLocaleString('en-US'),
    range: (lo, hi) => `${Math.round(lo).toLocaleString('en-US')} to ${Math.round(hi).toLocaleString('en-US')}`,
  },
];

const sideOf = (v: number, lo: number, hi: number) => (v < lo ? 'below' : v > hi ? 'above' : 'within');

// Each measured reading, its latest value, her usual range, and how many of
// her most recent measured days in a row sat outside it on the same side.
export function readingsStatus(days: readonly Day[], baselines: readonly BaselineRow[]): Reading[] {
  const out: Reading[] = [];
  for (const m of METRICS) {
    const measured = days.filter((d) => m.get(d) != null).sort((a, b) => b.date.localeCompare(a.date));
    if (!measured.length) continue;
    const latest = measured[0];
    const b = baselines.find((x) => x.metric === m.key && x.sufficient && x.low != null && x.high != null);
    const side = b ? sideOf(m.get(latest)!, b.low!, b.high!) : null;
    let daysOutside = 0;
    if (b && side !== 'within') {
      for (const d of measured) {
        if (sideOf(m.get(d)!, b.low!, b.high!) !== side) break;
        daysOutside += 1;
      }
    }
    out.push({
      key: m.key,
      label: m.label,
      latest: m.say(m.get(latest)!),
      on: latest.date,
      usual: b ? m.range(b.low!, b.high!) : null,
      side,
      daysOutside,
    });
  }
  return out;
}

type Signal = { date: Date; episode: { kinds: string[]; symptoms?: string[]; severity: number | null } };
type Log = { at?: string; category?: string; items?: Partial<Record<string, string[]>>; text: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function buildContext(input: {
  days: readonly Day[];
  baselines: readonly BaselineRow[];
  labs: readonly LabResult[];
  logs: readonly Log[];
  signals: readonly Signal[];
  reported: Reported | null;
  insurance: Insurance | null;
  referrals: readonly Referral[];
  now: Date;
  vitals?: Vitals;
  episodes?: readonly { date: string; kinds: string[]; stool: number | null; bowelPain: string | null; bowelFlags: string[] }[];
  cycle?: { day: number; phase: string | null } | null;
  visit?: { title: string; when: string; location: string | null } | null;
  today?: { label: string; range: string }[];
}): AgentContext {
  const since = input.now.getTime() - 3 * 86400000;
  return {
    readings: readingsStatus(input.days, input.baselines),
    labs: [...input.labs],
    symptoms: symptomsView({ signals: input.signals, logs: input.logs, days: input.days, now: input.now }).list,
    meds: medsView({ reported: input.reported, logs: input.logs, now: input.now }),
    insurance: input.insurance,
    referrals: [...input.referrals],
    severe: input.signals
      .filter((s) => s.episode.severity != null && s.episode.severity >= 8 && s.date.getTime() >= since)
      .map((s) => ({ on: iso(s.date), what: s.episode.kinds.includes('Pain') ? 'Pain' : (s.episode.symptoms?.[0] ?? 'A symptom'), severity: s.episode.severity! })),
    vitals: input.vitals ?? { bp: null, spo2: null },
    gut: input.episodes ? gutOut({ episodes: input.episodes, days: input.days, now: input.now }) : null,
    cycle: input.cycle ?? null,
    visit: input.visit ?? null,
    today: input.today ?? [],
  };
}

// ── Action cards ───────────────────────────────────────────────

export type CardKind = 'urgent' | 'lab' | 'reading' | 'symptom' | 'missed' | 'referral' | 'insurance' | 'vital' | 'gut' | 'visit';

export type ActionCard = {
  id: string;
  kind: CardKind;
  tone: 'urgent' | 'attention' | 'info';
  title: string;
  detail: string;
  facts: Fact[];
  action?: { label: string; screen: string; lab?: string; referral?: string };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

// The lines the cards and the visit prep share, so both say it the same way.
export function bpLine(bp: { systolic: number; diastolic: number; on: string }): string {
  const band = bpBand(bp);
  const where = band === 'crisis' ? 'in the crisis range' : band === 'high' ? 'in the high range' : band === 'raised' ? 'in the raised range' : 'in the usual range';
  return `Blood pressure ${bp.systolic}/${bp.diastolic} on ${short(bp.on)}, ${where}`;
}
export function spo2Line(o: { value: number; on: string }): string {
  return `Blood oxygen ${o.value}% on ${short(o.on)}${o.value < 95 ? ', under the typical 95 to 100%' : ''}`;
}
// Which way her logged movements lean, when enough carry a type.
export function stoolLean(g: GutOut): 'loose' | 'hard' | null {
  const rated = g.mix.hard + g.mix.typical + g.mix.loose;
  if (rated < 4) return null;
  if (g.mix.loose / rated > 0.5) return 'loose';
  if (g.mix.hard / rated > 0.5) return 'hard';
  return null;
}

export function interventions(c: AgentContext, now: Date, dismissed: ReadonlySet<string>): ActionCard[] {
  const cards: ActionCard[] = [];
  const month = iso(now).slice(0, 7);

  // Blood in stool comes first among the new ones: it is the one a
  // clinician should hear about whatever else is going on.
  if (c.gut?.blood) {
    cards.push({
      id: `gut:blood:${month}`,
      kind: 'gut',
      tone: 'urgent',
      title: `Blood with a bowel movement, logged ${c.gut.blood} ${c.gut.blood === 1 ? 'time' : 'times'} in 4 weeks`,
      detail: 'Blood in stool is worth raising with a clinician soon. If it is heavy, or you feel faint or dizzy, get care now.',
      facts: [{ label: 'Blood with a movement', value: `${c.gut.blood}`, from: 'reported' }],
      action: { label: 'Prepare for a visit', screen: 'visitPrep' },
    });
  }

  if (c.vitals.bp) {
    const band = bpBand(c.vitals.bp);
    if (band === 'crisis' || band === 'high') {
      cards.push({
        id: `vital:bp:${c.vitals.bp.on}`,
        kind: 'vital',
        tone: band === 'crisis' ? 'urgent' : 'attention',
        title: bpLine(c.vitals.bp),
        detail:
          band === 'crisis'
            ? 'A reading this high is worth checking again now. With chest pain, a severe headache, weakness or trouble speaking, get emergency care.'
            : 'One reading is a starting point. A few more, at rest and at the same time of day, show whether it holds.',
        facts: [{ label: 'Blood Pressure', value: `${c.vitals.bp.systolic}/${c.vitals.bp.diastolic}`, from: 'measured', on: c.vitals.bp.on }],
        action: { label: 'Prepare for a visit', screen: 'visitPrep' },
      });
    }
  }
  if (c.vitals.spo2 && c.vitals.spo2.value < 95) {
    cards.push({
      id: `vital:spo2:${c.vitals.spo2.on}`,
      kind: 'vital',
      tone: c.vitals.spo2.value < 90 ? 'urgent' : 'attention',
      title: spo2Line(c.vitals.spo2),
      detail:
        c.vitals.spo2.value < 90
          ? 'If you are short of breath, confused or your lips look blue, get care now.'
          : 'A watch reading can dip with movement or a loose fit. If it stays low at rest, it is worth raising.',
      facts: [{ label: 'Blood Oxygen', value: `${c.vitals.spo2.value}%`, from: 'measured', on: c.vitals.spo2.on }],
      action: { label: 'Prepare for a visit', screen: 'visitPrep' },
    });
  }
  const lean = c.gut ? stoolLean(c.gut) : null;
  if (c.gut && lean) {
    cards.push({
      id: `gut:form:${lean}:${month}`,
      kind: 'gut',
      tone: 'info',
      title: `Most of your logged movements were ${lean}`,
      detail: lean === 'loose' ? 'Bristol types 5 to 7, over the last 4 weeks.' : 'Bristol types 1 and 2, over the last 4 weeks.',
      facts: [{ label: lean === 'loose' ? 'Loose' : 'Hard', value: `${c.gut.mix[lean]}`, from: 'reported' }],
      action: { label: 'See your gut', screen: 'gut' },
    });
  }
  if (c.visit) {
    cards.push({
      id: `visit:${c.visit.title}:${c.visit.when}`,
      kind: 'visit',
      tone: 'info',
      title: `Prepare for ${c.visit.title}`,
      detail: `${c.visit.when}. A summary from your record, with the questions worth asking.`,
      facts: [{ label: 'Visit', value: c.visit.title, from: 'reported' }],
      action: { label: 'Open your visit prep', screen: 'visitPrep' },
    });
  }

  for (const s of c.severe) {
    cards.push({
      id: `urgent:${s.on}:${s.what}`,
      kind: 'urgent',
      tone: 'urgent',
      title: `You rated ${s.what.toLowerCase()} ${s.severity} of 10 on ${short(s.on)}`,
      detail: 'If it is this severe again, or you faint, bleed heavily or cannot stand, get care now: urgent care, or emergency services.',
      facts: [{ label: s.what, value: `${s.severity} of 10`, from: 'reported', on: s.on }],
    });
  }

  // The latest result of each test in the last 90 days that sat outside
  // its range.
  const since = iso(new Date(now.getTime() - 90 * 86400000));
  const latest = new Map<string, LabResult>();
  for (const l of c.labs) {
    if (l.on < since) continue;
    const k = l.name.toLowerCase();
    if (!latest.has(k) || latest.get(k)!.on < l.on) latest.set(k, l);
  }
  for (const l of latest.values()) {
    if (!isOutside(l)) continue;
    const status = labStatus(l);
    cards.push({
      id: `lab:${l.name.toLowerCase()}:${l.on}`,
      kind: 'lab',
      tone: status.key.startsWith('critical') ? 'urgent' : 'attention',
      title: `${l.name} was ${status.label.toLowerCase()} on ${short(l.on)}`,
      detail: l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}${l.rangeText ? ` against the lab's range of ${l.rangeText}` : ''}.` : `${l.valueText ?? ''}, as the lab flagged it.`,
      facts: [
        { label: l.name, value: l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}` : (l.valueText ?? ''), from: 'measured', on: l.on },
        ...(l.rangeText ? [{ label: 'Lab range', value: l.rangeText, from: 'measured' as const }] : []),
      ],
      action: { label: 'Decode this lab', screen: 'labBrief', lab: l.name },
    });
  }

  for (const r of c.readings) {
    if (r.daysOutside < 3 || (r.side !== 'above' && r.side !== 'below')) continue;
    cards.push({
      id: `reading:${r.key}:${r.on}`,
      kind: 'reading',
      tone: 'attention',
      title: `${r.label} ${r.side} your usual for ${r.daysOutside} days`,
      detail: `Latest ${r.latest} on ${short(r.on)}, against your usual ${r.usual}.`,
      facts: [
        { label: r.label, value: r.latest, from: 'measured', on: r.on },
        { label: 'Your usual', value: r.usual ?? '', from: 'derived' },
      ],
      action: { label: 'Prepare for a visit', screen: 'visitPrep' },
    });
  }

  for (const s of c.symptoms) {
    if (!s.versus?.startsWith('More often') || s.days < 3) continue;
    cards.push({
      id: `symptom:${s.name.toLowerCase()}:${month}`,
      kind: 'symptom',
      tone: 'info',
      title: `${s.name} more often than last month`,
      detail: `Logged on ${s.days} days in the last 90, most recently ${s.last}.`,
      facts: [{ label: s.name, value: `${s.days} days`, from: 'reported' }],
      action: { label: 'Add to visit questions', screen: 'visitPrep' },
    });
  }

  const missed = c.meds.month.find((m) => m.label === 'Missed a dose');
  if (missed && missed.days >= 3) {
    cards.push({
      id: `missed:${month}`,
      kind: 'missed',
      tone: 'info',
      title: `${missed.days} missed doses in the last 30 days`,
      detail: 'Worth raising with whoever prescribes it: a different time or form can make it easier.',
      facts: [{ label: 'Missed a dose', value: `${missed.days} days`, from: 'reported' }],
      action: { label: 'Note it for your visit', screen: 'visitPrep' },
    });
  }

  for (const r of c.referrals) {
    const days = stalled(r, now);
    if (days == null) continue;
    const next = nextAction(r, !!c.insurance);
    cards.push({
      id: `referral:${r.id}:${next?.step ?? 'done'}`,
      kind: 'referral',
      tone: 'attention',
      title: `Your ${r.specialty} referral has not moved in ${days} days`,
      detail: next?.text ?? '',
      facts: [{ label: 'Referral', value: r.specialty, from: 'reported' }],
      action: { label: 'Follow up', screen: 'referral', referral: r.id },
    });
  }

  if (c.referrals.some((r) => !r.steps.seen) && !c.insurance) {
    cards.push({
      id: 'insurance',
      kind: 'insurance',
      tone: 'info',
      title: 'Add your insurance',
      detail: 'You are tracking a referral. Checking whether it is covered starts with your insurer and plan.',
      facts: [],
      action: { label: 'Add insurance', screen: 'insurance' },
    });
  }

  return cards.filter((c2) => !dismissed.has(c2.id));
}


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
};

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
  };
}

// ── Action cards ───────────────────────────────────────────────

export type CardKind = 'urgent' | 'lab' | 'reading' | 'symptom' | 'missed' | 'referral' | 'insurance';

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

export function interventions(c: AgentContext, now: Date, dismissed: ReadonlySet<string>): ActionCard[] {
  const cards: ActionCard[] = [];
  const month = iso(now).slice(0, 7);

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


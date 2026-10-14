// Your Care: the plan she has open, what happened lately, the requests she
// is making of her own clinicians, her prescriptions, and her care team.
//
// Ciatta has no clinicians of its own. Her care team is the people already
// in her record (her providers, her referrals, the visits on her calendar)
// and the ones she adds. A request is drafted here from her record and
// sent by her, through her clinician's portal or by phone; Ciatta never
// contacts anyone and never prescribes.

export type RequestKind = 'refill' | 'labs' | 'records' | 'question' | 'referral';
export type RequestStatus = 'draft' | 'sent' | 'answered' | 'closed';

export type CareRequest = {
  id: string;
  kind: RequestKind;
  title: string;
  body: string;
  clinician: string | null;
  status: RequestStatus;
  sentOn: string | null;
  answeredOn: string | null;
  createdAt: string;
};

export type ClinicianRow = {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type Clinician = ClinicianRow & { source: 'added' | 'referral' | 'visit' | 'provider'; initials: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const listed = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const TITLE = /^(dr|dr\.|doctor|prof|prof\.)$/i;
const initials = (name: string) => {
  const words = name.split(/\s+/).filter((w) => w && !TITLE.test(w));
  return [words[0], words.length > 1 ? words[words.length - 1] : undefined]
    .filter((w): w is string => !!w)
    .map((w) => w[0].toUpperCase())
    .join('');
};

// A clinician's name as she enters it: first and last.
export const clinicianName = (first: string, last: string) => [first.trim(), last.trim()].filter(Boolean).join(' ');

// The same name split back for editing; a title is set aside.
export function splitName(name: string): { first: string; last: string } {
  const words = name.split(/\s+/).filter((w) => w && !TITLE.test(w));
  return { first: words[0] ?? '', last: words.slice(1).join(' ') };
}

// ── Care team ──────────────────────────────────────────────────

const DR = /\bdr\.?\s+([a-z][a-z'-]+)/i;
const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export function careTeam(input: {
  added: readonly ClinicianRow[];
  providers: readonly { organization: string | null }[];
  referrals: readonly { specialty: string; clinician: string | null; referredBy: string | null }[];
  // The titles of care visits on her calendar.
  visits: readonly string[];
}): Clinician[] {
  const out: Clinician[] = [];
  const has = (name: string) => out.some((c) => c.name.toLowerCase() === name.toLowerCase());
  const add = (c: Omit<Clinician, 'initials'>) => {
    if (!has(c.name)) out.push({ ...c, initials: initials(c.name) });
  };
  const blank = { organization: null, phone: null, email: null, notes: null };
  for (const c of input.added) add({ ...c, source: 'added' });
  for (const r of input.referrals) {
    if (r.clinician) add({ id: `ref:${r.clinician}`, name: r.clinician, role: r.specialty, ...blank, source: 'referral' });
    if (r.referredBy) add({ id: `ref:${r.referredBy}`, name: r.referredBy, role: null, ...blank, source: 'referral' });
  }
  for (const v of input.visits) {
    const m = DR.exec(v);
    if (m) add({ id: `visit:${m[1].toLowerCase()}`, name: `Dr ${titleCase(m[1])}`, role: null, ...blank, source: 'visit' });
  }
  for (const p of input.providers) {
    const org = p.organization?.trim();
    if (!org || out.some((c) => c.organization?.toLowerCase() === org.toLowerCase())) continue;
    add({ id: `org:${org}`, name: org, role: 'Provider', ...blank, organization: org, source: 'provider' });
  }
  return out;
}

// ── Prescriptions ──────────────────────────────────────────────

export function prescriptions(input: {
  reported: readonly string[];
  clinical: readonly { kind: string; name: string; effectiveOn: string | null }[];
  // What she logged taking, by name, with the last day.
  logged: readonly { name: string; last: string | null; days: number }[];
  missed: number;
}): { items: { name: string; from: 'Provider' | 'You'; last: string | null }[]; missed: number } {
  const lastFor = (name: string) => input.logged.find((l) => name.toLowerCase().includes(l.name.toLowerCase()))?.last ?? null;
  const items: { name: string; from: 'Provider' | 'You'; last: string | null }[] = [];
  for (const c of input.clinical) if (c.kind === 'medication') items.push({ name: c.name, from: 'Provider', last: lastFor(c.name) });
  for (const r of input.reported) {
    if (items.some((i) => i.name.toLowerCase().includes(r.toLowerCase()))) continue;
    items.push({ name: r, from: 'You', last: lastFor(r) });
  }
  return { items, missed: input.missed };
}

// ── Requests ───────────────────────────────────────────────────

export function draftRequest(
  kind: RequestKind,
  ctx: {
    name: string | null;
    clinician: string | null;
    medication?: string;
    last?: string | null;
    tests?: string[];
    reasons?: string[];
    specialty?: string;
    question?: string;
  },
): { title: string; body: string } {
  const hello = `Hello${ctx.clinician && kind !== 'records' && kind !== 'labs' ? ` ${ctx.clinician}` : ''},\n\n`;
  const bye = `\n\nThank you,${ctx.name ? `\n${ctx.name}` : ''}`;
  switch (kind) {
    case 'refill':
      return {
        title: `Refill: ${ctx.medication}`,
        body: `${hello}I would like to request a refill of ${ctx.medication}.${ctx.last ? ` I last took it on ${ctx.last}.` : ''}${bye}`,
      };
    case 'labs': {
      const tests = listed(ctx.tests ?? []);
      return {
        title: `Labs: ${tests}`,
        body: `${hello}I would like to ask about checking ${tests}.${ctx.reasons?.length ? ` I have logged ${ctx.reasons.join('; ')}.` : ''} Could we talk about whether these are worth doing?${bye}`,
      };
    }
    case 'records':
      return {
        title: `Records request: ${ctx.clinician ?? 'my provider'}`,
        body: `${hello}I would like a copy of my recent visit notes and test results, sent to my patient portal if possible.${bye}`,
      };
    case 'referral':
      return {
        title: `Referral: ${ctx.specialty}`,
        body: `${hello}I would like to ask about a referral to ${ctx.specialty}, and what I should do next.${bye}`,
      };
    case 'question':
      return {
        title: `Question${ctx.clinician ? ` for ${ctx.clinician}` : ''}`,
        body: `${hello}${ctx.question ?? ''}${bye}`,
      };
  }
}

export function openRequests(requests: readonly CareRequest[]): CareRequest[] {
  return requests.filter((r) => r.status === 'draft' || r.status === 'sent').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const STATUS_LABEL: Record<RequestStatus, string> = { draft: 'Draft', sent: 'Sent', answered: 'Answered', closed: 'Closed' };

// ── Open plan ──────────────────────────────────────────────────

export type PlanStep = { id: string; title: string; sub: string | null; screen: string; lab?: string; referral?: string };

export function openPlan(input: {
  cards: readonly { id: string; title: string; action?: { label: string; screen: string; lab?: string; referral?: string } }[];
  referrals: readonly { id: string; specialty: string; next: string | null }[];
  visit: { title: string; when: string } | null;
  requests: number;
}): PlanStep[] {
  const out: PlanStep[] = [];
  if (input.visit) out.push({ id: 'visit', title: `Prepare for ${input.visit.title}`, sub: input.visit.when, screen: 'visitPrep' });
  for (const c of input.cards) {
    if (!c.action) continue;
    out.push({ id: c.id, title: c.title, sub: c.action.label, screen: c.action.screen, lab: c.action.lab, referral: c.action.referral });
  }
  for (const r of input.referrals) {
    if (!r.next) continue;
    out.push({ id: `ref:${r.id}`, title: `${r.specialty} referral`, sub: r.next, screen: 'referral', referral: r.id });
  }
  if (input.requests) {
    out.push({ id: 'requests', title: `Follow up on ${input.requests} open ${input.requests === 1 ? 'request' : 'requests'}`, sub: null, screen: 'careRequests' });
  }
  return out.slice(0, 5);
}

// ── Latest activity ────────────────────────────────────────────

export type Activity = { at: number; title: string; when: string; icon: string };

const STEP_DONE: Record<string, string> = {
  referred: 'referred',
  insurance: 'insurance checked',
  requested: 'appointment requested',
  scheduled: 'scheduled',
  seen: 'seen',
};
const NOT_SYMPTOMS = ['meds', 'supplements', 'note', 'context', 'nutrition'];

export function latestActivity(input: {
  labs: readonly { name: string; on: string; source: string }[];
  logs: readonly { at?: string; items?: Partial<Record<string, string[]>> }[];
  episodes: readonly { date: string; kinds: string[] }[];
  meals: readonly { eatenAt: string }[];
  requests: readonly { title: string; status: RequestStatus; sentOn: string | null; createdAt: string }[];
  referrals: readonly { specialty: string; steps: Partial<Record<string, string>> }[];
  now: Date;
}): Activity[] {
  const out: Omit<Activity, 'when'>[] = [];
  const draws = new Map<string, { n: number; source: string; name: string; on: string }>();
  for (const l of input.labs) {
    const k = `${l.on}|${l.source}`;
    const was = draws.get(k);
    draws.set(k, { n: (was?.n ?? 0) + 1, source: l.source, name: l.name, on: l.on });
  }
  for (const d of draws.values()) {
    const where = d.source === 'provider' ? 'arrived from your provider' : 'added from a report';
    out.push({ at: parseDay(d.on).getTime(), title: d.n === 1 ? `${d.name} result ${where}` : `${d.n} lab results ${where}`, icon: 'flask' });
  }
  for (const log of input.logs) {
    if (!log.at || !log.items) continue;
    const items = Object.entries(log.items)
      .filter(([cat]) => !NOT_SYMPTOMS.includes(cat))
      .flatMap(([, xs]) => xs ?? []);
    if (items.length) out.push({ at: Date.parse(log.at), title: `Logged ${listed(items.slice(0, 2).map((x) => x.toLowerCase()))}`, icon: 'body' });
  }
  for (const e of input.episodes) if (e.kinds.length) out.push({ at: parseDay(e.date).getTime(), title: `Logged ${e.kinds[0].toLowerCase()}`, icon: 'drop' });
  for (const m of input.meals) out.push({ at: Date.parse(m.eatenAt), title: 'Logged a meal', icon: 'utensils' });
  for (const r of input.requests) {
    if (r.status === 'draft') out.push({ at: Date.parse(r.createdAt), title: `Drafted: ${r.title}`, icon: 'doc' });
    else if (r.sentOn) out.push({ at: parseDay(r.sentOn).getTime(), title: `${r.status === 'sent' ? 'Sent' : r.status === 'answered' ? 'Answered' : 'Closed'}: ${r.title}`, icon: 'send' });
  }
  for (const r of input.referrals) {
    const latest = Object.entries(r.steps).filter((x): x is [string, string] => !!x[1]).sort((a, b) => b[1].localeCompare(a[1]))[0];
    if (latest) out.push({ at: parseDay(latest[1]).getTime(), title: `${r.specialty} referral: ${STEP_DONE[latest[0]] ?? latest[0]}`, icon: 'people' });
  }
  const today = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  return out
    .filter((x) => Number.isFinite(x.at) && x.at <= input.now.getTime() + 86400000)
    .sort((a, b) => b.at - a.at)
    .slice(0, 6)
    .map((x) => {
      const d = new Date(x.at);
      const days = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
      return { ...x, when: days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${d.getDate()} ${MONTHS[d.getMonth()]}` };
    });
}

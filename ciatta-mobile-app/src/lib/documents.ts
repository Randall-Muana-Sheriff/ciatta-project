// Any medical document, as the app reads, checks and files it.
//
// The document-scan function copies out what a document says. These rules
// check that answer, show each item where it will be filed, match items to
// what she already has, and build what save_document writes. Pure, so every
// rule is tested. Nothing is filed without her check, and nothing is
// inferred: an item is here only because the document says it.

export type DocType = 'lab_report' | 'visit' | 'imaging' | 'pathology' | 'prescription' | 'referral' | 'insurance' | 'other';
const DOC_TYPES: DocType[] = ['lab_report', 'visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'other'];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  lab_report: 'Lab report',
  visit: 'Visit summary',
  imaging: 'Imaging report',
  pathology: 'Pathology report',
  prescription: 'Prescription or medication list',
  referral: 'Referral',
  insurance: 'Insurance card',
  other: 'Other document',
};

export type DocMed = { name: string; strength: string | null; dose: string | null; frequency: string | null; route: string | null; prescriber: string | null; date: string | null };

export type DocumentScan = {
  notMedical: boolean;
  docType: DocType;
  title: string | null;
  date: string | null;
  clinician: string | null;
  facility: string | null;
  multipleDates: boolean;
  unreadablePages: number[];
  visit: {
    reason: string | null;
    diagnoses: { name: string; status: 'new' | 'existing' | 'unclear' }[];
    medicationsStarted: DocMed[];
    medicationsStopped: DocMed[];
    medicationsChanged: DocMed[];
    procedures: { name: string; date: string | null }[];
    followUps: { specialty: string; clinician: string | null; reason: string | null; when: string | null }[];
    instructions: string[];
    allergies: { substance: string; reaction: string | null }[];
  } | null;
  report: { study: string | null; bodySite: string | null; findings: string | null; impression: string | null; namedConditions: string[] } | null;
  prescription: { medications: DocMed[] } | null;
  referral: { specialty: string | null; clinician: string | null; reason: string | null; referredBy: string | null } | null;
  insurance: { provider: string | null; plan: string | null; memberId: string | null } | null;
  other: { description: string | null } | null;
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const day = (v: unknown) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map(str).filter((x): x is string => !!x);

function readMed(v: unknown): DocMed | null {
  const m = obj(v);
  const name = m ? str(m.name) : null;
  if (!m || !name) return null;
  return { name, strength: str(m.strength), dose: str(m.dose), frequency: str(m.frequency), route: str(m.route), prescriber: str(m.prescriber), date: day(m.date) };
}
const meds = (v: unknown) => arr(v).map(readMed).filter((x): x is DocMed => !!x);

export function readDocumentScan(json: unknown): DocumentScan {
  const j = obj(json) ?? {};
  const t = str(j.doc_type) as DocType | null;
  const docType: DocType = t && DOC_TYPES.includes(t) ? t : 'other';
  const v = obj(j.visit);
  const r = obj(j.report);
  const p = obj(j.prescription);
  const ref = obj(j.referral);
  const ins = obj(j.insurance);
  const o = obj(j.other);
  const pages = arr(j.unreadable_pages).filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1);
  return {
    notMedical: j.not_medical === true || !obj(json),
    docType,
    title: str(j.title),
    date: day(j.date),
    clinician: str(j.clinician),
    facility: str(j.facility),
    multipleDates: j.multiple_dates === true,
    unreadablePages: [...new Set(pages)].sort((a, b) => a - b),
    visit: v
      ? {
          reason: str(v.reason),
          diagnoses: arr(v.diagnoses)
            .map((d) => obj(d))
            .filter((d): d is Record<string, unknown> => !!d && !!str(d.name))
            .map((d) => ({ name: str(d.name)!, status: d.status === 'new' || d.status === 'existing' ? d.status : 'unclear' })),
          medicationsStarted: meds(v.medications_started),
          medicationsStopped: meds(v.medications_stopped),
          medicationsChanged: meds(v.medications_changed),
          procedures: arr(v.procedures)
            .map((x) => obj(x))
            .filter((x): x is Record<string, unknown> => !!x && !!str(x.name))
            .map((x) => ({ name: str(x.name)!, date: day(x.date) })),
          followUps: arr(v.follow_ups)
            .map((x) => obj(x))
            .filter((x): x is Record<string, unknown> => !!x && !!str(x.specialty))
            .map((x) => ({ specialty: str(x.specialty)!, clinician: str(x.clinician), reason: str(x.reason), when: str(x.when) })),
          instructions: strs(v.instructions),
          allergies: arr(v.allergies)
            .map((x) => obj(x))
            .filter((x): x is Record<string, unknown> => !!x && !!str(x.substance))
            .map((x) => ({ substance: str(x.substance)!, reaction: str(x.reaction) })),
        }
      : null,
    report: r ? { study: str(r.study), bodySite: str(r.body_site), findings: str(r.findings), impression: str(r.impression), namedConditions: strs(r.named_conditions) } : null,
    prescription: p ? { medications: meds(p.medications) } : null,
    referral: ref ? { specialty: str(ref.specialty), clinician: str(ref.clinician), reason: str(ref.reason), referredBy: str(ref.referred_by) } : null,
    insurance: ins ? { provider: str(ins.provider), plan: str(ins.plan), memberId: str(ins.member_id) } : null,
    other: o ? { description: str(o.description) } : null,
  };
}

export const foldName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export type Existing = {
  conditions: { id: string; name: string }[];
  medications: { id: string; name: string; stoppedOn: string | null }[];
};

export type Target = 'conditions' | 'allergies' | 'medications' | 'stop_medications' | 'procedures' | 'referrals' | 'insurance';

export const TARGET_HEADING: Record<Target, string> = {
  conditions: 'Adds to Conditions',
  allergies: 'Adds to Allergies',
  medications: 'Adds to Medications',
  stop_medications: 'Marks as stopped in Medications',
  procedures: 'Adds to Procedures',
  referrals: 'Adds to Referrals',
  insurance: 'Updates Health Plans',
};

export type ReviewItem = {
  key: string;
  target: Target;
  title: string;
  detail: string | null;
  keep: boolean;
  existingId: string | null;
  value: Record<string, string | null>;
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;

export function reviewItems(scan: DocumentScan, existing: Existing): ReviewItem[] {
  const items: ReviewItem[] = [];
  let n = 0;
  const push = (target: Target, title: string, detail: string | null, value: Record<string, string | null>, existingId: string | null = null) =>
    items.push({ key: `i${n++}`, target, title, detail, keep: true, existingId, value });
  const condition = (name: string) => existing.conditions.find((c) => foldName(c.name) === foldName(name))?.id ?? null;
  const medication = (name: string) => existing.medications.find((m) => foldName(m.name) === foldName(name) && !m.stoppedOn)?.id ?? null;
  const addMed = (m: DocMed) =>
    push('medications', m.name, join(m.strength, m.dose, m.frequency, m.route), { ...m, name: m.name }, medication(m.name));

  const v = scan.visit;
  if (v) {
    for (const d of v.diagnoses) push('conditions', d.name, d.status === 'new' ? 'New diagnosis' : null, { name: d.name, status: d.status }, condition(d.name));
    for (const a of v.allergies) push('allergies', a.substance, a.reaction, { name: a.substance, reaction: a.reaction });
    for (const m of [...v.medicationsStarted, ...v.medicationsChanged]) addMed(m);
    for (const m of v.medicationsStopped) push('stop_medications', m.name, join(m.strength, m.dose), { ...m, name: m.name }, medication(m.name));
    for (const p of v.procedures) push('procedures', p.name, p.date, { name: p.name, date: p.date });
    for (const f of v.followUps) push('referrals', f.specialty, join(f.clinician, f.reason, f.when), { specialty: f.specialty, clinician: f.clinician, reason: f.reason, when: f.when, referredBy: scan.clinician });
  }
  if (scan.report) for (const c of scan.report.namedConditions) push('conditions', c, 'Named in the report', { name: c, status: 'unclear' }, condition(c));
  if (scan.prescription) for (const m of scan.prescription.medications) addMed(m);
  if (scan.referral?.specialty) {
    const r = scan.referral;
    push('referrals', r.specialty!, join(r.clinician, r.reason), { specialty: r.specialty, clinician: r.clinician, reason: r.reason, referredBy: r.referredBy });
  }
  if (scan.insurance?.provider) {
    const i = scan.insurance;
    push('insurance', i.provider!, join(i.plan, i.memberId ? `Member ${i.memberId}` : null), { provider: i.provider, plan: i.plan, memberId: i.memberId });
  }
  return items;
}

export type DocumentFilings = {
  conditions: { name: string; status: 'active' | 'unknown' }[];
  allergies: { name: string; reaction: string | null }[];
  medications: { name: string; dose: string | null; started_on: string | null; stopped_on: string | null; route: string | null; prescriber: string | null }[];
  stop_medications: { id: string }[];
  procedures: { name: string; performed_on: string | null }[];
  referrals: { specialty: string; clinician: string | null; reason: string | null; referred_by: string | null; referred_on: string | null }[];
  linked: { table: string; id: string }[];
};

// What save_document writes. New items are added; items she already has
// are linked; a medication the document stops is stopped if she has it,
// or added already stopped if she does not.
export function buildFilings(items: ReviewItem[], docDate: string | null): DocumentFilings {
  const f: DocumentFilings = { conditions: [], allergies: [], medications: [], stop_medications: [], procedures: [], referrals: [], linked: [] };
  for (const i of items.filter((x) => x.keep && x.title.trim())) {
    const v = i.value;
    const name = (v.name ?? i.title).trim();
    switch (i.target) {
      case 'conditions':
        if (i.existingId) f.linked.push({ table: 'conditions', id: i.existingId });
        else f.conditions.push({ name, status: v.status === 'new' ? 'active' : 'unknown' });
        break;
      case 'allergies':
        f.allergies.push({ name, reaction: v.reaction ?? null });
        break;
      case 'medications':
        if (i.existingId) f.linked.push({ table: 'medications', id: i.existingId });
        else f.medications.push({ name, dose: join(v.strength, v.dose, v.frequency), started_on: v.date ?? docDate, stopped_on: null, route: v.route ?? null, prescriber: v.prescriber ?? null });
        break;
      case 'stop_medications':
        if (i.existingId) {
          f.stop_medications.push({ id: i.existingId });
          f.linked.push({ table: 'medications', id: i.existingId });
        } else {
          f.medications.push({ name, dose: join(v.strength, v.dose), started_on: null, stopped_on: docDate, route: v.route ?? null, prescriber: v.prescriber ?? null });
        }
        break;
      case 'procedures':
        f.procedures.push({ name, performed_on: v.date ?? docDate });
        break;
      case 'referrals':
        f.referrals.push({ specialty: (v.specialty ?? i.title).trim(), clinician: v.clinician ?? null, reason: v.reason ?? null, referred_by: v.referredBy ?? null, referred_on: docDate });
        break;
    }
  }
  return f;
}

export function insuranceFrom(items: ReviewItem[]): { provider: string; plan: string | null; member_id: string | null } | null {
  const i = items.find((x) => x.target === 'insurance' && x.keep);
  if (!i || !i.value.provider) return null;
  return { provider: i.value.provider, plan: i.value.plan ?? null, member_id: i.value.memberId ?? null };
}

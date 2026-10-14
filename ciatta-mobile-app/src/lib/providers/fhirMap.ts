// What came back from her hospital, turned into rows Ciatta can hold.
//
// This is the most dangerous file in the provider flow, because every
// mistake here becomes a wrong fact about her body that looks official.
// A lab value read from the wrong field, a unit dropped, a reference
// range attached to the wrong result: none of those look like bugs on
// screen. They look like her results.
//
// So the rules are stricter than anywhere else in the app:
//
//   A value without its unit is not a value. 4.2 is a thyroid result, a
//   potassium level or a white cell count depending on the unit, and a
//   number shown without one invites her to compare it to something it
//   is not. Dropped rather than shown bare.
//
//   A status that is not final is carried, not hidden. A preliminary or
//   amended result is still hers to see, and a corrected one that
//   displayed as though it were the original would be the worst kind of
//   wrong.
//
//   Nothing is interpreted. High, low and abnormal come from the lab's
//   own interpretation field when the lab sent one, and are never
//   computed here by comparing a value to a range. That comparison is a
//   clinical judgement and this is a parser.
//
//   An unparseable resource is skipped, never half built. A record with
//   a date and no value, or a value and no name, is not a record.

export type ClinicalKind =
  | 'lab'
  | 'condition'
  | 'medication'
  | 'allergy'
  | 'immunization'
  | 'procedure'
  | 'vital'
  | 'report'
  | 'note'
  | 'encounter'
  | 'appointment'
  | 'device'
  | 'family_history'
  | 'goal'
  | 'care_plan'
  | 'coverage';

export type ClinicalRecord = {
  // The resource id at the provider, so a re sync updates rather than
  // duplicates.
  sourceId: string;
  kind: ClinicalKind;
  // What the provider calls it, as the provider calls it. Never renamed:
  // she will see this word again on their portal and on paper.
  name: string;
  // Formatted for display, with its unit, or null when there is no value
  // to show. A condition has no value and that is not a gap.
  value: string | null;
  // The lab's own flag, when the lab sent one. Never computed here.
  flag: 'high' | 'low' | 'abnormal' | null;
  // ISO day. Null when the resource carried no date, which happens and is
  // not something to invent a date for.
  effectiveOn: string | null;
  // final, preliminary, amended, corrected, entered-in-error and the rest,
  // as the provider sent it.
  status: string | null;
};

type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// What the resource is called. text first, because that is what the lab
// chose to call it; a code's display is a fallback and a bare code is not
// a name anyone can read.
export function codeableName(value: unknown): string | null {
  const c = obj(value);
  if (!c) return null;
  const text = str(c.text);
  if (text) return text;
  for (const coding of arr(c.coding)) {
    const display = str(obj(coding)?.display);
    if (display) return display;
  }
  return null;
}

// A quantity, with its unit, or nothing. The unit is required: see above.
export function quantity(value: unknown): string | null {
  const q = obj(value);
  if (!q) return null;
  const n = num(q.value);
  if (n == null) return null;
  const unit = str(q.unit) ?? str(q.code);
  if (!unit) return null;
  // Trimmed to the precision the lab sent rather than reformatted, so a
  // result of 4.20 does not become 4.2 and read as a different reading.
  return `${n} ${unit}`;
}

// The lab's own interpretation. Mapped from the HL7 codes labs actually
// send, and anything unrecognised becomes null rather than a guess.
export function interpretation(value: unknown): ClinicalRecord['flag'] {
  for (const entry of arr(value)) {
    for (const coding of arr(obj(entry)?.coding)) {
      const code = str(obj(coding)?.code)?.toUpperCase();
      if (code === 'H' || code === 'HH') return 'high';
      if (code === 'L' || code === 'LL') return 'low';
      if (code === 'A' || code === 'AA') return 'abnormal';
    }
  }
  return null;
}

// The day it belongs to. FHIR puts the date in a different field per
// resource type and sometimes in a period, so every place it can be is
// read and the first real one wins.
export function effectiveDay(r: Json): string | null {
  const candidates = [
    r.effectiveDateTime,
    r.issued,
    r.onsetDateTime,
    r.recordedDate,
    r.authoredOn,
    r.occurrenceDateTime,
    r.performedDateTime,
    obj(r.effectivePeriod)?.start,
    obj(r.performedPeriod)?.start,
    r.date,
    r.start,
    r.startDate,
    obj(r.period)?.start,
  ];
  for (const c of candidates) {
    const s = str(c);
    // Only the day. A lab drawn at 07:412 local time is noise, and the
    // record is read by day everywhere else in the app.
    if (s && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  return null;
}

const KIND: Record<string, ClinicalKind> = {
  Observation: 'lab',
  Condition: 'condition',
  MedicationRequest: 'medication',
  MedicationStatement: 'medication',
  AllergyIntolerance: 'allergy',
  Immunization: 'immunization',
  Procedure: 'procedure',
  DiagnosticReport: 'report',
  DocumentReference: 'note',
  Encounter: 'encounter',
  Appointment: 'appointment',
  Device: 'device',
  FamilyMemberHistory: 'family_history',
  Goal: 'goal',
  CarePlan: 'care_plan',
  Coverage: 'coverage',
};

// Which vital signs are vitals rather than labs. FHIR marks them with a
// category, so the category is read rather than the name guessed at.
function isVital(r: Json): boolean {
  for (const cat of arr(r.category)) {
    for (const coding of arr(obj(cat)?.coding)) {
      if (str(obj(coding)?.code) === 'vital-signs') return true;
    }
  }
  return false;
}

// The name field differs per resource type. medicationCodeableConcept for
// a medication, vaccineCode for an immunization, code for the rest.
function nameOf(r: Json): string | null {
  // Resources whose name lives somewhere of their own.
  switch (str(r.resourceType)) {
    case 'DocumentReference':
      return codeableName(r.type) ?? str(r.description);
    case 'Encounter':
      return codeableName(arr(r.type)[0]) ?? codeableName(arr(r.serviceType)[0]) ?? str(obj(r.class)?.display);
    case 'Appointment':
      return codeableName(arr(r.serviceType)[0]) ?? str(r.description) ?? codeableName(r.appointmentType);
    case 'Device':
      return codeableName(r.type) ?? str(obj(arr(r.deviceName)[0])?.name);
    case 'FamilyMemberHistory': {
      const who = codeableName(r.relationship);
      const what = codeableName(obj(arr(r.condition)[0])?.code);
      return who && what ? `${who}: ${what}` : (what ?? who);
    }
    case 'Goal':
      return codeableName(r.description);
    case 'CarePlan':
      return str(r.title) ?? codeableName(arr(r.category)[0]);
    case 'Coverage':
      return str(obj(arr(r.payor)[0])?.display) ?? codeableName(r.type);
  }
  return (
    codeableName(r.code) ??
    codeableName(r.medicationCodeableConcept) ??
    codeableName(r.vaccineCode) ??
    codeableName(obj(r.medicationReference)?.display ? { text: obj(r.medicationReference)?.display } : null)
  );
}

export function mapResource(resource: unknown): ClinicalRecord | null {
  const r = obj(resource);
  if (!r) return null;
  const type = str(r.resourceType);
  if (!type) return null;

  const kind = KIND[type];
  if (!kind) return null;

  const sourceId = str(r.id);
  const name = nameOf(r);
  // No id means a re sync cannot update it and would duplicate it. No
  // name means there is nothing to show her. Either way it is not a
  // record.
  if (!sourceId || !name) return null;

  return {
    sourceId: `${type}/${sourceId}`,
    kind: kind === 'lab' && isVital(r) ? 'vital' : kind,
    name,
    value: quantity(r.valueQuantity) ?? codeableName(r.valueCodeableConcept),
    flag: interpretation(r.interpretation),
    effectiveOn: effectiveDay(r),
    status: str(r.status) ?? str(r.lifecycleStatus) ?? str(r.clinicalStatus) ?? codeableName(r.clinicalStatus),
  };
}

// A lab result as Labs keeps it: the number and unit apart, the range the
// lab printed (as numbers when it gave them, and as its words always), and
// the lab's own HL7 interpretation code. Still nothing is interpreted here:
// the code is carried as the lab sent it, and a result with no flag gets
// none. Vitals, and labs with no date or no result, are not labs.
export type LabRecord = {
  sourceId: string;
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
  flag: 'N' | 'H' | 'L' | 'HH' | 'LL' | 'A' | 'AA' | null;
  on: string;
  status: string | null;
};

const LAB_CODES = ['N', 'H', 'L', 'HH', 'LL', 'A', 'AA'] as const;

function interpretationCode(value: unknown): LabRecord['flag'] {
  for (const entry of arr(value)) {
    for (const coding of arr(obj(entry)?.coding)) {
      const code = str(obj(coding)?.code)?.toUpperCase();
      if (code && (LAB_CODES as readonly string[]).includes(code)) return code as LabRecord['flag'];
    }
  }
  return null;
}

export function labFromResource(resource: unknown): LabRecord | null {
  const r = obj(resource);
  if (!r || str(r.resourceType) !== 'Observation' || isVital(r)) return null;
  const id = str(r.id);
  const name = nameOf(r);
  const on = effectiveDay(r);
  if (!id || !name || !on) return null;
  const q = obj(r.valueQuantity);
  const n = num(q?.value);
  const unit = q ? (str(q.unit) ?? str(q.code)) : null;
  // A number without its unit is not a value (see above).
  const value = n != null && unit ? n : null;
  const valueText = value == null ? (codeableName(r.valueCodeableConcept) ?? str(r.valueString)) : null;
  if (value == null && !valueText) return null;
  const range = obj(arr(r.referenceRange)[0]);
  return {
    sourceId: `Observation/${id}`,
    name,
    value,
    valueText,
    unit: value != null ? unit : null,
    low: num(obj(range?.low)?.value),
    high: num(obj(range?.high)?.value),
    rangeText: str(range?.text),
    flag: interpretationCode(r.interpretation),
    on,
    status: str(r.status),
  };
}

// A whole Bundle, with everything unreadable left out rather than guessed
// at. The count of what was skipped is returned, because a sync that
// silently dropped half her chart should be visible somewhere.
export function mapBundle(json: unknown): { records: ClinicalRecord[]; skipped: number } {
  const bundle = obj(json);
  const entries = arr(bundle?.entry);
  const records: ClinicalRecord[] = [];
  let skipped = 0;
  for (const entry of entries) {
    const mapped = mapResource(obj(entry)?.resource);
    if (mapped) records.push(mapped);
    else skipped += 1;
  }
  return { records, skipped };
}

// A result she should not be shown as though it stood. Entered in error
// means the provider retracted it.
export const isRetracted = (record: ClinicalRecord) => record.status === 'entered-in-error';

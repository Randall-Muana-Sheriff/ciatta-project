// A stand in for the model, for local tests only. It answers by the type
// asked for, or as a visit summary.

export function fakeDocument(as: string | null): Record<string, unknown> {
  const base = {
    not_medical: false,
    doc_type: as ?? 'visit',
    title: 'Test document',
    date: '2026-09-02',
    clinician: 'Dr Test',
    facility: 'Test Clinic',
    multiple_dates: false,
    unreadable_pages: [],
    visit: null,
    report: null,
    prescription: null,
    referral: null,
    insurance: null,
    other: null,
  };
  if ((as ?? 'visit') === 'visit') {
    return {
      ...base,
      visit: {
        reason: 'Follow up',
        diagnoses: [{ name: 'Iron deficiency anemia', status: 'new' }],
        medications_started: [{ name: 'Ferrous sulfate', strength: '325 mg', dose: null, frequency: 'once daily', route: 'oral', prescriber: null, date: null }],
        medications_stopped: [],
        medications_changed: [],
        procedures: [],
        follow_ups: [],
        instructions: ['Take with food.'],
        allergies: [],
      },
    };
  }
  if (as === 'insurance') return { ...base, insurance: { provider: 'Aetna', plan: 'Choice POS II', member_id: 'W123' } };
  return { ...base, other: { description: 'A test document' } };
}

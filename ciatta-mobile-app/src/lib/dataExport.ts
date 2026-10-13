// Everything Ciatta holds about her, as one file she can keep.
//
// Pure: the rows in, the file's contents out. The reading and the writing
// are in data/account.ts. Every table that holds her data is either listed
// here or skipped with a reason, and a test reads the migrations to keep it
// that way, so a table added later cannot be quietly left out.

export const EXPORT_TABLES = [
  'profiles',
  'health_sources',
  'consents',
  'raw_inputs',
  'episodes',
  'journal_entries',
  'daily_metrics',
  'observations',
  'meals',
  'product_uses',
  'procedures',
  'referrals',
  'conditions',
  'medications',
  'supplements',
  'documents',
  'results',
  'provider_connections',
  'clinical_records',
  'environment_days',
  'baselines',
  'changes',
  'temporal_links',
  'threads',
  'thread_evidence',
  'insights',
  'insight_views',
  'recommendations',
  'considerations',
  'actions',
  'outcomes',
  'learning_events',
  'health_summaries',
  'push_tokens',
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

// Holds rows for her, but nothing about her.
export const EXPORT_SKIPPED: Record<string, string> = {
  jobs: 'A queue of work for the server to do, not information about you.',
  food_scan_uses: 'A count of meal scans per day, kept on the server only to limit scans to 40 a day.',
  lab_scan_uses: 'A count of lab reports read per day, kept on the server only to limit them to 20 a day.',
};

// Read as these columns rather than all of them. A provider connection's
// access keys never leave the server, so they are not in the file either.
export const EXPORT_COLUMNS: Partial<Record<ExportTable, string>> = {
  provider_connections:
    'id, user_id, endpoint_id, endpoint_name, organization, fhir_base_url, vendor, portal_name, status, fhir_patient_id, last_synced_at, last_error, record_count, created_at, updated_at',
};

const ABOUT_TABLES: Record<ExportTable, string> = {
  profiles: 'Your profile: name, onboarding answers, settings and goals.',
  health_sources: 'The sources you connected, such as Apple Health, and their status.',
  consents: 'What you agreed to, and when.',
  raw_inputs: 'What you entered during onboarding, as you entered it.',
  episodes: 'Periods, pain, symptoms and bowel movements you logged.',
  journal_entries: 'Your notes and category logs, in your own words.',
  daily_metrics: 'One row per day: sleep, steps, heart rate, HRV, skin temperature and your daily log.',
  observations: 'Individual readings from your devices, each with its time.',
  meals: 'Meals you logged or scanned, with each food and its estimate.',
  product_uses: 'Period products, when each went in and came out.',
  procedures: 'Procedures and surgeries you added, with their dates.',
  referrals: 'Referrals you are tracking, with the day you marked each step.',
  conditions: 'Conditions, surgeries and symptoms you named.',
  medications: 'Medications you named.',
  supplements: 'Supplements you named.',
  documents: 'Documents you added.',
  results: 'Your labs: from your providers and from reports you had read, each with the lab\'s range and flag.',
  provider_connections: 'Hospitals and clinics you connected. The keys Ciatta uses to reach them stay on the server.',
  clinical_records: 'Records your providers sent, in their words.',
  environment_days: 'Weather, air quality and daylight around you, by day.',
  baselines: 'Your usual range for each measurement, worked out from your own history.',
  changes: 'Sustained changes from your usual that Ciatta noticed.',
  temporal_links: 'Which of your readings happened close in time to which others.',
  threads: 'Patterns Ciatta is following in your record.',
  thread_evidence: 'The entries behind each pattern.',
  insights: 'What Ciatta wrote about your patterns.',
  insight_views: 'When you opened each insight.',
  recommendations: 'Suggestions Ciatta made.',
  considerations: 'What Ciatta weighed before a suggestion.',
  actions: 'Things you chose to try.',
  outcomes: 'How each thing you tried went, as you reported it.',
  learning_events: 'What Ciatta learned from your responses.',
  health_summaries: 'Summaries written from your record.',
  push_tokens: 'The address your phone receives notifications at.',
};

export type TableRead = Record<string, unknown>[] | { error: string };

export type DataExport = {
  exported_at: string;
  user_id: string;
  about: { what: string; files: string; tables: Partial<Record<ExportTable, string>> };
  counts: Partial<Record<ExportTable, number>>;
  not_included: { table: string; reason: string }[];
  tables: Partial<Record<ExportTable, Record<string, unknown>[]>>;
};

export function buildExport(reads: Partial<Record<ExportTable, TableRead>>, userId: string, now: Date): DataExport {
  const out: DataExport = {
    exported_at: now.toISOString(),
    user_id: userId,
    about: {
      what: 'Everything Ciatta holds about you, as it is stored. Each table is listed with what it holds.',
      files:
        'Photos, videos and PDFs you attached are kept on this phone, not on Ciatta\'s servers, so they are not in this file. Their names are listed with the entry they belong to.',
      tables: {},
    },
    counts: {},
    not_included: Object.entries(EXPORT_SKIPPED).map(([table, reason]) => ({ table, reason })),
    tables: {},
  };
  for (const table of EXPORT_TABLES) {
    const read = reads[table];
    if (read === undefined) continue;
    if (!Array.isArray(read)) {
      out.not_included.push({ table, reason: `Could not be read: ${read.error}` });
      continue;
    }
    out.about.tables[table] = ABOUT_TABLES[table];
    out.counts[table] = read.length;
    out.tables[table] = read;
  }
  // The skipped tables explain themselves once, after any that failed.
  out.not_included.sort((a, b) => Number(a.table in EXPORT_SKIPPED) - Number(b.table in EXPORT_SKIPPED));
  return out;
}

export const exportFileName = (now: Date) =>
  `ciatta-data-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;

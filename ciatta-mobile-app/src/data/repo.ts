import type { SupabaseClient } from '@supabase/supabase-js';

import type { Attachment } from '../lib/attachments';
import type { DailyPatch } from '../lib/dailyLog';
import { endUse, type Fullness, type Product, type ProductUse, startUse } from '../lib/periodProducts';
import type { EnvironmentDay } from '../lib/weather';
import { normalizeTargets, type NutritionTargets } from '../lib/nutritionTargets';
import { type Meal, mealFromRow, mealProvenance, mealTotals, readScan, type Scan } from '../lib/foodScan';
import type { CategoryKey } from '../lib/logCategories';
import type { Found } from '../lib/quickLog';
import { type CycleProfile, normalizeProfile } from '../lib/cycleProfile';
import type { Answers as OnboardingAnswers } from '../lib/onboarding';
import type { DailyRow } from '../lib/healthMetrics';
import { type Day, loadDays as loadSampleDays } from './daily';
import { daysFromRows } from './dailyRows';
import type { Episode } from './cycleLog';
import { type EvidenceRow, type InsightRow, insightView, type InsightView } from './insightRows';
import { type OutcomeValue, type TodayLoop, todayLoop } from './loopRows';
import { paginateAll } from './pagination';
import {
  type DbSourceKind,
  type DbSourceStatus,
  episodeToRow,
  type EpisodeRow,
  type JournalRow,
  type JournalView,
  journalView,
  type ProductUseRow,
  productUseView,
  rowToEpisode,
  type SourceRow,
  sourceView,
  type SourceView,
} from './rows';
import { type EntryKind, insight as sampleInsight, journal, person, sources } from './sample';
import { VITAL_METRICS } from '../lib/vitals';
import { band, median } from '../lib/engine';
import type { BaselineRow, VitalDay } from '../lib/metricDetail';
import { type Insurance, insuranceFromRow } from '../lib/insurance';
import type { Referral } from '../lib/referrals';
import type { BodyManual } from '../lib/overviewFacts';
import type { SleepSample } from '../lib/hypnogram';
import { type LabFlag, type LabResult, type LabScan, parseRange, readLabScan, type ScannedTest } from '../lib/labs';
import { DOC_TYPE_LABEL, type DocType, type DocumentFilings, type DocumentScan, type Existing, readDocumentScan, toSnake } from '../lib/documents';
import { extractionFingerprint, readStoredDocAnalysis, type StoredDocAnalysis } from '../lib/documentAnalysis';
import { readStoredAnalysis, type StoredAnalysis } from '../lib/labAnalysis';
import { records as sampleRecords } from './sample';
import type { CareRequest, ClinicianRow } from '../lib/care';
import { INSIGHTS, type InsightReaction, type ResearchInsight } from '../lib/insights';
import { type DetailKind, isSupplement } from '../lib/healthLists';

// Every daily_metrics column daysFromRows/rowToDay actually reads. Named
// explicitly, like every other realRepo method, rather than select('*'),
// which would also pull id, user_id, source_id, metadata,
// occurred_at, created_at and updated_at: real columns, just not ones this
// projection has any use for.
const DAILY_COLUMNS =
  'day, sleep_hours, stage_awake, stage_rem, stage_light, stage_deep, time_in_bed, steps, active_minutes, workouts, resting_hr, hrv, temp_deviation, energy, mood, stress, caffeine, alcohol, foods, digestion, note';

// An insight with its thread embedded, and the thread's evidence with the
// row each piece points at. The two observation joins on a link are named
// by their foreign keys because temporal_links reaches observations twice.
const INSIGHT_COLUMNS =
  'id, thread_id, title, what_changed, connected, you_told, not_established, alternatives, status, confidence, valid_from, updated_at, threads(key, title, status, domains, observation_count, first_observed_at, last_observed_at, confidence)';
const OBSERVATION_REF = 'metric, domain, value, value_text, unit, occurred_at';
const EVIDENCE_COLUMNS =
  `role, note, created_at, observations(${OBSERVATION_REF}), changes(metric, direction, from_value, to_value, detected_on), ` +
  `temporal_links(occurred_on, a:observations!temporal_links_a_observation_id_fkey(${OBSERVATION_REF}), b:observations!temporal_links_b_observation_id_fkey(${OBSERVATION_REF})), ` +
  'research_refs(title, publication, year, summary)';

// The name each source kind is stored and shown under. Only apple_health is
// ever written by saveSourceStatus today; the rest are named so the mapping
// is total, not because anything else calls it yet.
const SOURCE_NAME: Record<DbSourceKind, string> = {
  apple_health: 'Apple Health',
  health_connect: 'Health Connect',
  lab: 'Lab',
  document: 'Document',
  manual: 'Manual',
  user_report: 'You',
};

// Where screens get their record. Demo serves the sample person and keeps
// nothing; real reads and writes her own rows, protected by RLS.
export type LabReportInput = {
  file: { base64: string; kind: 'image' | 'pdf' };
  checksum: string;
  on: string;
  lab: string | null;
  orderingClinician: string | null;
  specimen: string | null;
  pages: number | null;
  tests: ScannedTest[];
};

export type DocumentInput = {
  file: { base64: string; kind: 'image' | 'pdf' };
  checksum: string;
  scan: DocumentScan;
  filings: DocumentFilings;
  insurance: { provider: string; plan: string | null; member_id: string | null } | null;
};
export type DocumentSummary = { id: string; docType: DocType; title: string | null; on: string };
export type DocumentDetail = DocumentSummary & {
  extraction: DocumentScan;
  filed: { conditions: string[]; allergies: string[]; medications: string[]; procedures: string[]; referrals: string[] };
  linked: { table: string; id: string }[];
};

export type Repo = {
  mode: 'demo' | 'real';
  loadEpisodes(): Promise<Episode[]>;
  saveEpisode(e: Episode, extra?: Record<string, unknown>): Promise<void>;
  loadCycleProfile(): Promise<CycleProfile | null>;
  saveCycleProfile(p: CycleProfile): Promise<void>;
  // Null until she finishes the first session. The Gate reads this to decide
  // whether to show onboarding, so an unfinished session resumes rather than
  // being skipped.
  loadOnboardedAt(): Promise<string | null>;
  // One call rather than a save per step, because a half written first
  // session is worse than none: it would leave her with a record that says
  // things she never finished saying. Everything lands or nothing does.
  completeOnboarding(a: OnboardingAnswers): Promise<void>;
  loadJournal(): Promise<JournalView>;
  // Files ride along in metadata, as they do on an episode. Optional, so a
  // caller with nothing attached passes nothing.
  // `at` dates the entry to when it happened, when she said so (yesterday,
  // three days ago); otherwise now.
  addJournal(text: string, kind: EntryKind, attachments?: Attachment[], tags?: { category: CategoryKey; items: Found }, at?: string): Promise<void>;
  // Something she adds from Records: kept as a note, filed to records.
  addRecord(text: string, attachments: Attachment[]): Promise<void>;
  // Her own columns of one day, merged into whatever the day already holds.
  saveDailyLog(patch: DailyPatch): Promise<void>;
  // Period products: her uses, newest last; putting one in (which closes
  // the one that was in); and taking it out.
  loadProductUses(): Promise<ProductUse[]>;
  // The weather and daylight around her, by day. Empty until the
  // environment fetch exists for her account.
  loadEnvironment(): Promise<EnvironmentDay[]>;
  // Asks the server to fetch the weather for a rough area and a range of
  // days. The coordinates are already rounded and are not stored.
  fetchEnvironment(req: { lat: number; lon: number; from: string; to: string }): Promise<void>;
  // Her own minutes outside in daylight per day (Apple Health, Apple Watch).
  loadDaylight(sinceIso: string): Promise<{ day: string; minutes: number }[]>;
  // Push: this phone's address, and whether she wants new findings sent.
  savePushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  loadNotifyFindings(): Promise<boolean>;
  saveNotifyFindings(on: boolean): Promise<void>;
  // What she wants to understand, as she wrote it at onboarding, and as
  // she changes it later in Profile.
  loadGoals(): Promise<string[]>;
  saveGoals(goals: string[]): Promise<void>;
  // Her Health Details lists, as she keeps them in Profile: conditions,
  // allergies, medications, vaccinations, genetics and lifestyle.
  loadDetails(kind: DetailKind): Promise<string[]>;
  saveDetails(kind: DetailKind, items: string[]): Promise<void>;
  // Her optional daily nutrition targets. Empty when she set none.
  loadNutritionTargets(): Promise<NutritionTargets>;
  // A meal photo read by the food scan, already checked (lib/foodScan).
  scanFood(imageBase64: string): Promise<Scan>;
  saveMeal(meal: Meal): Promise<void>;
  // Procedures she added with their date. Provider procedures come from
  // her clinical records instead.
  loadAddedProcedures(): Promise<{ id: string; name: string; date: string }[]>;
  addProcedure(p: { id: string; name: string; date: string }): Promise<void>;
  loadMeals(sinceIso: string): Promise<Meal[]>;
  saveNutritionTargets(t: NutritionTargets): Promise<void>;
  startProduct(next: { id: string; product: Product; size: string; at: string }): Promise<void>;
  endProduct(out: { at: string; fullness: Fullness | null }): Promise<void>;
  loadSources(): Promise<SourceView[]>;
  loadDays(): Promise<Day[]>;
  // Her newest live insight, or null when the server has not written one:
  // the Insight screen shows its empty note then, never the sample.
  loadInsight(): Promise<InsightView | null>;
  // The loop, as get_today() composes it: the newest insight with what
  // changed about it since she last looked, her offers, what she is
  // trying, and what was learned. Null in demo mode, where the local store
  // keeps the sample loop in memory.
  loadToday(): Promise<TodayLoop | null>;
  recordVisit(): Promise<void>;
  recordInsightView(insightId: string): Promise<void>;
  setThreadWatch(threadId: string, watching: boolean): Promise<void>;
  // Returns the action's id, or null in demo mode.
  startAction(input: StartAction): Promise<string | null>;
  reportOutcome(actionId: string, reported: OutcomeValue): Promise<void>;
  dismissRecommendation(id: string, reason: string): Promise<void>;
  // Real mode only: writes or updates the row for one source kind, keyed by
  // (user_id, kind, name) so a repeat call updates the same row instead of
  // creating a duplicate. Omitting lastSyncedAt leaves whatever was already
  // stored there untouched, rather than clearing it.
  saveSourceStatus(kind: DbSourceKind, status: DbSourceStatus, lastSyncedAt?: string): Promise<void>;
  firstName(): Promise<string | null>;
  // Her first name, as she changes it in Profile.
  saveFirstName(name: string): Promise<void>;
  // Today's measured readings, by the hour they happened.
  //
  // daily_metrics holds one row per day, which is the wrong shape for a
  // chart of a day. These come from observations, which carry the time each
  // sample was taken, so the line is drawn where readings actually are.
  // Today's readings, by the moment they happened. Heart rate and sleep by
  // default, for the day chart; a metric's own screen names its own.
  loadIntraday(sinceIso: string, metrics?: string[]): Promise<IntradayPoint[]>;
  // What she reported about herself: conditions, surgeries, medications and
  // supplements, as she named them. Written at onboarding and never
  // inferred, which is why the brief can print them as hers.
  loadReported(): Promise<Reported>;
  // Reviewed reference rows, which are the only thing the Care agent is
  // allowed to cite. Reference data with no owner, so every signed in
  // person reads the same rows.
  loadReferences(): Promise<ReferenceRow[]>;
  // The newest reading of each vital that never folded into a daily row:
  // blood pressure, blood oxygen, weight.
  loadVitals(): Promise<VitalReading[]>;
  // Her usual range per metric, as the baselines function last worked it out.
  loadBaselines(): Promise<BaselineRow[]>;
  // Her labs, from her providers and from reports she had read.
  loadLabs(): Promise<LabResult[]>;
  // Reads a photo or PDF of a lab report. Nothing is saved until saveLabs.
  scanLab(base64: string, kind: 'image' | 'pdf'): Promise<LabScan>;
  // A checked lab report: its original file kept privately, and its results
  // saved with it, all or nothing. Returns the report's id.
  saveLabReport(input: LabReportInput): Promise<string>;
  // A report she already added from the same file, by its checksum.
  findLabReport(checksum: string): Promise<{ id: string; on: string } | null>;
  // The report, its results and its stored file.
  removeLabReport(id: string): Promise<void>;
  // A short lived private link to the report's original file.
  labReportFile(documentId: string): Promise<string | null>;
  // Her labs collected before a day, newest first by time then id: the
  // same rows the lab-analysis function reads, so both fingerprint alike.
  loadLabsBefore(day: string): Promise<LabResult[]>;
  // Any medical document: read it, see what she has, file it, list, open
  // and remove it. labReportFile opens any document's original.
  scanDocument(base64: string, kind: 'image' | 'pdf', as?: DocType): Promise<DocumentScan>;
  loadExistingForDocuments(): Promise<Existing>;
  saveDocument(input: DocumentInput): Promise<string>;
  findDocument(checksum: string): Promise<{ id: string; on: string; docType: string } | null>;
  loadDocuments(): Promise<DocumentSummary[]>;
  loadDocument(id: string): Promise<DocumentDetail | null>;
  removeDocument(id: string): Promise<void>;
  loadDocumentAnalysis(documentId: string): Promise<StoredDocAnalysis | null>;
  analyzeDocument(documentId: string, cycle: { day: number; phase: string | null; usual_length: number | null } | null): Promise<StoredDocAnalysis>;
  // The latest stored clinical AI analysis of a report, or null.
  loadLabAnalysis(documentId: string): Promise<StoredAnalysis | null>;
  // Asks for a new one. Throws with the function's own sentence when it
  // could not be written or checked.
  analyzeLabReport(documentId: string, cycle: { day: number; phase: string | null; usual_length: number | null } | null): Promise<StoredAnalysis>;
  // Her sleep stages since a moment, each with when it began and ended.
  loadSleepSamples(sinceIso: string): Promise<SleepSample[]>;
  // Her body measurements as she entered them, and her units.
  loadBody(): Promise<BodyManual | null>;
  saveBody(body: BodyManual): Promise<void>;
  // Referrals she is tracking.
  loadReferrals(): Promise<Referral[]>;
  saveReferral(r: Referral): Promise<void>;
  deleteReferral(id: string): Promise<void>;
  // Requests she is making of her own clinicians, and her care team.
  loadRequests(): Promise<CareRequest[]>;
  saveRequest(r: CareRequest): Promise<void>;
  deleteRequest(id: string): Promise<void>;
  loadCareTeam(): Promise<ClinicianRow[]>;
  // The research library, as reviewed and served from research_insights.
  loadResearchInsights(): Promise<ResearchInsight[]>;
  // Her thumbs up, thumbs down and saves, by insight.
  loadInsightReactions(): Promise<Record<string, InsightReaction>>;
  saveInsightReaction(insightId: string, r: InsightReaction): Promise<void>;
  saveClinician(c: ClinicianRow): Promise<void>;
  deleteClinician(id: string): Promise<void>;
  // Her health insurance, as she entered it. Null when she has not.
  loadInsurance(): Promise<Insurance | null>;
  saveInsurance(ins: Insurance | null): Promise<void>;
  // Blood pressure and blood oxygen, one row per metric per day since a day.
  loadVitalDays(since: string, tz: string): Promise<VitalDay[]>;
};

// A published finding, quoted. summary is verbatim from the source, which
// is why the agent may show it without summarising it further.
export type VitalReading = { metric: string; value: number; unit: string | null; at: string };

export type ReferenceRow = {
  id: string;
  title: string;
  publication: string | null;
  year: number | null;
  url: string | null;
  summary: string;
  domains: string[];
};

export type Reported = { conditions: string[]; surgeries: string[]; medications: string[]; supplements: string[] };

// One measured sample with the moment it was taken. value_text carries the
// sleep stage for sleep_analysis, where there is no number to plot.
export type IntradayPoint = { metric: string; value: number | null; valueText: string | null; at: string };

export type StartAction = {
  kind: string;
  title: string;
  intent?: string;
  metric?: string;
  wanted?: 'higher' | 'lower';
  insightId?: string;
  recommendationId?: string;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function demoRepo(): Repo {
  let own: Episode[] = [];
  // The example person's recent logs by category, dated from today, so the
  // dashboard's category cards have something of hers to count.
  const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
  const logged: [number, string, EntryKind, CategoryKey, Found][] = [
    [0, 'Two coffees before ten', 'Context', 'nutrition', { nutrition: ['Caffeine'] }],
    [2, 'Coffee, and skipped lunch', 'Context', 'nutrition', { nutrition: ['Caffeine', 'Skipped a meal'] }],
    [4, 'Glass of wine with a late dinner', 'Context', 'nutrition', { nutrition: ['Alcohol', 'Ate late'] }],
    [1, 'Foggy all afternoon, hard to focus', 'Symptoms', 'mind', { mind: ['Brain fog', 'Hard to focus'] }],
    [3, 'Headache by the evening', 'Symptoms', 'mind', { mind: ['Headache'] }],
    [6, 'Foggy again', 'Symptoms', 'mind', { mind: ['Brain fog'] }],
    [2, 'Night sweats, woke twice', 'Symptoms', 'body', { body: ['Night sweats', 'Fatigue'] }],
    [9, 'Tired all day', 'Symptoms', 'body', { body: ['Fatigue'] }],
    [4, 'Breakout on my chin', 'Symptoms', 'skin', { skin: ['Acne'] }],
    [12, 'More hair in the brush', 'Symptoms', 'skin', { skin: ['Hair shedding'] }],
    [5, 'Needing to pee more often', 'Symptoms', 'sexual', { sexual: ['Urinary urgency'] }],
  ];
  const sampleRecent = logged.map(([ago, text, kind, cat, items]) => ({
    text,
    date: new Date(recent(ago)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    tag: kind,
    kind,
    usedInInsight: false,
    category: cat,
    items,
    at: recent(ago),
  }));
  // The example person's measurements, as the sample shows them.
  let body: BodyManual | null = { blood_type: 1, height_cm: 173, weight_kg: 64.2 };
  // Referrals the example person tracks in this session.
  let referrals: Referral[] = [];
  // The example person's requests and care team, so Your Care has
  // something to show: one sent, one still a draft, and her gynecologist.
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  let requests: CareRequest[] = [
    {
      id: 'demo-refill',
      kind: 'refill',
      title: 'Refill: Levothyroxine',
      body: 'Hello Dr Maria Rivera,\n\nI would like to request a refill of Levothyroxine.\n\nThank you,\nAlex',
      clinician: 'Dr Maria Rivera',
      status: 'sent',
      sentOn: daysAgo(2).slice(0, 10),
      answeredOn: null,
      createdAt: daysAgo(3),
    },
    {
      id: 'demo-records',
      kind: 'records',
      title: 'Records request: Riverside Health',
      body: 'Hello,\n\nI would like a copy of my recent visit notes and test results, sent to my patient portal if possible.\n\nThank you,\nAlex',
      clinician: 'Riverside Health',
      status: 'draft',
      sentOn: null,
      answeredOn: null,
      createdAt: daysAgo(1),
    },
  ];
  let reactions: Record<string, InsightReaction> = {};
  let team: ClinicianRow[] = [
    { id: 'demo-rivera', name: 'Maria Rivera', role: 'Gynecologist', organization: 'Riverside Health', phone: null, email: null, notes: null },
  ];
  // The example person's labs, from the sample's draws.
  let labs: LabResult[] = sampleLabs();
  let demoReports: { id: string; on: string; checksum: string }[] = [];
  const demoAnalyses = new Map<string, StoredAnalysis>();
  let demoDocuments: (DocumentDetail & { checksum: string })[] = [];
  const demoDocAnalyses = new Map<string, StoredDocAnalysis>();
  // The example person's insurance, as the sample shows it.
  let insurance: Insurance | null = { provider: 'Anthem', plan: 'PPO' };
  let view: JournalView = {
    ...journal,
    count: journal.count + sampleRecent.length,
    months: [{ month: 'This month', items: sampleRecent }, ...journal.months],
  };
  let productUses: ProductUse[] = [];
  let targets: NutritionTargets = {};
  // The example person's laparoscopy, ten weeks ago, so her before and
  // after has six weeks of sample record on each side.
  const lap = new Date(Date.now() - 70 * 86400000);
  let procedures = [
    {
      id: 'sample-lap',
      name: 'Laparoscopy',
      date: `${lap.getFullYear()}-${String(lap.getMonth() + 1).padStart(2, '0')}-${String(lap.getDate()).padStart(2, '0')}`,
    },
  ];
  // The example person's last eight days of meals, so her Nutrition card
  // has a usual day to fill toward. Figures are sample estimates, marked as
  // estimates like any scan.
  let notifyFindings = true;
  let firstNameNow = person.firstName;
  // What the example person said she wants to understand.
  let goals: string[] = ['Why I am so tired', 'What sets off my flares', 'Whether my cycle is changing'];
  // The example person's Health Details.
  let details: Partial<Record<DetailKind, string[]>> = {
    conditions: ['Endometriosis', 'Hypothyroidism', 'Knee injury'],
    allergies: ['Penicillin', 'Pollen', 'Shellfish', 'Lactose intolerance'],
    medications: ['Levothyroxine', 'Dienogest', 'Ibuprofen', 'Tranexamic acid', 'Iron', 'Magnesium'],
    vaccinations: ['Influenza', 'COVID 19', 'HPV', 'Tetanus, diphtheria, pertussis'],
    genetics: ['MTHFR variant', 'Family history of endometriosis'],
    lifestyle: ['Never smoked', 'Rarely drinks', 'Caffeine daily', 'Exercises regularly'],
  };
  let meals: Meal[] = [1820, 2050, 1760, 1990, 2120, 1880, 1940, 0].map((kcal, n) => {
    const daysAgo = 7 - n;
    const at = new Date(Date.now() - daysAgo * 86400000);
    at.setHours(daysAgo === 0 ? 8 : 13, 0, 0, 0);
    const today = daysAgo === 0;
    return {
      id: `sample-meal-${n}`,
      eatenAt: at.toISOString(),
      photoUri: null,
      items: today
        ? [
            { name: 'Greek Yogurt', portion: '200 g', kcal: 190, protein_g: 18, carbs_g: 8, fat_g: 9, at: null, from: 'estimated' as const },
            { name: 'Mixed Berries', portion: '1 cup', kcal: 70, protein_g: 1, carbs_g: 17, fat_g: 0.5, at: null, from: 'estimated' as const },
            { name: 'Granola', portion: '40 g', kcal: 180, protein_g: 4, carbs_g: 26, fat_g: 7, at: null, from: 'estimated' as const },
            { name: 'Coffee With Milk', portion: '1 mug', kcal: 60, protein_g: 3, carbs_g: 5, fat_g: 3, at: null, from: 'estimated' as const },
          ]
        : [{ name: 'Meals', portion: 'the day', kcal, protein_g: Math.round(kcal * 0.04), carbs_g: Math.round(kcal * 0.12), fat_g: Math.round(kcal * 0.035), at: null, from: 'estimated' as const }],
    };
  });
  return {
    mode: 'demo',
    loadEpisodes: async () => own,
    saveEpisode: async (e) => {
      own = [...own.filter((x) => x.id !== e.id), e];
    },
    loadCycleProfile: async () => null,
    saveCycleProfile: async () => {},
    // Demo never onboards: the example person arrives with a record already
    // built, and walking a first session for someone who is not her would
    // teach the wrong thing about what Ciatta does with her answers.
    loadOnboardedAt: async () => new Date().toISOString(),
    completeOnboarding: async () => {},
    loadJournal: async () => view,
    // The example person's record is fixed; a demo save changes nothing she
    // could be misled by.
    saveDailyLog: async () => {},
    // Kept in memory for the session, so the example person can try it.
    // The example person's scan is always the same sample plate, laid out
    // as the design shows it, so the flow can be tried without a key.
    scanFood: async () =>
      readScan({
        not_food: false,
        items: [
          { name: 'Grilled Chicken', portion: '150 g', kcal: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4, x: 0.47, y: 0.3, r: 0.16 },
          { name: 'Lettuce', portion: '1 cup', kcal: 8, protein_g: 0.6, carbs_g: 1.5, fat_g: 0.1, x: 0.81, y: 0.5, r: 0.11 },
          { name: 'Tomatoes', portion: '6 cherry', kcal: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, x: 0.29, y: 0.58, r: 0.1 },
          { name: 'Lamb’s Lettuce', portion: '1 handful', kcal: 6, protein_g: 0.6, carbs_g: 1, fat_g: 0.1, x: 0.58, y: 0.5, r: 0.08 },
        ],
      }),
    loadAddedProcedures: async () => procedures,
    addProcedure: async (p) => {
      procedures = [...procedures.filter((x) => x.id !== p.id), p];
    },
    saveMeal: async (meal) => {
      meals = [...meals.filter((m) => m.id !== meal.id), meal];
    },
    loadMeals: async (since) => meals.filter((m) => m.eatenAt >= since),
    // The example person's weather is a fixed sample; nothing is fetched.
    fetchEnvironment: async () => {},
    // The example person gets no pushes; her setting lives for the session.
    savePushToken: async () => {},
    loadDetails: async (kind) => [...(details[kind] ?? [])],
    saveDetails: async (kind, items) => {
      details = { ...details, [kind]: [...items] };
    },
    loadGoals: async () => [...goals],
    saveGoals: async (next) => {
      goals = [...next];
    },
    loadNotifyFindings: async () => notifyFindings,
    saveNotifyFindings: async (on) => {
      notifyFindings = on;
    },
    loadDaylight: async () =>
      [35, 52, 18, 41, 60, 27, 44].map((minutes, n) => ({
        day: new Date(Date.now() - (7 - n) * 86400000).toISOString().slice(0, 10),
        minutes,
      })),
    loadNutritionTargets: async () => targets,
    saveNutritionTargets: async (t) => {
      targets = normalizeTargets(t);
    },
    loadProductUses: async () => productUses,
    // A sample autumn week for the example person, so the card can be seen.
    loadEnvironment: async () =>
      [
        [21, 13, 0.62, 668],
        [23, 14, 0.66, 665],
        [19, 12, 0.78, 662],
        [18, 11, 0.81, 659],
        [20, 12, 0.7, 656],
        [22, 13, 0.64, 653],
        [21, 12, 0.6, 650],
      ].map(([max, min, humidity, daylight], n) => {
        const d = new Date(Date.now() - (7 - n) * 86400000);
        return {
          day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          tempMaxC: max,
          tempMinC: min,
          humidityMean: humidity,
          daylightMinutes: daylight,
          condition: null,
          pm25: [6, 8, 11, 9, 7, 6, 5][n],
          usAqi: [28, 34, 46, 38, 31, 27, 24][n],
          pollenGrass: null,
          pollenTree: null,
          pollenWeed: null,
        };
      }),
    startProduct: async (next) => {
      productUses = startUse(productUses, next);
    },
    endProduct: async (out) => {
      productUses = endUse(productUses, out);
    },
    addJournal: async (text, kind, attachments = [], tags, at) => {
      const d = at ? new Date(at) : new Date();
      const month = `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
      const item = { text, date: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`, tag: kind, kind, usedInInsight: false, attachments, category: tags?.category, items: tags?.items, at: d.toISOString() };
      const rest = view.months.filter((m) => m.month !== month);
      const current = view.months.find((m) => m.month === month);
      view = { ...view, count: view.count + 1, months: [{ month, items: [item, ...(current?.items ?? [])] }, ...rest] };
    },
    addRecord: async (text, attachments) => {
      const d = new Date();
      const month = `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
      const item = { text, date: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`, tag: 'Notes', kind: 'Notes' as const, usedInInsight: false, attachments, category: 'note' as const, at: d.toISOString(), filed: 'records' as const };
      const rest = view.months.filter((m) => m.month !== month);
      const current = view.months.find((m) => m.month === month);
      view = { ...view, count: view.count + 1, months: [{ month, items: [item, ...(current?.items ?? [])] }, ...rest] };
    },
    loadSources: async () => sources,
    loadDays: async () => loadSampleDays(),
    loadInsight: async () => sampleInsight,
    loadToday: async () => null,
    recordVisit: async () => {},
    recordInsightView: async () => {},
    setThreadWatch: async () => {},
    startAction: async () => null,
    reportOutcome: async () => {},
    dismissRecommendation: async () => {},
    saveSourceStatus: async () => {},
    firstName: async () => firstNameNow,
    saveFirstName: async (n) => {
      firstNameNow = n.trim() || firstNameNow;
    },
    // The example person's day. Demo is explicitly not her record, so a
    // drawn day here is an illustration rather than a claim.
    loadIntraday: async (_since, metrics) =>
      metrics ? [...sampleIntraday().filter((r) => metrics.includes(r.metric)), ...demoIntraday(metrics)] : sampleIntraday(),
    // What she reported, read from her Health Details lists, so the
    // concierge, insights and Profile all see the same record she keeps.
    loadReported: async () => {
      const meds = details.medications ?? [];
      return {
        conditions: [...(details.conditions ?? [])],
        surgeries: [],
        medications: meds.filter((m) => !isSupplement(m)),
        supplements: meds.filter(isSupplement),
      };
    },
    // The example person's last week of cuff and watch readings, newest
    // first as the real read returns them, so her cards have a line.
    loadVitals: async () => {
      const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
      const week = <T,>(xs: T[]) => xs.map((value, n) => ({ value, at: ago(n) }));
      return [
        ...week([118, 121, 119, 122, 120, 123, 121]).map((r) => ({ metric: 'blood_pressure_systolic', unit: 'mmHg', ...r })),
        ...week([76, 78, 77, 79, 78, 80, 78]).map((r) => ({ metric: 'blood_pressure_diastolic', unit: 'mmHg', ...r })),
        ...week([0.98, 0.97, 0.98, 0.97, 0.96, 0.97, 0.97]).map((r) => ({ metric: 'oxygen_saturation', unit: '%', ...r })),
        { metric: 'body_mass', value: 64.2, unit: 'kg', at: ago(0) },
      ].sort((a, b) => b.at.localeCompare(a.at));
    },
    loadBaselines: async () => demoBaselines(loadSampleDays(), demoVitalDays()),
    loadLabs: async () => labs,
    // A fixed example reading, so the flow can be tried without a key.
    scanLab: async () =>
      readLabScan({
        not_lab: false,
        collected_on: '2026-10-01',
        lab: 'Example Lab',
        tests: [
          { name: 'Hemoglobin', value: 12.6, value_text: null, unit: 'g/dL', range: '12.0 to 15.5', flag: null },
          { name: 'Ferritin', value: 13, value_text: null, unit: 'ng/mL', range: '15 to 150', flag: 'L' },
        ],
      }),
    saveLabReport: async (input) => {
      const id = `report-${Date.now()}`;
      demoReports.push({ id, on: input.on, checksum: input.checksum });
      labs = [
        ...labs,
        ...input.tests.map((t, n) => ({ id: `${id}-${n}`, ...t, status: 'final', source: 'report' as const, lab: input.lab, on: input.on, documentId: id })),
      ];
      return id;
    },
    findLabReport: async (checksum) => {
      const hit = demoReports.find((r) => r.checksum === checksum);
      return hit ? { id: hit.id, on: hit.on } : null;
    },
    labReportFile: async () => null,
    scanDocument: async (_b64, _kind, as) =>
      readDocumentScan({
        not_medical: false,
        doc_type: as ?? 'visit',
        title: 'Example visit summary',
        date: '2026-10-01',
        clinician: 'Dr Example',
        facility: 'Example Clinic',
        multiple_dates: false,
        unreadable_pages: [],
        visit:
          (as ?? 'visit') === 'visit'
            ? {
                reason: 'Follow up',
                diagnoses: [{ name: 'Iron deficiency anemia', status: 'new' }],
                medications_started: [{ name: 'Ferrous sulfate', strength: '325 mg', dose: null, frequency: 'once daily', route: 'oral', prescriber: null, date: null }],
                medications_stopped: [],
                medications_changed: [],
                procedures: [],
                follow_ups: [],
                instructions: ['Take with food.'],
                allergies: [],
              }
            : null,
        report: null,
        prescription: null,
        referral: null,
        insurance: null,
        other: (as ?? 'visit') === 'visit' ? null : { description: 'An example document' },
      }),
    loadExistingForDocuments: async () => ({ conditions: [], medications: [] }),
    saveDocument: async (input) => {
      const id = `document-${Date.now()}`;
      demoDocuments = [
        {
          id,
          checksum: input.checksum,
          docType: input.scan.docType,
          title: input.scan.title,
          on: input.scan.date ?? new Date().toISOString().slice(0, 10),
          extraction: input.scan,
          filed: {
            conditions: input.filings.conditions.map((c) => c.name),
            allergies: input.filings.allergies.map((a) => a.name),
            medications: input.filings.medications.map((m) => m.name),
            procedures: input.filings.procedures.map((p) => p.name),
            referrals: input.filings.referrals.map((r) => r.specialty),
          },
          linked: input.filings.linked,
        },
        ...demoDocuments,
      ];
      return id;
    },
    findDocument: async (checksum) => {
      const hit = demoDocuments.find((d) => d.checksum === checksum);
      return hit ? { id: hit.id, on: hit.on, docType: hit.docType } : null;
    },
    loadDocuments: async () => demoDocuments.map(({ id, docType, title, on }) => ({ id, docType, title, on })),
    loadDocument: async (id) => {
      const d = demoDocuments.find((x) => x.id === id);
      if (!d) return null;
      const { checksum: _c, ...rest } = d;
      return rest;
    },
    loadDocumentAnalysis: async (id) => demoDocAnalyses.get(id) ?? null,
    analyzeDocument: async (id) => {
      const d = demoDocuments.find((x) => x.id === id);
      const stored: StoredDocAnalysis = {
        analysis: {
          urgent: [],
          summary: `This example ${d ? DOC_TYPE_LABEL[d.docType].toLowerCase() : 'document'} was read and filed. In the real app a clinical AI analysis explains it here.`,
          terms: [],
          findings: [],
          patterns: [],
          considerations: [],
          next_steps: [],
          questions: ['What does this document mean for me?'],
        },
        model: 'example',
        createdAt: new Date().toISOString(),
        factsHash: d ? extractionFingerprint(toSnake(d.extraction)) : '',
      };
      demoDocAnalyses.set(id, stored);
      return stored;
    },
    removeDocument: async (id) => {
      demoDocuments = demoDocuments.filter((d) => d.id !== id);
    },
    loadLabsBefore: async (day) => labs.filter((l) => l.on < day).sort((a, b) => b.on.localeCompare(a.on)),
    loadLabAnalysis: async (documentId) => demoAnalyses.get(documentId) ?? null,
    analyzeLabReport: async (documentId) => {
      const rows = labs.filter((l) => l.documentId === documentId);
      const flagged = rows.filter((l) => l.flag);
      const stored: StoredAnalysis = {
        analysis: {
          urgent: [],
          summary: `This example report has ${rows.length} results, ${flagged.length} flagged by the lab.`,
          findings: flagged.map((l) => ({
            test: l.name,
            value: `${l.value ?? l.valueText}${l.unit ? ` ${l.unit}` : ''}`,
            explanation: `${l.name} was flagged by the lab. In the real app a clinical AI analysis explains it here.`,
            common_causes: [],
            relevance: null,
          })),
          patterns: [],
          considerations: [],
          next_tests: [],
          questions: ['What do these results mean for me?'],
        },
        model: 'example',
        createdAt: new Date().toISOString(),
        factsHash: '',
      };
      demoAnalyses.set(documentId, stored);
      return stored;
    },
    removeLabReport: async (id) => {
      demoReports = demoReports.filter((r) => r.id !== id);
      labs = labs.filter((l) => l.documentId !== id);
    },
    loadSleepSamples: async () => demoNight(),
    loadBody: async () => body,
    saveBody: async (next) => {
      body = next;
    },
    loadReferrals: async () => referrals,
    saveReferral: async (r) => {
      referrals = [...referrals.filter((x) => x.id !== r.id), r];
    },
    deleteReferral: async (id) => {
      referrals = referrals.filter((x) => x.id !== id);
    },
    loadRequests: async () => requests,
    saveRequest: async (r) => {
      requests = [...requests.filter((x) => x.id !== r.id), r];
    },
    deleteRequest: async (id) => {
      requests = requests.filter((x) => x.id !== id);
    },
    loadCareTeam: async () => team,
    loadResearchInsights: async () => INSIGHTS,
    loadInsightReactions: async () => reactions,
    saveInsightReaction: async (id, r) => {
      reactions = { ...reactions, [id]: r };
    },
    saveClinician: async (c) => {
      team = [...team.filter((x) => x.id !== c.id), c];
    },
    deleteClinician: async (id) => {
      team = team.filter((x) => x.id !== id);
    },
    loadInsurance: async () => insurance,
    saveInsurance: async (next) => {
      insurance = next;
    },
    loadVitalDays: async (since) => demoVitalDays().filter((v) => v.day >= since),
    loadReferences: async () => [
      {
        id: 'sample-endo-delay',
        title: 'Endometriosis: A Review',
        publication: 'JAMA',
        year: 2025,
        url: 'https://doi.org/10.1001/jama.2025.2975',
        summary:
          'The diagnosis is often delayed, averaging 5 to 12 years after onset of symptoms, with most women consulting 3 or more clinicians prior to diagnosis.',
        domains: ['endometriosis', 'diagnosis'],
      },
    ],
  };
}

// A plausible day for the example person: a night, then a heart rate that
// rises through the morning and settles after lunch. Deterministic, so the
// demo screen does not change shape between launches.
function sampleIntraday(): IntradayPoint[] {
  const base = new Date();
  const at = (h: number, m = 0) => {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const hr: [number, number][] = [
    [7, 62], [8, 68], [9, 74], [10, 71], [11, 69], [12, 73], [13, 70], [14, 66], [15, 64], [16, 63],
  ];
  return [
    { metric: 'sleep_analysis', value: null, valueText: 'asleep_core', at: at(6, 26) },
    ...hr.map(([h, v]) => ({ metric: 'heart_rate', value: v, valueText: null, at: at(h) })),
  ];
}

function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

// PostgREST caps one response at max_rows (1000), so a plain select would
// quietly hand back only part of her record once she has logged more than
// that. Every list read is paged, in an order that cannot shift between
// pages: the time it happened, then her own id for anything logged in the
// same moment.
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export function realRepo(db: SupabaseClient, userId: string): Repo {
  // Keeps one of her record's tables in step with a list she edited: the
  // names she added are inserted as reported, and those of her own reports
  // she removed are deleted. Rows from a provider or a document stay.
  const syncNames = async (table: 'conditions' | 'medications' | 'supplements', names: string[], extra: Record<string, unknown>) => {
    const rows = must(await db.from(table).select(table === 'conditions' ? 'id, name, provenance, kind' : 'id, name, provenance')) as unknown as {
      id: string;
      name: string;
      provenance: string;
      kind?: string;
    }[];
    const mine = table === 'conditions' ? rows.filter((r) => r.kind === 'condition' || r.kind === 'surgery') : rows;
    const have = new Set(mine.map((r) => r.name.toLowerCase()));
    const want = new Set(names.map((n) => n.toLowerCase()));
    const add = names.filter((n) => !have.has(n.toLowerCase()));
    if (add.length) must(await db.from(table).insert(add.map((name) => ({ user_id: userId, name, provenance: 'REPORTED', ...extra }))));
    const drop = mine.filter((r) => r.provenance === 'REPORTED' && !want.has(r.name.toLowerCase())).map((r) => r.id);
    if (drop.length) must(await db.from(table).delete().in('id', drop));
  };
  return {
    mode: 'real',
    async loadEpisodes() {
      const rows = await paginateAll<EpisodeRow>(
        (from, to) => db.from('episodes').select('*').order('occurred_at').order('client_id').range(from, to) as unknown as Page<EpisodeRow>,
      );
      return rows.map(rowToEpisode);
    },
    async saveEpisode(e, extra = {}) {
      must(await db.from('episodes').upsert({ ...episodeToRow(e, extra), user_id: userId }, { onConflict: 'user_id,client_id' }));
    },
    async loadCycleProfile() {
      const row = must(await db.from('profiles').select('cycle_profile').eq('id', userId).maybeSingle()) as { cycle_profile: unknown } | null;
      return normalizeProfile(row?.cycle_profile);
    },
    async saveCycleProfile(p) {
      must(await db.from('profiles').update({ cycle_profile: p }).eq('id', userId));
    },
    async loadOnboardedAt() {
      const row = must(
        await db.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle(),
      ) as { onboarded_at: string | null } | null;
      return row?.onboarded_at ?? null;
    },
    async completeOnboarding(a) {
      const now = new Date().toISOString();

      // Her own words first, and on their own row. They go to raw_inputs
      // rather than into the profile blob because they are evidence: a
      // sentence she wrote, at a time, in a mode, which a later interpretation
      // can point back at. parse_status stays pending, since nothing has read
      // it yet and marking it parsed would claim work that did not happen.
      const opening = a.opening.trim();
      if (opening) {
        must(
          await db.from('raw_inputs').insert({
            user_id: userId,
            text: opening,
            input_mode: a.openingMode === 'spoken' ? 'spoken' : 'typed',
            parse_status: 'pending',
            occurred_at: now,
            metadata: { source: 'onboarding' },
          }),
        );
      }

      // Conditions and surgeries, one row each, REPORTED and status unknown.
      // The default is deliberate: that she listed something does not
      // establish it is current, and the column default says so.
      // Symptoms join conditions and surgeries here rather than becoming
      // episodes, because she gave no date and no severity and an episode
      // without those is an occurrence nobody reported. status stays at the
      // column default of unknown for the same reason: that she named it does
      // not establish she has it today.
      const named = [
        ...a.conditions.map((name) => ({ name, kind: 'condition' as const })),
        ...a.surgeries.map((name) => ({ name, kind: 'surgery' as const })),
        ...a.symptoms.map((name) => ({ name, kind: 'symptom' as const })),
      ].filter((r) => r.name.trim());
      if (named.length) {
        must(
          await db.from('conditions').insert(
            named.map((r) => ({ user_id: userId, kind: r.kind, name: r.name.trim(), provenance: 'REPORTED' })),
          ),
        );
      }

      // Medications and supplements. No dose and no start date: she was not
      // asked, and writing a null is honest where inventing "as needed" would
      // not be.
      const meds = a.medications.map((n) => n.trim()).filter(Boolean);
      if (meds.length) {
        must(
          await db.from('medications').insert(
            meds.map((name) => ({ user_id: userId, name, provenance: 'REPORTED', occurred_at: now })),
          ),
        );
      }
      const sups = a.supplements.map((n) => n.trim()).filter(Boolean);
      if (sups.length) {
        must(
          await db.from('supplements').insert(
            sups.map((name) => ({ user_id: userId, name, provenance: 'REPORTED', occurred_at: now })),
          ),
        );
      }

      // The name she gave wins over the one the sign in trigger copied out of
      // her Google or Apple account. The email authenticates her; it does not
      // get to decide what she is called.
      //
      // Only written when she actually typed one. An empty string over the
      // provider's name would leave a woman who skipped the question with no
      // name at all, which is worse than a name she did not choose.
      const name = a.name.trim();

      // The profile last, and onboarded_at with it. If any write above threw,
      // this one never runs and onboarded_at stays null, so the next launch
      // resumes the first session rather than dropping her into a Today built
      // on half an answer.
      must(
        await db
          .from('profiles')
          .update({
            ...(name ? { first_name: name } : {}),
            onboarded_at: now,
            onboarding: {
              intents: a.intents,
              ageRange: a.ageRange,
              lifeStage: a.lifeStage,
              cycle:
                a.cycleLength == null && a.cycleRegular == null && a.lastPeriodOn == null
                  ? null
                  : { length: a.cycleLength, regular: a.cycleRegular, lastPeriodOn: a.lastPeriodOn },
              goals: a.goals,
              symptoms: a.symptoms,
              skipped: a.skipped,
            },
          })
          .eq('id', userId),
      );
    },
    async loadJournal() {
      const rows = await paginateAll<JournalRow>(
        (from, to) =>
          db
            .from('journal_entries')
            .select('client_id, text, kind, tag, occurred_at, metadata')
            .order('occurred_at')
            .order('client_id')
            .range(from, to) as unknown as Page<JournalRow>,
      );
      return journalView(rows);
    },
    async savePushToken(token, platform) {
      must(
        await db
          .from('push_tokens')
          .upsert({ user_id: userId, token, platform, updated_at: new Date().toISOString() }, { onConflict: 'user_id,token' }),
      );
    },
    async loadDetails(kind) {
      const row = must(await db.from('profiles').select('onboarding').eq('id', userId).maybeSingle()) as
        | { onboarding: { details?: Partial<Record<DetailKind, string[]>> } | null }
        | null;
      const kept = row?.onboarding?.details?.[kind];
      if (kept) return kept;
      // Before she has kept a list here, conditions and medications start
      // from what she reported at onboarding.
      if (kind === 'conditions') {
        const rows = must(await db.from('conditions').select('kind, name')) as { kind: string; name: string }[];
        return [...new Set(rows.filter((r) => r.kind === 'condition' || r.kind === 'surgery').map((r) => r.name))];
      }
      if (kind === 'medications') {
        const [meds, sups] = await Promise.all([db.from('medications').select('name'), db.from('supplements').select('name')]);
        return [...new Set([...(must(meds) as { name: string }[]), ...(must(sups) as { name: string }[])].map((r) => r.name))];
      }
      return [];
    },
    async saveDetails(kind, items) {
      const row = must(await db.from('profiles').select('onboarding').eq('id', userId).maybeSingle()) as
        | { onboarding: Record<string, unknown> | null }
        | null;
      const onboarding = row?.onboarding ?? {};
      const details = { ...((onboarding.details as Record<string, string[]>) ?? {}), [kind]: items };
      must(await db.from('profiles').update({ onboarding: { ...onboarding, details } }).eq('id', userId));
      // Conditions and medications also live in their own tables, which is
      // what the rest of Ciatta reads. Kept in step: what she added is
      // inserted as reported, what she removed of her own reports is deleted.
      if (kind === 'conditions') await syncNames('conditions', items, { kind: 'condition' });
      if (kind === 'medications') {
        await syncNames('medications', items.filter((n) => !isSupplement(n)), { occurred_at: new Date().toISOString() });
        await syncNames('supplements', items.filter(isSupplement), { occurred_at: new Date().toISOString() });
      }
    },
    async loadGoals() {
      const row = must(await db.from('profiles').select('onboarding').eq('id', userId).maybeSingle()) as
        | { onboarding: { goals?: string[] } | null }
        | null;
      return row?.onboarding?.goals ?? [];
    },
    async saveGoals(goals) {
      // Merged into what onboarding saved, so the rest of it stays.
      const row = must(await db.from('profiles').select('onboarding').eq('id', userId).maybeSingle()) as
        | { onboarding: Record<string, unknown> | null }
        | null;
      must(await db.from('profiles').update({ onboarding: { ...(row?.onboarding ?? {}), goals } }).eq('id', userId));
    },
    async loadNotifyFindings() {
      const row = must(await db.from('profiles').select('notify_findings').eq('id', userId).maybeSingle()) as
        | { notify_findings: boolean | null }
        | null;
      return row?.notify_findings !== false;
    },
    async saveNotifyFindings(on) {
      must(await db.from('profiles').update({ notify_findings: on }).eq('id', userId));
    },
    async loadDaylight(since) {
      // Each Apple Health sample is a stretch of time outside; a day's
      // total is their sum.
      const rows = must(
        await db
          .from('observations')
          .select('value, occurred_at')
          .eq('metric', 'time_in_daylight')
          .gte('occurred_at', since)
          .not('value', 'is', null)
          .limit(5000),
      ) as { value: number; occurred_at: string }[] | null;
      const byDay = new Map<string, number>();
      for (const r of rows ?? []) {
        const d = new Date(r.occurred_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        byDay.set(key, (byDay.get(key) ?? 0) + Number(r.value));
      }
      return [...byDay.entries()].map(([day, minutes]) => ({ day, minutes }));
    },
    async fetchEnvironment(req) {
      const { error } = await db.functions.invoke('environment', { body: req });
      if (error) throw error;
    },
    async loadEnvironment() {
      // environment_days arrives with the WeatherKit fetch. Until that
      // exists on her project the read fails, and that means no card.
      try {
        // Four months: the Evidence line compares three weeks with the 90
        // days before them; the dashboard card reads the last seven.
        const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
        const rows = must(
          await db
            .from('environment_days')
            .select('day, temp_max_c, temp_min_c, humidity_mean, daylight_minutes, condition, pm2_5, us_aqi, pollen_grass, pollen_tree, pollen_weed')
            .gte('day', since)
            .order('day'),
        ) as
          | Record<string, number | string | null>[]
          | null;
        const n = (v: number | string | null | undefined) => (v == null ? null : Number(v));
        return (rows ?? []).map((r) => ({
          day: String(r.day),
          tempMaxC: n(r.temp_max_c),
          tempMinC: n(r.temp_min_c),
          humidityMean: n(r.humidity_mean),
          daylightMinutes: n(r.daylight_minutes),
          condition: r.condition == null ? null : String(r.condition),
          pm25: n(r.pm2_5),
          usAqi: n(r.us_aqi),
          pollenGrass: n(r.pollen_grass),
          pollenTree: n(r.pollen_tree),
          pollenWeed: n(r.pollen_weed),
        }));
      } catch {
        return [];
      }
    },
    async scanFood(imageBase64) {
      const { data, error } = await db.functions.invoke('food-scan', { body: { image: imageBase64 } });
      if (error) throw error;
      return readScan(data);
    },
    async loadAddedProcedures() {
      const rows = must(await db.from('procedures').select('client_id, name, performed_on').order('performed_on')) as
        | { client_id: string; name: string; performed_on: string }[]
        | null;
      return (rows ?? []).map((r) => ({ id: r.client_id, name: r.name, date: r.performed_on }));
    },
    async addProcedure(p) {
      must(
        await db
          .from('procedures')
          .upsert({ user_id: userId, client_id: p.id, name: p.name.trim(), performed_on: p.date }, { onConflict: 'user_id,client_id' }),
      );
    },
    async saveMeal(meal) {
      const t = mealTotals(meal.items);
      must(
        await db.from('meals').upsert(
          {
            user_id: userId,
            client_id: meal.id,
            eaten_at: meal.eatenAt,
            items: meal.items,
            kcal: t.kcal,
            protein_g: t.protein_g,
            carbs_g: t.carbs_g,
            fat_g: t.fat_g,
            photo: meal.photoUri ? { uri: meal.photoUri } : null,
            provenance: mealProvenance(meal.items),
          },
          { onConflict: 'user_id,client_id' },
        ),
      );
    },
    async loadMeals(since) {
      const rows = must(
        await db.from('meals').select('client_id, eaten_at, items, photo').gte('eaten_at', since).order('eaten_at'),
      ) as { client_id: string; eaten_at: string; items: unknown; photo: unknown }[] | null;
      return (rows ?? []).map(mealFromRow);
    },
    async loadNutritionTargets() {
      const row = must(await db.from('profiles').select('nutrition_targets').eq('id', userId).maybeSingle()) as
        | { nutrition_targets: unknown }
        | null;
      return normalizeTargets(row?.nutrition_targets);
    },
    async saveNutritionTargets(t) {
      const clean = normalizeTargets(t);
      must(await db.from('profiles').update({ nutrition_targets: Object.keys(clean).length ? clean : null }).eq('id', userId));
    },
    async loadProductUses() {
      const rows = must(
        await db
          .from('product_uses')
          .select('client_id, product, size, started_at, ended_at, fullness')
          .order('started_at')
          .limit(500),
      ) as ProductUseRow[] | null;
      return (rows ?? []).map(productUseView).filter((u): u is ProductUse => u != null);
    },
    async startProduct(next) {
      // Close what was in at the moment the new one goes in, then add the
      // new one. The database refuses a second open use, so a close that
      // did not land fails the insert rather than leaving two in.
      must(await db.from('product_uses').update({ ended_at: next.at }).is('ended_at', null));
      must(
        await db.from('product_uses').insert({
          user_id: userId,
          client_id: next.id,
          product: next.product,
          size: next.size,
          started_at: next.at,
        }),
      );
    },
    async endProduct(out) {
      must(await db.from('product_uses').update({ ended_at: out.at, fullness: out.fullness }).is('ended_at', null));
    },
    async saveDailyLog(patch) {
      must(
        await db.rpc('save_daily_log', {
          p_day: patch.day,
          p_digestion: patch.digestion ?? null,
          p_foods: patch.foods ?? null,
          p_caffeine: patch.caffeine ?? null,
          p_alcohol: patch.alcohol ?? null,
          p_energy: patch.energy ?? null,
          p_mood: patch.mood ?? null,
          p_stress: patch.stress ?? null,
          p_note: patch.note ?? null,
          p_attachments: patch.attachments ?? null,
        }),
      );
    },
    async addJournal(text, kind, attachments = [], tags, at) {
      must(
        await db.from('journal_entries').insert({
          user_id: userId,
          client_id: `j-${Date.now()}`,
          text,
          kind,
          occurred_at: at ?? new Date().toISOString(),
          metadata: {
            ...(attachments.length ? { attachments } : {}),
            ...(tags ? { category: tags.category, items: tags.items } : {}),
          },
        }),
      );
    },
    async addRecord(text, attachments) {
      must(
        await db.from('journal_entries').insert({
          user_id: userId,
          client_id: `r-${Date.now()}`,
          text,
          kind: 'Notes',
          occurred_at: new Date().toISOString(),
          metadata: { ...(attachments.length ? { attachments } : {}), category: 'note', filed: 'records' },
        }),
      );
    },
    async loadSources() {
      const rows = must(await db.from('health_sources').select('kind, name, status, last_synced_at, created_at').order('created_at')) as SourceRow[];
      return rows.map(sourceView);
    },
    async loadDays() {
      const rows = await paginateAll<DailyRow>(
        (from, to) =>
          db
            .from('daily_metrics')
            .select(DAILY_COLUMNS)
            .order('day')
            .range(from, to) as unknown as Page<DailyRow>,
      );
      return daysFromRows(rows, new Date());
    },
    async loadInsight() {
      // One row: the newest insight still in force (valid_to null) that she
      // has not dismissed. Its thread's evidence is a few rows per
      // occurrence over a 180 day window, well under max_rows, so neither
      // read pages.
      const row = must(
        await db
          .from('insights')
          .select(INSIGHT_COLUMNS)
          .is('valid_to', null)
          .neq('status', 'dismissed')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as InsightRow | null;
      if (!row) return null;
      // Through unknown because supabase-js's select parser cannot type the
      // two foreign key named joins on a link; the shape is EvidenceRow.
      const evidence = must(
        await db.from('thread_evidence').select(EVIDENCE_COLUMNS).eq('thread_id', row.thread_id).order('created_at'),
      ) as unknown as EvidenceRow[];
      return insightView(row, evidence);
    },
    async loadToday() {
      return todayLoop(must(await db.rpc('get_today')));
    },
    async recordVisit() {
      must(await db.rpc('record_visit'));
    },
    async recordInsightView(insightId) {
      must(await db.rpc('record_insight_view', { p_insight_id: insightId }));
    },
    async setThreadWatch(threadId, watching) {
      must(await db.rpc('set_thread_watch', { p_thread_id: threadId, p_watching: watching }));
    },
    async startAction(input) {
      const id = must(
        await db.rpc('start_action', {
          p_kind: input.kind,
          p_title: input.title,
          p_intent: input.intent ?? null,
          p_metric: input.metric ?? null,
          p_wanted: input.wanted ?? null,
          p_insight_id: input.insightId ?? null,
          p_recommendation_id: input.recommendationId ?? null,
        }),
      ) as unknown;
      return typeof id === 'string' ? id : null;
    },
    async reportOutcome(actionId, reported) {
      must(await db.rpc('report_outcome', { p_action_id: actionId, p_reported: reported }));
    },
    async dismissRecommendation(id, reason) {
      must(await db.rpc('dismiss_recommendation', { p_id: id, p_reason: reason }));
    },
    async saveSourceStatus(kind, status, lastSyncedAt) {
      const payload: Record<string, unknown> = { user_id: userId, kind, name: SOURCE_NAME[kind], status };
      if (lastSyncedAt) payload.last_synced_at = lastSyncedAt;
      must(await db.from('health_sources').upsert(payload, { onConflict: 'user_id,kind,name' }));
    },
    async saveFirstName(name) {
      const clean = name.trim();
      if (clean) must(await db.from('profiles').update({ first_name: clean }).eq('id', userId));
    },
    async firstName() {
      const row = must(await db.from('profiles').select('first_name').eq('id', userId).maybeSingle()) as { first_name: string | null } | null;
      return row?.first_name ?? null;
    },
    async loadReported() {
      const [conditions, meds, sups] = await Promise.all([
        db.from('conditions').select('kind, name'),
        db.from('medications').select('name'),
        db.from('supplements').select('name'),
      ]);
      const named = (must(conditions) ?? []) as { kind: string; name: string }[];
      return {
        conditions: named.filter((c) => c.kind === 'condition').map((c) => c.name),
        surgeries: named.filter((c) => c.kind === 'surgery').map((c) => c.name),
        medications: ((must(meds) ?? []) as { name: string }[]).map((m) => m.name),
        supplements: ((must(sups) ?? []) as { name: string }[]).map((m) => m.name),
      };
    },
    async loadReferences() {
      // Only reviewed rows. reviewed_by null means the summary has passed
      // no check against its source, and an unchecked citation is the one
      // kind of wrong answer she has no way to catch.
      const rows = must(
        await db
          .from('research_refs')
          .select('id, title, publication, year, url, summary, domains')
          .not('reviewed_by', 'is', null)
          .order('year', { ascending: false }),
      ) as ReferenceRow[] | null;
      return rows ?? [];
    },
    async loadVitals() {
      // Ordered newest first, every reading rather than the newest of each:
      // the cards read the newest with find(), and the trend line under
      // each one needs the ones before it. One round trip for all metrics.
      const rows = must(
        await db
          .from('observations')
          .select('metric, value, unit, occurred_at')
          .in('metric', [...VITAL_METRICS])
          .not('value', 'is', null)
          .order('occurred_at', { ascending: false })
          .limit(200),
      ) as { metric: string; value: number; unit: string | null; occurred_at: string }[] | null;
      return (rows ?? []).map((r) => ({ metric: r.metric, value: Number(r.value), unit: r.unit, at: r.occurred_at }));
    },
    async loadLabs() {
      const rows = must(
        await db
          .from('results')
          .select('id, test_name, value, value_text, unit, reference_low, reference_high, reference_text, flag, status, source, provider, occurred_at, document_id, panel')
          .order('occurred_at', { ascending: false })
          .limit(1000),
      ) as LabRow[] | null;
      return (rows ?? []).map(labFromRow);
    },
    async scanLab(base64, kind) {
      const { data, error } = await db.functions.invoke('lab-scan', { body: { file: base64, kind } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return readLabScan(data);
    },
    async saveLabReport(input) {
      const reportId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).toLowerCase();
      const ext = input.file.kind === 'pdf' ? 'pdf' : 'jpg';
      const path = `${userId}/lab-reports/${reportId}.${ext}`;
      const bytes = Uint8Array.from(atob(input.file.base64), (c) => c.charCodeAt(0));
      const { error: uploadError } = await db.storage
        .from('documents')
        .upload(path, bytes, { contentType: input.file.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await db.rpc('save_lab_report', {
        p_title: input.lab ?? 'Lab report',
        p_collected_on: input.on,
        p_storage_path: path,
        p_metadata: {
          lab: input.lab,
          ordering_clinician: input.orderingClinician,
          specimen: input.specimen,
          pages: input.pages,
          panels: [...new Set(input.tests.map((t) => t.panel).filter((p): p is string => !!p))],
          checksum: input.checksum,
        },
        p_tests: input.tests.map((t) => ({
          name: t.name,
          panel: t.panel,
          value: t.value,
          value_text: t.valueText,
          unit: t.unit,
          low: t.low,
          high: t.high,
          range: t.rangeText,
          flag: t.flag,
        })),
      });
      if (error) {
        // The file went up but the report did not: take the file back down.
        await db.storage.from('documents').remove([path]);
        throw error;
      }
      return data as string;
    },
    async findLabReport(checksum) {
      const rows = must(
        await db
          .from('documents')
          .select('id, occurred_at')
          .eq('doc_type', 'lab_report')
          .eq('metadata->>checksum', checksum)
          .limit(1),
      ) as { id: string; occurred_at: string }[] | null;
      const hit = rows?.[0];
      return hit ? { id: hit.id, on: hit.occurred_at.slice(0, 10) } : null;
    },
    async loadLabsBefore(day) {
      const rows = must(
        await db
          .from('results')
          .select('id, test_name, value, value_text, unit, reference_low, reference_high, reference_text, flag, status, source, provider, occurred_at, document_id, panel')
          .lt('occurred_at', `${day}T00:00:00Z`)
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1000),
      ) as LabRow[] | null;
      return (rows ?? []).map(labFromRow);
    },
    async labReportFile(documentId) {
      const rows = must(await db.from('documents').select('storage_path').eq('id', documentId).limit(1)) as { storage_path: string }[] | null;
      const path = rows?.[0]?.storage_path;
      if (!path) return null;
      const { data, error } = await db.storage.from('documents').createSignedUrl(path, 600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    async loadLabAnalysis(documentId) {
      const rows = must(
        await db.from('lab_analyses').select('analysis, model, created_at, facts_hash').eq('document_id', documentId).order('created_at', { ascending: false }).limit(1),
      ) as unknown[] | null;
      return readStoredAnalysis(rows?.[0] ?? null);
    },
    async analyzeLabReport(documentId, cycle) {
      const { data, error } = await db.functions.invoke('lab-analysis', { body: { documentId, cycle } });
      if (error) {
        let sentence = 'The analysis could not be written just now.';
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (typeof body?.error === 'string') sentence = body.error;
        } catch {
          // Not JSON. The plain sentence stands.
        }
        throw new Error(sentence);
      }
      const stored = readStoredAnalysis(data);
      if (!stored) throw new Error('The analysis could not be written just now.');
      return stored;
    },
    async scanDocument(base64, kind, as) {
      const { data, error } = await db.functions.invoke('document-scan', { body: { file: base64, kind, as } });
      if (error) {
        let sentence = 'The document could not be read. Try again.';
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (typeof body?.error === 'string') sentence = body.error;
        } catch {
          // Not JSON; the plain sentence stands.
        }
        throw new Error(sentence);
      }
      return readDocumentScan(data);
    },
    async loadExistingForDocuments() {
      const [conds, meds] = await Promise.all([
        db.from('conditions').select('id, name, kind').in('kind', ['condition', 'surgery']),
        db.from('medications').select('id, name, stopped_on'),
      ]);
      return {
        conditions: ((must(conds) as { id: string; name: string }[] | null) ?? []).map((c) => ({ id: c.id, name: c.name })),
        medications: ((must(meds) as { id: string; name: string; stopped_on: string | null }[] | null) ?? []).map((m) => ({ id: m.id, name: m.name, stoppedOn: m.stopped_on })),
      };
    },
    async saveDocument(input) {
      const docId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).toLowerCase();
      const ext = input.file.kind === 'pdf' ? 'pdf' : 'jpg';
      const path = `${userId}/documents/${docId}.${ext}`;
      const bytes = Uint8Array.from(atob(input.file.base64), (c) => c.charCodeAt(0));
      const { error: uploadError } = await db.storage
        .from('documents')
        .upload(path, bytes, { contentType: input.file.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await db.rpc('save_document', {
        p_doc_type: input.scan.docType,
        p_title: input.scan.title,
        p_occurred_on: input.scan.date,
        p_storage_path: path,
        p_metadata: { checksum: input.checksum, pages: null, clinician: input.scan.clinician, facility: input.scan.facility, extraction: toSnake(input.scan) },
        p_filings: input.filings,
        p_insurance: input.insurance,
      });
      if (error) {
        await db.storage.from('documents').remove([path]);
        throw error;
      }
      return data as string;
    },
    async findDocument(checksum) {
      const rows = must(await db.from('documents').select('id, occurred_at, doc_type').eq('metadata->>checksum', checksum).limit(1)) as
        | { id: string; occurred_at: string; doc_type: string }[]
        | null;
      const hit = rows?.[0];
      return hit ? { id: hit.id, on: hit.occurred_at.slice(0, 10), docType: hit.doc_type } : null;
    },
    async loadDocuments() {
      const rows = must(
        await db
          .from('documents')
          .select('id, doc_type, title, occurred_at')
          .not('doc_type', 'is', null)
          .neq('doc_type', 'lab_report')
          .order('occurred_at', { ascending: false })
          .limit(200),
      ) as { id: string; doc_type: string; title: string | null; occurred_at: string }[] | null;
      return (rows ?? []).map((r) => ({ id: r.id, docType: r.doc_type as DocType, title: r.title, on: r.occurred_at.slice(0, 10) }));
    },
    async loadDocument(id) {
      const rows = must(await db.from('documents').select('id, doc_type, title, occurred_at, metadata').eq('id', id).limit(1)) as
        | { id: string; doc_type: string; title: string | null; occurred_at: string; metadata: Record<string, unknown> }[]
        | null;
      const r = rows?.[0];
      if (!r) return null;
      const names = async (table: 'conditions' | 'medications' | 'procedures', extra?: (q: any) => any) => {
        let q = db.from(table).select('name').eq('document_id', id);
        if (extra) q = extra(q);
        return ((must(await q) as { name: string }[] | null) ?? []).map((x) => x.name);
      };
      const [conditions, allergies, medications, procedures, referrals] = await Promise.all([
        names('conditions', (q) => q.neq('kind', 'allergy')),
        names('conditions', (q) => q.eq('kind', 'allergy')),
        names('medications'),
        names('procedures'),
        db.from('referrals').select('specialty').eq('document_id', id).then((x: any) => ((must(x) as { specialty: string }[] | null) ?? []).map((y) => y.specialty)),
      ]);
      return {
        id: r.id,
        docType: r.doc_type as DocType,
        title: r.title,
        on: r.occurred_at.slice(0, 10),
        extraction: readDocumentScan(toSnake(r.metadata?.extraction)),
        filed: { conditions, allergies, medications, procedures, referrals },
        linked: Array.isArray(r.metadata?.linked) ? (r.metadata.linked as { table: string; id: string }[]) : [],
      };
    },
    async loadDocumentAnalysis(documentId) {
      const rows = must(
        await db.from('document_analyses').select('analysis, model, created_at, facts_hash').eq('document_id', documentId).order('created_at', { ascending: false }).limit(1),
      ) as unknown[] | null;
      return readStoredDocAnalysis(rows?.[0] ?? null);
    },
    async analyzeDocument(documentId, cycle) {
      const { data, error } = await db.functions.invoke('document-analysis', { body: { documentId, cycle } });
      if (error) {
        let sentence = 'The analysis could not be written just now.';
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (typeof body?.error === 'string') sentence = body.error;
        } catch {
          // Not JSON; the plain sentence stands.
        }
        throw new Error(sentence);
      }
      const stored = readStoredDocAnalysis(data);
      if (!stored) throw new Error('The analysis could not be written just now.');
      return stored;
    },
    async removeDocument(id) {
      const { data: path, error } = await db.rpc('remove_document', { p_document: id });
      if (error) throw error;
      if (typeof path === 'string') await db.storage.from('documents').remove([path]);
    },
    async removeLabReport(id) {
      const { data: path, error } = await db.rpc('remove_lab_report', { p_document: id });
      if (error) throw error;
      if (typeof path === 'string') await db.storage.from('documents').remove([path]);
    },
    async loadSleepSamples(sinceIso) {
      const rows = must(
        await db
          .from('observations')
          .select('occurred_at, value_text, metadata')
          .eq('metric', 'sleep_analysis')
          .gte('occurred_at', sinceIso)
          .order('occurred_at')
          .limit(2000),
      ) as { occurred_at: string; value_text: string | null; metadata: { start_at?: unknown } | null }[] | null;
      return (rows ?? [])
        .filter((r) => r.value_text)
        .map((r) => ({
          stage: r.value_text!,
          end: r.occurred_at,
          ...(typeof r.metadata?.start_at === 'string' ? { start: r.metadata.start_at } : {}),
        }));
    },
    async loadBody() {
      const row = must(await db.from('profiles').select('body').eq('id', userId).maybeSingle()) as { body: BodyManual | null } | null;
      const b = row?.body;
      return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
    },
    async saveBody(next) {
      must(await db.from('profiles').update({ body: next }).eq('id', userId));
    },
    async loadReferrals() {
      const rows = must(
        await db
          .from('referrals')
          .select('client_id, specialty, clinician, reason, referred_by, referred_on, steps, scheduled_for, notes')
          .order('created_at', { ascending: false }),
      ) as
        | {
            client_id: string;
            specialty: string;
            clinician: string | null;
            reason: string | null;
            referred_by: string | null;
            referred_on: string | null;
            steps: Referral['steps'] | null;
            scheduled_for: string | null;
            notes: string | null;
          }[]
        | null;
      return (rows ?? []).map((r) => ({
        id: r.client_id,
        specialty: r.specialty,
        clinician: r.clinician,
        reason: r.reason,
        referredBy: r.referred_by,
        referredOn: r.referred_on,
        steps: r.steps && typeof r.steps === 'object' ? r.steps : {},
        scheduledFor: r.scheduled_for,
        notes: r.notes,
      }));
    },
    async saveReferral(r) {
      must(
        await db.from('referrals').upsert(
          {
            user_id: userId,
            client_id: r.id,
            specialty: r.specialty.trim(),
            clinician: r.clinician,
            reason: r.reason,
            referred_by: r.referredBy,
            referred_on: r.referredOn,
            steps: r.steps,
            scheduled_for: r.scheduledFor,
            notes: r.notes,
          },
          { onConflict: 'user_id,client_id' },
        ),
      );
    },
    async deleteReferral(id) {
      must(await db.from('referrals').delete().eq('client_id', id));
    },
    async loadRequests() {
      const rows = must(
        await db
          .from('care_requests')
          .select('client_id, kind, title, body, clinician, status, sent_on, answered_on, created_at')
          .order('created_at', { ascending: false }),
      ) as
        | {
            client_id: string;
            kind: CareRequest['kind'];
            title: string;
            body: string;
            clinician: string | null;
            status: CareRequest['status'];
            sent_on: string | null;
            answered_on: string | null;
            created_at: string;
          }[]
        | null;
      return (rows ?? []).map((r) => ({
        id: r.client_id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        clinician: r.clinician,
        status: r.status,
        sentOn: r.sent_on,
        answeredOn: r.answered_on,
        createdAt: r.created_at,
      }));
    },
    async saveRequest(r) {
      must(
        await db.from('care_requests').upsert(
          {
            user_id: userId,
            client_id: r.id,
            kind: r.kind,
            title: r.title.trim(),
            body: r.body,
            clinician: r.clinician,
            status: r.status,
            sent_on: r.sentOn,
            answered_on: r.answeredOn,
          },
          { onConflict: 'user_id,client_id' },
        ),
      );
    },
    async deleteRequest(id) {
      must(await db.from('care_requests').delete().eq('client_id', id));
    },
    async loadResearchInsights() {
      const rows = must(await db.from('research_insights').select('id, title, image, topics, highlights, body, sources').order('sort')) as ResearchInsight[] | null;
      // The library ships with the app too, so an empty or unreachable
      // table still shows the research rather than nothing.
      return rows?.length ? rows : INSIGHTS;
    },
    async loadInsightReactions() {
      const rows = must(await db.from('insight_reactions').select('insight_id, reaction, saved')) as
        | { insight_id: string; reaction: InsightReaction['reaction']; saved: boolean }[]
        | null;
      return Object.fromEntries((rows ?? []).map((r) => [r.insight_id, { reaction: r.reaction, saved: r.saved }]));
    },
    async saveInsightReaction(id, r) {
      must(
        await db
          .from('insight_reactions')
          .upsert({ user_id: userId, client_id: id, insight_id: id, reaction: r.reaction, saved: r.saved }, { onConflict: 'user_id,client_id' }),
      );
    },
    async loadCareTeam() {
      const rows = must(
        await db.from('care_team').select('client_id, name, role, organization, phone, email, notes').order('created_at'),
      ) as { client_id: string; name: string; role: string | null; organization: string | null; phone: string | null; email: string | null; notes: string | null }[] | null;
      return (rows ?? []).map((r) => ({ id: r.client_id, name: r.name, role: r.role, organization: r.organization, phone: r.phone, email: r.email, notes: r.notes }));
    },
    async saveClinician(c) {
      must(
        await db.from('care_team').upsert(
          {
            user_id: userId,
            client_id: c.id,
            name: c.name.trim(),
            role: c.role,
            organization: c.organization,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
          },
          { onConflict: 'user_id,client_id' },
        ),
      );
    },
    async deleteClinician(id) {
      must(await db.from('care_team').delete().eq('client_id', id));
    },
    async loadInsurance() {
      const row = must(await db.from('profiles').select('insurance').eq('id', userId).maybeSingle()) as { insurance: unknown } | null;
      return insuranceFromRow(row?.insurance);
    },
    async saveInsurance(ins) {
      must(await db.from('profiles').update({ insurance: ins }).eq('id', userId));
    },
    async loadBaselines() {
      const rows = must(
        await db.from('baselines').select('metric, median, low, high, n, sufficient').eq('window_days', 90),
      ) as { metric: string; median: number | string | null; low: number | string | null; high: number | string | null; n: number; sufficient: boolean }[] | null;
      const num = (v: number | string | null) => (v == null ? null : Number(v));
      return (rows ?? []).map((r) => ({ metric: r.metric, median: num(r.median), low: num(r.low), high: num(r.high), n: r.n, sufficient: r.sufficient }));
    },
    async loadVitalDays(since, tz) {
      const rows = must(await db.rpc('vital_days', { p_since: since, p_tz: tz })) as
        | { metric: string; day: string; avg_value: number | string; min_value: number | string; max_value: number | string; n: number }[]
        | null;
      return (rows ?? []).map((r) => ({ metric: r.metric, day: r.day, avg: Number(r.avg_value), min: Number(r.min_value), max: Number(r.max_value), n: r.n }));
    },
    async loadIntraday(sinceIso, metrics = ['heart_rate', 'sleep_analysis']) {
      // Only the two metrics the day chart draws, and only today's. Reading
      // every observation since midnight would pull the whole of Apple
      // Health's firehose for a chart that plots one line.
      const rows = must(
        await db
          .from('observations')
          .select('metric, value, value_text, occurred_at')
          .in('metric', metrics)
          .gte('occurred_at', sinceIso)
          .order('occurred_at'),
      ) as { metric: string; value: number | null; value_text: string | null; occurred_at: string }[];
      return rows.map((r) => ({ metric: r.metric, value: r.value, valueText: r.value_text, at: r.occurred_at }));
    },
  };
}

// ── Example person's metric history ───────────────────────────

// The example person's readings so far today, for a metric's Day view:
// a few an hour where a watch would take them, steady with a wobble.
function demoIntraday(metrics: string[]): IntradayPoint[] {
  const now = new Date();
  const out: IntradayPoint[] = [];
  const base: Record<string, { from: number; every: number; value: (h: number) => number }> = {
    hrv: { from: 0, every: 2, value: (h) => 44 + ((h * 7) % 9) },
    resting_heart_rate: { from: 6, every: 3, value: (h) => 60 + (h % 4) },
    steps: { from: 7, every: 1, value: (h) => (h >= 22 ? 40 : 250 + ((h * 137) % 600)) },
    oxygen_saturation: { from: 0, every: 2, value: (h) => 0.96 + (h % 3) / 100 },
    blood_pressure_systolic: { from: 8, every: 10, value: () => 119 },
    blood_pressure_diastolic: { from: 8, every: 10, value: () => 77 },
  };
  for (const metric of metrics) {
    const b = base[metric];
    if (!b) continue;
    for (let h = b.from; h <= now.getHours(); h += b.every) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 20);
      out.push({ metric, value: b.value(h), valueText: null, at: at.toISOString() });
    }
  }
  return out;
}

const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// A year of cuff and watch readings for the example person, one row per
// metric per day, steady with a small daily wobble. Every few days has no
// cuff reading, as a real record would.
function demoVitalDays(): VitalDay[] {
  const out: VitalDay[] = [];
  const now = new Date();
  for (let n = 364; n >= 0; n--) {
    const day = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
    const wobble = Math.sin(n * 1.7) * 3;
    if (n % 4 !== 1) {
      out.push({ metric: 'blood_pressure_systolic', day, avg: Math.round(119 + wobble), min: Math.round(116 + wobble), max: Math.round(123 + wobble), n: 2 });
      out.push({ metric: 'blood_pressure_diastolic', day, avg: Math.round(77 + wobble / 2), min: Math.round(75 + wobble / 2), max: Math.round(79 + wobble / 2), n: 2 });
    }
    const o2 = Math.round((97 + Math.sin(n * 0.9)) * 10) / 10;
    out.push({ metric: 'oxygen_saturation', day, avg: o2, min: Math.round(o2 - 2.5), max: Math.min(100, Math.round(o2 + 1.5)), n: 6 });
  }
  return out;
}

// What the baselines function would store for the example person: the
// same band, over the same window of days 35 to 90 back.
function demoBaselines(days: readonly Day[], vitals: readonly VitalDay[]): BaselineRow[] {
  const now = new Date();
  const from = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90));
  const to = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 35));
  const row = (metric: string, values: number[]): BaselineRow => {
    if (values.length < 20) return { metric, median: null, low: null, high: null, n: values.length, sufficient: false };
    // Blood oxygen as the server shapes it: one point either side at
    // least, and never above 100.
    if (metric === 'oxygen_saturation') {
      const mid = median(values);
      const spread = Math.max(1.5 * 1.4826 * median(values.map((v) => Math.abs(v - mid))), 1);
      return { metric, median: mid, low: mid - spread, high: Math.min(100, mid + spread), n: values.length, sufficient: true };
    }
    const b = band(values);
    return { metric, median: b.usual, low: b.low, high: b.high, n: values.length, sufficient: true };
  };
  const window = days.filter((d) => d.date >= from && d.date <= to);
  const fromDays = (get: (d: Day) => number | null) => window.map(get).filter((v): v is number => v != null);
  const fromVitals = (metric: string) => vitals.filter((v) => v.metric === metric && v.day >= from && v.day <= to).map((v) => v.avg);
  return [
    row('sleep_hours', fromDays((d) => d.sleepHours)),
    row('steps', fromDays((d) => d.steps)),
    row('hrv', fromDays((d) => d.hrv)),
    row('resting_hr', fromDays((d) => d.restingHR)),
    row('active_minutes', fromDays((d) => d.activeMinutes)),
    row('blood_pressure_systolic', fromVitals('blood_pressure_systolic')),
    row('blood_pressure_diastolic', fromVitals('blood_pressure_diastolic')),
    row('oxygen_saturation', fromVitals('oxygen_saturation')),
  ];
}

// ── Labs ───────────────────────────────────────────────────────

type LabRow = {
  id: string;
  test_name: string;
  value: number | string | null;
  value_text: string | null;
  unit: string | null;
  reference_low: number | string | null;
  reference_high: number | string | null;
  reference_text: string | null;
  flag: string | null;
  status: string | null;
  source: string | null;
  provider: string | null;
  occurred_at: string;
  document_id: string | null;
  panel: string | null;
};

const numOrNull = (v: number | string | null) => (v == null ? null : Number(v));

function labFromRow(r: LabRow): LabResult {
  return {
    id: r.id,
    name: r.test_name,
    value: numOrNull(r.value),
    valueText: r.value_text,
    unit: r.unit,
    low: numOrNull(r.reference_low),
    high: numOrNull(r.reference_high),
    rangeText: r.reference_text,
    flag: (r.flag as LabFlag | null) ?? null,
    status: r.status,
    // A row from before Labs had a source came with her records.
    source: r.source === 'report' ? 'report' : 'provider',
    lab: r.provider,
    on: r.occurred_at.slice(0, 10),
    documentId: r.document_id,
    panel: r.panel,
  };
}

const SAMPLE_MONTH: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

// The example person's draws ("12 Jun 2026", "41 ng/mL", "15 to 150") as labs.
function sampleLabs(): LabResult[] {
  return sampleRecords.draws.flatMap((d, i) => {
    const [day, mon, year] = d.date.split(' ');
    const on = `${year}-${SAMPLE_MONTH[mon]}-${day.padStart(2, '0')}`;
    return d.results.map((r, k) => {
      const [num, ...unit] = r.value.split(' ');
      return {
        id: `sample-${i}-${k}`,
        name: r.name,
        value: Number(num),
        valueText: null,
        unit: unit.join(' ') || null,
        ...parseRange(r.range),
        rangeText: r.range,
        flag: null,
        status: 'final',
        source: 'provider' as const,
        lab: d.lab,
        on,
      };
    });
  });
}

// The example person's last night, stage by stage: in bed at 23:10, up at
// 06:45, with the stages a typical night moves through.
function demoNight(): SleepSample[] {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 23, 10).getTime();
  const plan: [string, number][] = [
    ['awake', 12], ['asleep_core', 25], ['asleep_deep', 45], ['asleep_core', 30], ['asleep_rem', 22],
    ['asleep_core', 40], ['asleep_deep', 28], ['awake', 4], ['asleep_core', 35], ['asleep_rem', 30],
    ['asleep_core', 45], ['asleep_rem', 38], ['awake', 6], ['asleep_core', 30], ['asleep_rem', 25], ['awake', 10],
  ];
  let at = start;
  return plan.map(([stage, minutes]) => {
    const from = at;
    at += minutes * 60000;
    return { stage, start: new Date(from).toISOString(), end: new Date(at).toISOString() };
  });
}

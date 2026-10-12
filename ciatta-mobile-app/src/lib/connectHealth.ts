import { outcomeForConnectAttempt } from './connectSource';
import { healthKitAnchors, healthKitPort, healthPermissionWillAsk, isHealthAvailable, requestHealthPermission } from './healthKit';
import { runHealthSync } from './healthSync';
import type { SyncResult } from './healthSync';
import type { DbSourceKind, DbSourceStatus } from '../data/rows';

// Connecting Apple Health, in one place.
//
// This was written out inside ProfileScreen and is now shared, because
// onboarding offers the same connection and a second copy of it would be a
// second chance to drift. The discipline worth not duplicating is the status
// writing: every branch below records what actually happened before it
// returns, so health_sources never says connected because a connection was
// attempted. An unsupported device, a refused permission and a partial sync
// are three different truths and each one is stored as itself.
//
// The caller supplies saveStatus rather than a repo, so this file needs no
// Supabase import and the sequence can be exercised without one.
export type ConnectHealthDeps = {
  userId: string;
  saveStatus: (kind: DbSourceKind, status: DbSourceStatus, lastSyncedAt?: string) => Promise<void>;
  // Progress and outcome copy, as it should appear on screen. Called several
  // times; the last call is the outcome.
  onNote: (note: string) => void;
};

// What actually arrived, for the screen to show her.
//
// Counted from the sync's own per metric outcomes rather than described.
// "Your data has been imported" is a sentence any failed run could also
// print; these are numbers that are zero when nothing came in.
export type Imported = {
  // Observations a successful post accepted, summed across metrics.
  observations: number;
  // Metrics that returned at least one sample and posted it.
  metrics: number;
  // Metrics whose read or post did not go through this run.
  failed: number;
  // The metrics with the most readings, most first, for the screen to name.
  top: { metric: string; observations: number }[];
};

export type ConnectHealthResult = {
  status: DbSourceStatus;
  message: string;
  // Null when no sync ran at all, which is different from a sync that ran
  // and found nothing. The screen must be able to tell those apart.
  imported: Imported | null;
  // True only when a sync actually ran and the source is active. Onboarding
  // uses this to decide whether it may say anything was read, and nothing
  // else may infer that from the message text.
  connected: boolean;
};

export async function connectAppleHealth(deps: ConnectHealthDeps): Promise<ConnectHealthResult> {
  const { userId, saveStatus, onNote } = deps;

  onNote('Checking whether Apple Health is available.');

  const available = await isHealthAvailable();
  if (!available) {
    await saveStatus('apple_health', 'unsupported');
    const outcome = outcomeForConnectAttempt({ kind: 'unavailable' });
    onNote(outcome.message);
    return { ...outcome, connected: false, imported: null };
  }

  // Whether iOS still has a question to put to her. Reported in the note,
  // and nothing navigates away on it: taking her to the Health app on a
  // false meant the button stopped raising the sheet at all, which is the
  // one thing this screen exists to do.
  const willAsk = await healthPermissionWillAsk();
  onNote(
    willAsk
      ? 'Apple is asking you now. Choose what Ciatta may read.'
      : 'You answered this before, so Apple will not ask again.',
  );

  // The request goes out, always, whatever willAsk said.
  //
  // iOS is the only thing that actually knows whether a sheet is due, and it
  // decides per type: when a type has been added since she last answered,
  // which is what happened when this build went from twelve metrics to a
  // hundred and ninety one, the sheet comes back up for the undetermined
  // ones. Calling it unconditionally is what makes that work, and willAsk
  // reports unknown as no, so a guard here would also fail closed.
  const permission = await requestHealthPermission();
  if (!permission.granted) {
    // Refused is recorded, not left blank. A woman who said no has said
    // something, and the record should be able to tell that apart from never
    // having been asked.
    await saveStatus('apple_health', 'refused');
    const outcome = outcomeForConnectAttempt({ kind: 'refused' });
    onNote(outcome.message);
    return { ...outcome, connected: false, imported: null };
  }

  await saveStatus('apple_health', 'connected');
  onNote('Connected. Reading your Apple Health data now.');

  // The status is promoted the moment the first reading lands, not at the
  // end of the run.
  //
  // The read walks every metric HealthKit offers and takes a while, and
  // 'connected' means "mid read". If she backgrounds the app partway, the
  // final write below never happens and the source is left saying
  // mid read forever, which every screen reads as not connected. That is
  // what happened to this account: thousands of observations had arrived
  // and Apple Health still showed as unconnected.
  //
  // Once one metric has posted, 'active' is true and stays true, so an
  // interrupted run now leaves behind a status that matches the rows.
  let promoted = false;
  const promote = async () => {
    if (promoted) return;
    promoted = true;
    await saveStatus('apple_health', 'active', new Date().toISOString());
  };

  const result = await runHealthSync(userId, {
    port: healthKitPort,
    anchors: healthKitAnchors,
    mode: 'recovery',
    // progress.metric is an internal key (resting_heart_rate, sleep_analysis),
    // not copy fit for her screen, so this only ever says how far along the
    // read is, never which internal field it is on.
    onProgress: (progress) => {
      onNote(`Reading your Apple Health data, ${progress.index} of ${progress.total}.`);
      if (progress.posted > 0) void promote();
    },
  });

  const outcome = outcomeForConnectAttempt({ kind: 'synced', result });
  await saveStatus(
    'apple_health',
    outcome.status,
    outcome.status === 'active' ? new Date().toISOString() : undefined,
  );
  onNote(outcome.message);
  return { ...outcome, connected: outcome.status === 'active', imported: summarise(result) };
}

// The run, as something she can read. Only metrics that actually landed a
// row are counted or named: a metric that returned no samples is not an
// import, and listing it would pad the summary with absence.
function summarise(result: SyncResult): Imported {
  const landed = result.metrics.filter((m) => m.ok && m.observations > 0);
  return {
    observations: result.observations,
    metrics: landed.length,
    failed: result.failed.length,
    top: [...landed]
      .sort((a, b) => b.observations - a.observations)
      .slice(0, 4)
      .map((m) => ({ metric: m.metric, observations: m.observations })),
  };
}

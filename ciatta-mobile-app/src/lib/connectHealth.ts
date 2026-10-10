import { outcomeForConnectAttempt } from './connectSource';
import { healthKitAnchors, healthKitPort, healthPermissionWillAsk, isHealthAvailable, requestHealthPermission } from './healthKit';
import { runHealthSync } from './healthSync';
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

export type ConnectHealthResult = {
  status: DbSourceStatus;
  message: string;
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
    return { ...outcome, connected: false };
  }

  // Asked before requesting, because afterwards it is too late to tell her.
  // iOS shows its sheet once per type per install, so a woman who has already
  // answered taps Connect and sees nothing at all appear. Knowing that in
  // advance is the difference between "Apple is asking you now" and silence
  // she has to interpret.
  const willAsk = await healthPermissionWillAsk();
  onNote(
    willAsk
      ? 'Apple is asking you now. Choose what Ciatta may read.'
      : 'You have answered this before, so Apple will not ask again. To change it, open Settings, then Health, then Data Access and Devices.',
  );

  const permission = await requestHealthPermission();
  if (!permission.granted) {
    // Refused is recorded, not left blank. A woman who said no has said
    // something, and the record should be able to tell that apart from never
    // having been asked.
    await saveStatus('apple_health', 'refused');
    const outcome = outcomeForConnectAttempt({ kind: 'refused' });
    onNote(outcome.message);
    return { ...outcome, connected: false };
  }

  await saveStatus('apple_health', 'connected');
  onNote('Connected. Reading your Apple Health data now.');

  const result = await runHealthSync(userId, {
    port: healthKitPort,
    anchors: healthKitAnchors,
    mode: 'recovery',
    // progress.metric is an internal key (resting_heart_rate, sleep_analysis),
    // not copy fit for her screen, so this only ever says how far along the
    // read is, never which internal field it is on.
    onProgress: (progress) => onNote(`Reading your Apple Health data, ${progress.index} of ${progress.total}.`),
  });

  const outcome = outcomeForConnectAttempt({ kind: 'synced', result });
  await saveStatus(
    'apple_health',
    outcome.status,
    outcome.status === 'active' ? new Date().toISOString() : undefined,
  );
  onNote(outcome.message);
  return { ...outcome, connected: outcome.status === 'active' };
}

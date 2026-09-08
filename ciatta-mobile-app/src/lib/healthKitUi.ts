import type { HealthKitSyncTotals } from './healthKitSyncEngine.ts';

export type HealthSyncUiKind = 'complete' | 'processing' | 'partial' | 'error';

export function healthSyncUiKind(totals: Pick<HealthKitSyncTotals, 'created' | 'failed' | 'typesFailed' | 'timedOut'>): HealthSyncUiKind {
  if (totals.timedOut) return 'partial';
  if (totals.typesFailed.length > 0 || totals.failed > 0) {
    return totals.created > 0 ? 'partial' : 'error';
  }
  if (totals.created > 0) return 'processing';
  return 'complete';
}

export const HEALTH_SYNC_COPY: Record<HealthSyncUiKind | 'syncing', string> = {
  syncing: 'Updating your health data...',
  complete: 'Your health data is up to date.',
  processing: 'Your health data is up to date. Ciatta is updating your picture.',
  partial: 'Some health data was updated. Ciatta will keep trying to update the rest.',
  error: "Some health data couldn't be updated. We'll try again.",
};

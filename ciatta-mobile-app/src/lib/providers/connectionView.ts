// How her provider connections are described: on the Chart screen, where
// she manages them, and on the Data Sources row in Profile.
//
// Pure, so every sentence is tested. A connection is described by what
// she holds from it, not by what the last run happened to write.

import type { Connection } from '../../data/providers';
import { dayLabel } from './clinicalView';

const DAY = 86_400_000;
const localDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const records = (n: number) => (n === 1 ? '1 record' : `${n} records`);

export function updatedLine(lastSyncedAt: string | null, now: Date): string {
  if (!lastSyncedAt) return 'Not updated yet';
  const at = new Date(lastSyncedAt);
  if (Number.isNaN(at.getTime())) return 'Not updated yet';
  const days = Math.round((localDay(now) - localDay(at)) / DAY);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return `Updated ${dayLabel(iso)}`;
}

export const canSync = (c: Connection) => c.status === 'active' || c.status === 'connected';
export const needsReconnect = (c: Connection) => c.status === 'expired' || c.status === 'error';
export const providerName = (c: Connection) => c.organization ?? c.endpointName;

export function connectionLine(c: Connection, now: Date): string {
  if (needsReconnect(c)) return 'Needs connecting again. The records it already sent are kept.';
  if (c.recordCount === 0) return 'Connected. Nothing has arrived yet.';
  return `${records(c.recordCount)}. ${c.lastError ?? updatedLine(c.lastSyncedAt, now)}`;
}

export type RecordsSource = {
  status: string;
  tone: 'live' | 'suggested' | undefined;
  connected: boolean;
  target: 'chart' | 'providerConnect';
};

export function recordsSource(connections: readonly Connection[]): RecordsSource {
  const kept = connections.filter((c) => canSync(c) || needsReconnect(c));
  if (!kept.length) {
    return { status: 'Your hospital or clinic, through its portal', tone: 'suggested', connected: false, target: 'providerConnect' };
  }
  if (kept.some(needsReconnect)) return { status: 'Needs connecting again', tone: undefined, connected: true, target: 'chart' };
  const total = kept.reduce((n, c) => n + c.recordCount, 0);
  if (total === 0) return { status: 'Connected. Nothing has arrived yet.', tone: 'live', connected: true, target: 'chart' };
  const from = kept.length === 1 ? providerName(kept[0]) : `${kept.length} providers`;
  return { status: `${records(total)} from ${from}`, tone: 'live', connected: true, target: 'chart' };
}

export type SyncFailure = { name: string; message: string };

export function syncNote(failures: readonly SyncFailure[]): string | null {
  if (!failures.length) return null;
  if (failures.length === 1) return `${failures[0].name}: ${failures[0].message}`;
  const names = failures.map((f) => f.name);
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} could not be updated just now.`;
}

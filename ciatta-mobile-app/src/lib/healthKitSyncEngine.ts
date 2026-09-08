import { persistEach, type PersistEachResult } from './healthKitPersist.ts';
import type { AnchorStore, HealthKitSyncReason } from './healthKitAnchors.ts';
import { shouldStop } from './healthKitTimeout.ts';

export const HK_LOG = '[hksync]';

export interface AnchoredPage<T> {
  samples: readonly T[];
  deletedUuids: readonly string[];
  newAnchor: string;
}

export interface TypeSyncResult {
  type: string;
  initial: boolean;
  anchorPresent: boolean;
  anchorAdvanced: boolean;
  samplesReturned: number;
  samplesAdded: number;
  samplesDeleted: number;
  created: number;
  duplicates: number;
  failed: number;
  timedOut: boolean;
  queryFailed: boolean;
  errors: string[];
}

export interface HealthKitSyncTotals {
  reason: HealthKitSyncReason;
  created: number;
  duplicates: number;
  failed: number;
  deleted: number;
  typesFailed: string[];
  timedOut: boolean;
  elapsedMs: number;
  typeResults: TypeSyncResult[];
}

export interface SyncTypeDeps<T> {
  type: string;
  query: (anchor: string | null) => Promise<AnchoredPage<T>>;
  persist: (sample: T) => Promise<boolean>;
  deleteByUuid: (uuid: string) => Promise<void>;
}

export async function syncOneType<T>(opts: {
  userId: string;
  reason: HealthKitSyncReason;
  store: AnchorStore;
  deps: SyncTypeDeps<T>;
  signal?: { aborted: boolean };
  startedAt: number;
  budgetMs: number;
  now?: () => number;
}): Promise<TypeSyncResult> {
  const now = opts.now ?? Date.now;
  const type = opts.deps.type;
  const saved = await opts.store.get(opts.userId, type);
  const initial = saved == null;
  console.log(HK_LOG, 'data type', type);
  console.log(HK_LOG, 'anchor present/absent', type, saved ? 'present' : 'absent');

  const result: TypeSyncResult = {
    type,
    initial,
    anchorPresent: saved != null,
    anchorAdvanced: false,
    samplesReturned: 0,
    samplesAdded: 0,
    samplesDeleted: 0,
    created: 0,
    duplicates: 0,
    failed: 0,
    timedOut: false,
    queryFailed: false,
    errors: [],
  };

  if (opts.signal?.aborted || shouldStop(opts.startedAt, opts.budgetMs, now())) {
    result.timedOut = true;
    return result;
  }

  let page: AnchoredPage<T>;
  const queryStarted = now();
  try {
    page = await opts.deps.query(saved);
  } catch (e) {
    result.queryFailed = true;
    result.errors.push(e instanceof Error ? e.message : String(e));
    console.error(HK_LOG, 'persistence errors', type, { stage: 'query', message: result.errors[0] });
    return result;
  }
  console.log(HK_LOG, 'query window or anchor', type, {
    reason: opts.reason,
    initial,
    elapsedMs: now() - queryStarted,
  });

  result.samplesReturned = page.samples.length;
  result.samplesAdded = page.samples.length;
  result.samplesDeleted = page.deletedUuids.length;
  console.log(HK_LOG, 'samples returned', type, result.samplesReturned);
  console.log(HK_LOG, 'samples added', type, result.samplesAdded);
  console.log(HK_LOG, 'samples deleted', type, result.samplesDeleted);

  if (opts.signal?.aborted || shouldStop(opts.startedAt, opts.budgetMs, now())) {
    result.timedOut = true;
    return result;
  }

  const persistStarted = now();
  const persisted = await persistEach(page.samples, opts.deps.persist, opts.signal);
  console.log(HK_LOG, 'normalization', type, { elapsedMs: now() - persistStarted });
  result.created = persisted.created;
  result.duplicates = persisted.skipped;
  result.failed = persisted.failed;
  result.errors.push(...persisted.errors);
  console.log(HK_LOG, 'observations created', type, result.created);
  console.log(HK_LOG, 'duplicates ignored', type, result.duplicates);
  if (persisted.failed > 0) {
    console.error(HK_LOG, 'persistence errors', type, { failed: persisted.failed, errors: persisted.errors });
  }

  let deleteFailed = 0;
  for (const uuid of page.deletedUuids) {
    if (opts.signal?.aborted) {
      result.timedOut = true;
      break;
    }
    try {
      await opts.deps.deleteByUuid(uuid);
    } catch (e) {
      deleteFailed += 1;
      result.failed += 1;
      const message = e instanceof Error ? e.message : String(e);
      if (result.errors.length < 8) result.errors.push(message);
      console.error(HK_LOG, 'persistence errors', type, { stage: 'delete', message });
    }
  }

  const persistOk = persisted.failed === 0 && deleteFailed === 0 && !opts.signal?.aborted;
  if (persistOk) {
    await opts.store.set(opts.userId, type, page.newAnchor);
    result.anchorAdvanced = true;
    result.anchorPresent = true;
    console.log(HK_LOG, 'anchor advancement', type, { advanced: true });
  } else {
    console.log(HK_LOG, 'anchor advancement', type, { advanced: false, persistOk: false });
  }

  if (opts.signal?.aborted || shouldStop(opts.startedAt, opts.budgetMs, now())) {
    result.timedOut = true;
  }
  return result;
}

export async function runHealthKitSync<T>(opts: {
  userId: string;
  reason: HealthKitSyncReason;
  store: AnchorStore;
  types: SyncTypeDeps<T>[];
  signal?: { aborted: boolean };
  startedAt: number;
  budgetMs: number;
  now?: () => number;
}): Promise<HealthKitSyncTotals> {
  const now = opts.now ?? Date.now;
  console.log(HK_LOG, 'sync started', { reason: opts.reason });
  const typeResults: TypeSyncResult[] = [];
  for (const deps of opts.types) {
    if (opts.signal?.aborted || shouldStop(opts.startedAt, opts.budgetMs, now())) {
      typeResults.push({
        type: deps.type,
        initial: false,
        anchorPresent: (await opts.store.get(opts.userId, deps.type)) != null,
        anchorAdvanced: false,
        samplesReturned: 0,
        samplesAdded: 0,
        samplesDeleted: 0,
        created: 0,
        duplicates: 0,
        failed: 0,
        timedOut: true,
        queryFailed: false,
        errors: [],
      });
      continue;
    }
    typeResults.push(
      await syncOneType({
        userId: opts.userId,
        reason: opts.reason,
        store: opts.store,
        deps,
        signal: opts.signal,
        startedAt: opts.startedAt,
        budgetMs: opts.budgetMs,
        now,
      })
    );
  }

  const totals: HealthKitSyncTotals = {
    reason: opts.reason,
    created: typeResults.reduce((n, r) => n + r.created, 0),
    duplicates: typeResults.reduce((n, r) => n + r.duplicates, 0),
    failed: typeResults.reduce((n, r) => n + r.failed, 0),
    deleted: typeResults.reduce((n, r) => n + r.samplesDeleted, 0),
    typesFailed: typeResults.filter((r) => r.queryFailed || r.failed > 0).map((r) => r.type),
    timedOut: typeResults.some((r) => r.timedOut),
    elapsedMs: now() - opts.startedAt,
    typeResults,
  };
  console.log(HK_LOG, 'sync completed', {
    reason: totals.reason,
    created: totals.created,
    duplicates: totals.duplicates,
    failed: totals.failed,
    timedOut: totals.timedOut,
    elapsedMs: totals.elapsedMs,
  });
  return totals;
}

export function emptyPersist(): PersistEachResult {
  return { attempted: 0, created: 0, failed: 0, skipped: 0, errors: [] };
}

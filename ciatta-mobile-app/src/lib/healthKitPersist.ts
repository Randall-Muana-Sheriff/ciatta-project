export interface PersistEachResult {
  attempted: number;
  created: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Persist HealthKit samples one at a time so a duplicate or RLS error
 * cannot abort the rest of the type. skipped means ignoreDuplicates hit.
 */
export async function persistEach<T>(
  items: readonly T[],
  persist: (item: T) => Promise<boolean>,
  signal?: { aborted: boolean },
): Promise<PersistEachResult> {
  let created = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const item of items) {
    if (signal?.aborted) break;
    try {
      const inserted = await persist(item);
      if (inserted) created += 1;
      else skipped += 1;
    } catch (e) {
      failed += 1;
      if (errors.length < 8) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  return {
    attempted: created + failed + skipped,
    created,
    failed,
    skipped,
    errors,
  };
}

// Her labs, shared by every screen that reads them (insights, the body
// view), read once and kept, then refreshed whenever a screen asks again.
import { useEffect, useState } from 'react';

import type { LabResult } from '../lib/labs';
import { useRepo } from './session';

let cache: { repo: unknown; labs: LabResult[] } | null = null;
const listeners = new Set<(labs: LabResult[]) => void>();

export function useLabs(): LabResult[] {
  const repo = useRepo();
  const [labs, setLabs] = useState<LabResult[]>(() => (cache?.repo === repo ? cache.labs : []));
  useEffect(() => {
    listeners.add(setLabs);
    let ignore = false;
    repo
      .loadLabs()
      .then((rows) => {
        if (ignore) return;
        cache = { repo, labs: rows };
        for (const l of listeners) l(rows);
      })
      .catch(() => {});
    return () => {
      ignore = true;
      listeners.delete(setLabs);
    };
  }, [repo]);
  return labs;
}

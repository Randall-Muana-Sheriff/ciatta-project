// Her units, read from her body record (or her region until she chooses),
// set as the app's active system, and changed from here.

import { useEffect, useState } from 'react';

import { activeUnits, defaultUnits, setActiveUnits, type Units, unitsOf } from '../lib/units';
import { useRepo } from './session';

export const regionUnits = () => defaultUnits(Intl.DateTimeFormat().resolvedOptions().locale);

export function useUnits() {
  const repo = useRepo();
  const [units, setUnits] = useState<Units>(activeUnits());
  useEffect(() => {
    let ignore = false;
    repo
      .loadBody()
      .then((b) => {
        const u = unitsOf(b?.units) ?? regionUnits();
        setActiveUnits(u);
        if (!ignore) setUnits(u);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);
  const choose = async (u: Units) => {
    setActiveUnits(u);
    setUnits(u);
    const b = await repo.loadBody().catch(() => null);
    await repo.saveBody({ ...(b ?? {}), units: u });
  };
  return { units, choose };
}

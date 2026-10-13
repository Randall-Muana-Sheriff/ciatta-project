// Which of today's plan items she ticked off. Kept on this phone, one key
// per day, so tomorrow's plan opens fresh and today's ticks survive a
// relaunch.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const keyFor = (d: Date) => `ciatta.plan.${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function usePlanDone(now: Date) {
  const key = keyFor(now);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!ignore) setDone(raw ? (JSON.parse(raw) as string[]) : []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [key]);

  const toggle = useCallback(
    (item: string) => {
      setDone((prev) => {
        const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [key],
  );

  return { done, toggle };
}

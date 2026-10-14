// The symptoms she chose to follow and compare on Today, kept on this
// phone so the card opens on them next time.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'ciatta.symptoms.compare';

export function useSymptomChoice(): [string[], (next: string[]) => void] {
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setChosen(JSON.parse(v) as string[]))
      .catch(() => {});
  }, []);
  const choose = useCallback((next: string[]) => {
    setChosen(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  return [chosen, choose];
}

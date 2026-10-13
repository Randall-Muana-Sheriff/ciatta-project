// Runs the weather sync on the phone: permission, a rough position, the
// days still missing, and the call. At most once a day unless asked.
// See lib/environmentSync for the rules and what leaves the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import type { Repo } from '../data/repo';
import { roughly, syncRange } from '../lib/environmentSync';

const LAST = 'ciatta.environment.lastSync';

export type SyncResult = 'off' | 'synced' | 'current' | 'failed';

export async function runEnvironmentSync(repo: Repo, force = false): Promise<SyncResult> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return 'off';
  const today = new Date().toDateString();
  if (!force) {
    try {
      if ((await AsyncStorage.getItem(LAST)) === today) return 'current';
    } catch {
      // No record of the last run: run.
    }
  }
  try {
    const stored = await repo.loadEnvironment();
    const newest = stored.length ? stored.map((d) => d.day).sort().at(-1)! : null;
    const range = syncRange(newest, new Date());
    if (range) {
      const at = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      await repo.fetchEnvironment({ ...roughly(at.coords.latitude, at.coords.longitude), ...range });
    }
    await AsyncStorage.setItem(LAST, today).catch(() => {});
    return range ? 'synced' : 'current';
  } catch {
    return 'failed';
  }
}

export async function askForWeather(repo: Repo): Promise<SyncResult> {
  const asked = await Location.requestForegroundPermissionsAsync();
  if (!asked.granted) return 'off';
  return runEnvironmentSync(repo, true);
}

export async function weatherIsOn(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

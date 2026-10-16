// Her colour scheme choice, kept on the phone. Applying it reloads the app,
// because every style captured its colours when it loaded (see ui/scheme).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { DevSettings } from 'react-native';

import { type Scheme, SCHEMES } from '../ui/scheme';

const KEY = 'ciatta.scheme';

export async function loadScheme(): Promise<Scheme> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    // Light unless she has chosen: the app is designed light first.
    return SCHEMES.includes(v as Scheme) ? (v as Scheme) : 'light';
  } catch {
    return 'light';
  }
}

// The scheme Boot read, so Profile shows the choice without a second read.
let current: Scheme = 'system';
export function setLoadedScheme(s: Scheme) {
  current = s;
}

export async function reloadApp() {
  if (__DEV__) DevSettings.reload();
  else await Updates.reloadAsync();
}

export function useColorScheme() {
  const [scheme, setLocal] = useState<Scheme>(current);
  const choose = async (next: Scheme) => {
    if (next === scheme) return;
    setLocal(next);
    current = next;
    await AsyncStorage.setItem(KEY, next).catch(() => {});
    await reloadApp().catch(() => {});
  };
  return { scheme, choose };
}

// Face ID for Ciatta: whether she has turned it on, kept on this phone,
// and the prompts that check it. iOS shows its own Face ID sheet and falls
// back to the phone's passcode, so she is never locked out of her record.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'ciatta.faceid';

export async function faceIdIsOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'on';
  } catch {
    return false;
  }
}

// Whether this phone can do it at all: the hardware, and a face enrolled.
export async function faceIdAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function checkFace(prompt: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, fallbackLabel: 'Use Passcode' });
    return r.success;
  } catch {
    return false;
  }
}

// Turning it on asks for her face first, so it is never on for a phone
// that cannot open it. Turning it off needs nothing.
export async function setFaceId(on: boolean): Promise<boolean> {
  if (on) {
    if (!(await faceIdAvailable())) return false;
    if (!(await checkFace('Turn on Face ID for Ciatta'))) return false;
  }
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => {});
  return on;
}

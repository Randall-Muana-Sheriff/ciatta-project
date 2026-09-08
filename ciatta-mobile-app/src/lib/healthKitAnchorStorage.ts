import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnchorStore } from './healthKitAnchors';

function key(userId: string, type: string): string {
  return `hk_anchor:${userId}:${type}`;
}

export const asyncAnchorStore: AnchorStore = {
  async get(userId, type) {
    try {
      return await AsyncStorage.getItem(key(userId, type));
    } catch {
      return null;
    }
  },
  async set(userId, type, anchor) {
    await AsyncStorage.setItem(key(userId, type), anchor);
  },
};

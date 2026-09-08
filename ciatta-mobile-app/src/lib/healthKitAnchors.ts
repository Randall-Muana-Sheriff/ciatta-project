export type HealthKitSyncReason = 'initial' | 'background' | 'manual';

export interface AnchorStore {
  get(userId: string, type: string): Promise<string | null>;
  set(userId: string, type: string, anchor: string): Promise<void>;
}

export function memoryAnchorStore(seed: Record<string, string> = {}): AnchorStore {
  const data = { ...seed };
  const key = (userId: string, type: string) => `${userId}:${type}`;
  return {
    async get(userId, type) {
      return data[key(userId, type)] ?? null;
    },
    async set(userId, type, anchor) {
      data[key(userId, type)] = anchor;
    },
  };
}

export async function hasAnyAnchor(store: AnchorStore, userId: string, types: string[]): Promise<boolean> {
  for (const type of types) {
    if (await store.get(userId, type)) return true;
  }
  return false;
}

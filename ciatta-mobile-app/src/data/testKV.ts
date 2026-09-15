import type { KV } from './outbox';

// A KV that keeps its data in memory, with the AsyncStorage shape, so tests
// can pass it in place of the real storage and inspect what got written.
export function memoryKV(seed: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => void (data[k] = v),
    removeItem: async (k) => void delete data[k],
  };
}

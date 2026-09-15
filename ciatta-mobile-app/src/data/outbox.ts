import type { Episode } from './cycleLog';

// Storage with the AsyncStorage shape, so tests can pass a plain object.
export type KV = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Episodes that could not be saved yet. Saving is an upsert on the episode's
// own id, so sending one twice is harmless.
export const OUTBOX_KEY = 'ciatta.outbox.v1';

async function read(kv: KV): Promise<Episode[]> {
  const raw = await kv.getItem(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as Episode[]) : [];
}

export async function enqueue(kv: KV, e: Episode): Promise<void> {
  const list = await read(kv);
  if (!list.some((x) => x.id === e.id)) await kv.setItem(OUTBOX_KEY, JSON.stringify([...list, e]));
}

export async function flush(kv: KV, save: (e: Episode) => Promise<void>): Promise<number> {
  const list = await read(kv);
  const left: Episode[] = [];
  for (const e of list) {
    try {
      await save(e);
    } catch {
      left.push(e);
    }
  }
  if (left.length) await kv.setItem(OUTBOX_KEY, JSON.stringify(left));
  else await kv.removeItem(OUTBOX_KEY);
  return list.length - left.length;
}

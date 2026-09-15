import type { Episode } from './cycleLog';

// Storage with the AsyncStorage shape, so tests can pass a plain object.
export type KV = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Episodes that could not be saved yet. Saving is an upsert on the episode's
// own id, so sending one twice is harmless.
//
// The queue is keyed per account. Two people can sign in on the same phone,
// and an episode one of them logged offline must never be sent as the
// other's: the account that queued it is part of the key, so whoever is
// signed in now simply cannot see anybody else's queue.
export const OUTBOX_PREFIX = 'ciatta.outbox.v1';

// What the queue was keyed as when it was device wide. Never read again,
// only cleared, so a stale entry from before this change cannot be sent as
// the wrong person's data.
export const LEGACY_OUTBOX_KEY = OUTBOX_PREFIX;

export const outboxKey = (userId: string) => `${OUTBOX_PREFIX}.${userId}`;

async function read(kv: KV, userId: string): Promise<Episode[]> {
  const raw = await kv.getItem(outboxKey(userId));
  return raw ? (JSON.parse(raw) as Episode[]) : [];
}

export async function enqueue(kv: KV, userId: string, e: Episode): Promise<void> {
  const list = await read(kv, userId);
  if (!list.some((x) => x.id === e.id)) await kv.setItem(outboxKey(userId), JSON.stringify([...list, e]));
}

export async function flush(kv: KV, userId: string, save: (e: Episode) => Promise<void>): Promise<number> {
  const list = await read(kv, userId);
  const left: Episode[] = [];
  for (const e of list) {
    try {
      await save(e);
    } catch {
      left.push(e);
    }
  }
  if (left.length) await kv.setItem(outboxKey(userId), JSON.stringify(left));
  else await kv.removeItem(outboxKey(userId));
  return list.length - left.length;
}

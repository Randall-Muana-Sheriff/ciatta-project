import { type CycleProfile, normalizeProfile } from '../lib/cycleProfile';
import { type Episode, normalizeEpisode } from './cycleLog';
import type { KV } from './outbox';

// What this phone saved before accounts existed. Imported once into her real
// record, then kept under another key so it is never imported twice.
export const DEVICE_KEY = 'ciatta.cycle.v1';
export const IMPORTED_KEY = 'ciatta.cycle.v1.imported';

export async function importDeviceRecord(
  kv: KV,
  save: (e: Episode, extra: Record<string, unknown>) => Promise<void>,
  saveProfile: (p: CycleProfile) => Promise<void>,
): Promise<number> {
  const raw = await kv.getItem(DEVICE_KEY);
  if (!raw) return 0;
  const saved = JSON.parse(raw) as { episodes?: Episode[]; profile?: unknown };
  const episodes = (saved.episodes ?? []).filter((e) => !e.id.startsWith('sample-')).map(normalizeEpisode);
  for (const e of episodes) await save(e, { imported_from: 'device' });
  const profile = normalizeProfile(saved.profile);
  if (profile) await saveProfile(profile);
  await kv.setItem(IMPORTED_KEY, raw);
  await kv.removeItem(DEVICE_KEY);
  return episodes.length;
}

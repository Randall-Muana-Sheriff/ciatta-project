// When the app reads Apple Health again on its own, and how far back.
//
// Connecting a source reads ninety days once. Without this, that was the
// only read there ever was: the record stopped on the day she connected,
// and the app showed that day for as long as she kept it. So each time the
// app comes to the front, and no more than once an hour, it reads the last
// week again.
//
// Pure: the store is a seam, as the anchor store in healthSync.ts is, so
// the rule is proven in healthRefresh.test.ts without a phone.
import { SLEEP_SPEC } from './healthMetrics';
import type { AnchorStore, SyncMode, SyncResult } from './healthSync';

// How this build folds samples into days. It moves on when the fold
// changes what a day holds, and a phone that last wrote days under an
// older fold reads the whole ninety days again, once, so every day in her
// record is one this fold wrote. 2 is the fold that counts a night once
// however many sources hold it, puts a night on the day she woke, and
// leaves sleep unknown when only time in bed was recorded.
export const FOLD_VERSION = 2;

export const REFRESH_EVERY_MS = 60 * 60 * 1000;

// Keyed per account, as the anchors are and for the same reason.
export const refreshedKey = (userId: string) => `hk-refreshed.v1.${userId}`;
export const foldKey = (userId: string) => `hk-fold.v1.${userId}`;

// Which read to make now, or null when the last one is recent enough.
export async function planRefresh(userId: string, store: AnchorStore, now: Date): Promise<Exclude<SyncMode, 'incremental'> | null> {
  const current = (await store.get(foldKey(userId))) === String(FOLD_VERSION);
  const last = Number(await store.get(refreshedKey(userId)));
  // A time in the future is a clock that was wrong when it was written,
  // and must not hold the next read off until the clock catches up.
  const recent = Number.isFinite(last) && last > 0 && last <= now.getTime() && now.getTime() - last < REFRESH_EVERY_MS;
  // The hour holds for both reads. What it is measured from is a read
  // made by this build: refreshedKey is new with it, so a phone coming
  // from an older build has none and reads at once.
  if (recent) return null;
  return current ? 'refresh' : 'recovery';
}

// What a finished read leaves behind: whether its time is kept, which holds
// the next read off for an hour, and whether the fold is moved on, which
// ends the ninety day reads.
//
// The time is kept when something got through. A read made with no signal
// sends nothing and is kept out, so the next time the app comes to the
// front it is made again; a read where one measure keeps failing still
// sent the rest, and is not made again on every open because of that one.
//
// The fold is about nights, which are what it changed. So it moves on when
// a recovery read carried sleep through, whatever else did not arrive: what
// did not arrive is read again by the weekly refresh, and a measure that
// never arrives must not bring the whole ninety days back every hour.
export function refreshOutcome(mode: SyncMode, result: Pick<SyncResult, 'observations' | 'failed'>): { keepTime: boolean; moveFold: boolean } {
  const through = result.failed.length === 0 || result.observations > 0;
  const sleepThrough = !result.failed.includes(SLEEP_SPEC.identifier);
  return { keepTime: through, moveFold: mode === 'recovery' && through && sleepThrough };
}

export async function recordRefresh(
  userId: string,
  store: AnchorStore,
  mode: SyncMode,
  result: Pick<SyncResult, 'observations' | 'failed'>,
  now: Date,
): Promise<void> {
  const { keepTime, moveFold } = refreshOutcome(mode, result);
  if (moveFold) await store.set(foldKey(userId), String(FOLD_VERSION));
  if (keepTime) await store.set(refreshedKey(userId), String(now.getTime()));
}

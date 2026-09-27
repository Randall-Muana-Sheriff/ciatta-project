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
import type { AnchorStore, SyncMode } from './healthSync';

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
  if ((await store.get(foldKey(userId))) !== String(FOLD_VERSION)) return 'recovery';
  const last = Number(await store.get(refreshedKey(userId)));
  // A time in the future is a clock that was wrong when it was written,
  // and must not hold the next read off until the clock catches up.
  if (Number.isFinite(last) && last > 0 && last <= now.getTime() && now.getTime() - last < REFRESH_EVERY_MS) return null;
  return 'refresh';
}

// Called once a read has gone through whole. A recovery read is what
// brings her days up to this fold, so only it moves the fold on.
export async function recordRefresh(userId: string, store: AnchorStore, mode: SyncMode, now: Date): Promise<void> {
  if (mode === 'recovery') await store.set(foldKey(userId), String(FOLD_VERSION));
  await store.set(refreshedKey(userId), String(now.getTime()));
}
